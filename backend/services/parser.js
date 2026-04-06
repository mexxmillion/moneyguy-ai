const pdfParse = require('pdf-parse');
const { parse } = require('csv-parse/sync');
const fs = require('fs');
const path = require('path');
const db = require('../db');

function parseAmount(str) {
  const cleaned = str.replace(/[$,\s]/g, '');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  return Math.round(num * 100);
}

function parseRBCPdf(text) {
  const transactions = [];
  const lines = text.split('\n');

  // RBC Visa pattern: "FEB 08 FEB 10 MERCHANT NAME LOCATION $18.74"
  // Also handles: "FEB 08 FEB 10 MERCHANT NAME LOCATION 18.74"
  const rbcPattern = /^([A-Z]{3}\s+\d{1,2})\s+([A-Z]{3}\s+\d{1,2})\s+(.+?)\s+\$?([\d,]+\.\d{2})(\s*-)?$/;
  // Alternative: amount with CR (credit)
  const rbcPatternCR = /^([A-Z]{3}\s+\d{1,2})\s+([A-Z]{3}\s+\d{1,2})\s+(.+?)\s+\$?([\d,]+\.\d{2})\s*CR$/;

  // Try to find statement year from text
  const yearMatch = text.match(/Statement\s+(?:From|Date|Period).*?(\d{4})/i) ||
                    text.match(/(\d{4})/);
  const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();

  const monthMap = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
                     JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };

  for (const line of lines) {
    const trimmed = line.trim();
    let match = trimmed.match(rbcPattern);
    let isCredit = false;

    if (!match) {
      match = trimmed.match(rbcPatternCR);
      isCredit = true;
    }

    if (match) {
      const [, transDateStr, postDateStr, description, amountStr] = match;
      const [transMonth, transDay] = transDateStr.split(/\s+/);
      const [postMonth, postDay] = postDateStr.split(/\s+/);

      const transDate = `${year}-${monthMap[transMonth] || '01'}-${transDay.padStart(2, '0')}`;
      const postDate = `${year}-${monthMap[postMonth] || '01'}-${postDay.padStart(2, '0')}`;

      let amount = parseAmount(amountStr);
      if (amount === null) continue;
      if (isCredit) amount = -amount; // credits are negative (refunds/payments)

      transactions.push({
        transaction_date: transDate,
        posting_date: postDate,
        description: description.trim(),
        merchant_name: extractMerchant(description),
        amount,
        currency: 'CAD',
      });
    }
  }

  // Also try a more generic pattern for amounts
  if (transactions.length === 0) {
    const genericPattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})/;
    for (const line of lines) {
      const match = line.trim().match(genericPattern);
      if (match) {
        const [, dateStr, description, amountStr] = match;
        const amount = parseAmount(amountStr);
        if (amount === null) continue;

        transactions.push({
          transaction_date: normalizeDate(dateStr),
          posting_date: null,
          description: description.trim(),
          merchant_name: extractMerchant(description),
          amount: Math.abs(amount),
          currency: 'CAD',
        });
      }
    }
  }

  return transactions;
}

