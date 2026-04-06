const pdfParse = require('pdf-parse');
const { parse } = require('csv-parse/sync');

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

async function parsePdf(buffer) {
  const data = await pdfParse(buffer);
  const rawText = data.text;
  const transactions = parseRBCPdf(rawText);
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

module.exports = { parsePdf, parseCsv, parseRBCPdf };