function normalizeDate(dateStr) {
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length !== 3) return dateStr;
  let [m, d, y] = parts;
  if (y.length === 2) y = '20' + y;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function extractMerchant(description) {
  // Remove location suffixes, card numbers, etc.
  return description
    .replace(/\s+[A-Z]{2}\s*$/, '') // trailing province codes
    .replace(/\s+#\d+.*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const EXTRACT_PROMPT = `Extract ALL financial transactions from this bank/credit card statement. Return ONLY a JSON array, no explanation, no markdown fences.

Each item must have:
- transaction_date: string YYYY-MM-DD
- description: string (merchant name + details)
- amount: integer in cents (e.g. $18.74 = 1874), always positive
- currency: string (CAD or USD)
- is_credit: boolean (true for payments/refunds/credits, false for purchases/debits)

Include every transaction. Do not skip any.`;

async function callOpenRouter(messages, apiKey, model) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, temperature: 0.1 }),
  });
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

function parseTransactionJSON(content) {
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];
  const parsed = JSON.parse(jsonMatch[0]);
  return parsed.map(t => ({
    transaction_date: t.transaction_date,
    posting_date: null,
    description: String(t.description || '').trim(),
    merchant_name: extractMerchant(String(t.description || '')),
    amount: t.is_credit ? -Math.abs(t.amount) : Math.abs(t.amount),
    currency: t.currency || 'CAD',
  })).filter(t => t.description && t.amount !== 0);
}

// Stage 1: text extraction via gpt-4o-mini (cheap)
async function parsePdfWithAI(rawText, apiKey) {
  try {
    console.log('Stage 1: AI text extraction...');
    const content = await callOpenRouter([
      { role: 'system', content: 'You are a financial data extraction assistant. Return ONLY a JSON array, nothing else.' },
      { role: 'user', content: EXTRACT_PROMPT + '\n\nStatement text:\n' + rawText.substring(0, 12000) }
    ], apiKey, 'openai/gpt-4.1-nano');
    const transactions = parseTransactionJSON(content);
    console.log('Stage 1 extracted', transactions.length, 'transactions');
    return transactions;
  } catch (err) {
    console.error('Stage 1 AI parse error:', err.message);
    return [];
  }
}

// Stage 2: native PDF model — Gemini reads the PDF directly as a file
async function parsePdfWithGemini(buffer, apiKey, model = 'google/gemini-2.5-flash-preview') {
  try {
    console.log('Stage 2: Gemini native PDF model...');
    const base64 = buffer.toString('base64');
    // Gemini 1.5 Flash supports native PDF input via file_data
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'file',
              file: {
                filename: 'statement.pdf',
                file_data: `data:application/pdf;base64,${base64}`
              }
            },
            {
              type: 'text',
              text: EXTRACT_PROMPT
            }
          ]
        }]
      })
    });
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const transactions = parseTransactionJSON(content);
    console.log('Stage 2 (Gemini) extracted', transactions.length, 'transactions');
    return transactions;
  } catch (err) {
    console.error('Stage 2 Gemini parse error:', err.message);
    return [];
  }
}

async function parsePdf(buffer, apiKey) {
  let rawText = '';
  try {
    const data = await pdfParse(buffer);
    rawText = data.text || '';
  } catch (err) {
    console.log('pdf-parse failed:', err.message, '— skipping text extraction, going straight to AI vision');
  }

  if (!apiKey) {
    return { rawText, transactions: parseRBCPdf(rawText) };
  }

  // Stage 1: GPT-4.1 Nano reads extracted text (fast, cheap)
  let transactions = await parsePdfWithAI(rawText, apiKey);

  // Stage 2: Gemini 2.5 Flash — native PDF understanding
  if (transactions.length === 0) {
    console.log('Stage 1 got nothing — trying Gemini 2.5 Flash');
    transactions = await parsePdfWithGemini(buffer, apiKey, 'google/gemini-2.5-flash-preview');
  }

  // Stage 3: Gemini 2.5 Pro — maximum accuracy
  if (transactions.length === 0) {
    console.log('Stage 2 got nothing — escalating to Gemini 2.5 Pro');
    transactions = await parsePdfWithGemini(buffer, apiKey, 'google/gemini-2.5-pro-preview-03-25');
  }

  // Stage 4: report failure
  if (transactions.length === 0) {
    console.error('All stages failed — could not extract transactions from PDF');
    return { rawText, transactions: [], error: 'Could not extract transactions after 3 attempts. Please try a different file format or contact support.' };
  }

  return { rawText, transactions };
}

function parseCsv(buffer) {
  const text = buffer.toString('utf-8');
  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });

  const transactions = [];
  for (const row of records) {
    // Try common CSV column names
    const date = row['Date'] || row['Transaction Date'] || row['date'] || row['transaction_date'] || Object.values(row)[0];
    const desc = row['Description'] || row['Merchant'] || row['description'] || row['merchant'] || row['Name'] || Object.values(row)[1];
    const amountStr = row['Amount'] || row['Debit'] || row['amount'] || row['debit'] || Object.values(row)[2];

    if (!date || !desc || !amountStr) continue;

    const amount = parseAmount(amountStr);
    if (amount === null) continue;

    transactions.push({
      transaction_date: normalizeDate(date),
      posting_date: null,
      description: desc.trim(),
      merchant_name: extractMerchant(desc),
      amount: Math.abs(amount),
      currency: 'CAD',
    });
  }

  return { rawText: text, transactions };
}

async function parseImageTransactions(imagePath, apiKey) {
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64 = imageBuffer.toString('base64');
    const ext = path.extname(imagePath).toLowerCase().replace('.', '');
    const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64}` },
            },
            {
              type: 'text',
              text: 'Extract all financial transactions from this bank screenshot. Return JSON array with fields: transaction_date (YYYY-MM-DD), description, amount (number, positive for debits/purchases, negative for credits/payments), currency (default CAD). Only return the JSON array, nothing else.',
            },
          ],
        }],
        temperature: 0.1,
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    // Extract JSON from response (may be wrapped in markdown code block)
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return { transactions: [], error: 'No transactions found in image' };

    const parsed = JSON.parse(jsonMatch[0]);
    const transactions = parsed.map(t => ({
      transaction_date: t.transaction_date,
      posting_date: null,
      description: t.description,
      merchant_name: extractMerchant(t.description),
      amount: Math.round(Math.abs(t.amount) * 100) * (t.amount < 0 ? -1 : 1),
      currency: t.currency || 'CAD',
    }));

    return { transactions, error: null };
  } catch (err) {
    return { transactions: [], error: err.message };
  }
}

function deduplicateTransactions(newTransactions) {
  const checkStmt = db.prepare(
    `SELECT id, merchant_name, description FROM transactions
     WHERE transaction_date = ? AND amount = ?`
  );

  const inserted = [];
  const duplicates = [];
  const flagged = [];

  for (const t of newTransactions) {
    const matches = checkStmt.all(t.transaction_date, t.amount);
    if (matches.length === 0) {
      inserted.push(t);
      continue;
    }

    const merchantPrefix = (t.merchant_name || t.description || '').substring(0, 20).toLowerCase();
    const isExactMatch = matches.some(m => {
      const existingMerchant = (m.merchant_name || m.description || '').substring(0, 20).toLowerCase();
      return existingMerchant === merchantPrefix;
    });

    if (isExactMatch) {
      duplicates.push(t);
    } else {
      flagged.push(t);
    }
  }

  return { inserted, duplicates, flagged };
}

const METADATA_PROMPT = `Extract account and statement metadata from this bank/credit card statement. Return ONLY a JSON object, no explanation, no markdown fences.

The object must have these fields (use null if not found):
- account_holder: string (full name on statement)
- institution: string (bank name, e.g. "RBC Royal Bank", "TD Canada Trust")
- account_type: "credit" | "debit" | "investment"
- card_type: string (Visa, Mastercard, Amex, etc) or null
- account_number_last4: string (last 4 digits of account/card number) or null
- statement_period_start: string YYYY-MM-DD
- statement_period_end: string YYYY-MM-DD
- opening_balance: integer in cents (e.g. $696.51 = 69651)
- closing_balance: integer in cents
- total_debits: integer in cents (total purchases/charges)
- total_credits: integer in cents (total payments/refunds)
- minimum_payment: integer in cents or null
- payment_due_date: string YYYY-MM-DD or null
- credit_limit: integer in cents or null
- available_credit: integer in cents or null
- currency: string (CAD or USD)`;

async function extractStatementMetadata(rawText, apiKey) {
  try {
    const content = await callOpenRouter([
      { role: 'system', content: 'You are a financial data extraction assistant. Return ONLY a JSON object, nothing else.' },
      { role: 'user', content: METADATA_PROMPT + '\n\nStatement text:\n' + rawText.substring(0, 12000) }
    ], apiKey, 'openai/gpt-4.1-nano');

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('Metadata extraction error:', err.message);
    return null;
  }
}

module.exports = { parsePdf, parseCsv, parseRBCPdf, parseImageTransactions, deduplicateTransactions, extractStatementMetadata };
