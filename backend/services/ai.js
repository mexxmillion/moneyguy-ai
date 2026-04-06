const db = require('../db');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const SCHEMA_DESCRIPTION = `
Database schema:
- accounts (id, name, institution, type: credit/debit/investment, currency, account_number_last4, card_type, credit_limit INTEGER cents, is_active)
- statements (id, account_id, filename, period_start, period_end, opening_balance, closing_balance, total_debits, total_credits, minimum_payment, payment_due_date, credit_limit, available_credit, imported_at, source_file_hash)
- transactions (id, statement_id, account_id, transaction_date, posting_date, description, merchant_name, amount INTEGER in cents, currency, category, subcategory, is_reviewed, notes, created_at)
- categories (id, name, parent_id, color, icon)
- merchant_rules (id, merchant_pattern, category_id, priority)
- audit_log (id, event_type, entity_type, entity_id, description, metadata, created_at)

IMPORTANT: amounts are stored as integers in cents. To display dollars, divide by 100.0.
When user asks for account details, SELECT all relevant columns: name, institution, type, account_number_last4, card_type, credit_limit/100.0, currency.
When user asks for statement details, include period_start, period_end, closing_balance/100.0, payment_due_date, minimum_payment/100.0.
Categories include: Groceries, Dining, Transport/Parking, Subscriptions, Shopping, Entertainment, Auto/Mechanic, Interest/Fees, Payments, Uncategorized.
`;

async function queryAI(userQuestion, apiKey, userId = 1) {
  const systemPrompt = `You are MoneyGuy's SQL brain. Convert the user's finance question into a precise SQLite query.
You must respond with a JSON object containing:
- "sql": a safe, READ-ONLY SQLite query (SELECT only, no INSERT/UPDATE/DELETE/DROP)
- "explanation": a brief explanation of what you're querying

${SCHEMA_DESCRIPTION}

CRITICAL: This is a multi-user system. Always filter by user_id = ${userId} on accounts, transactions, statements, and budgets tables. Never return data from other users.

When querying amounts, remember they are in cents. Use amount/100.0 for dollar display.
Use LIKE with % for fuzzy merchant matching.
Always respond with valid JSON only, no markdown.`;

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3002',
      'X-Title': 'MoneyGuy 2.0',
    },
    body: JSON.stringify({
      model: 'openai/gpt-4.1-nano',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userQuestion },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) throw new Error('No response from AI');

  // Parse the JSON response
  let parsed;
  try {
    // Try to extract JSON from potential markdown code blocks
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
    parsed = JSON.parse(jsonMatch[1].trim());
  } catch {
    throw new Error(`Failed to parse AI response: ${content}`);
  }

  // Validate the SQL is read-only
  const sqlUpper = parsed.sql.toUpperCase().trim();
  const forbidden = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'ATTACH', 'DETACH'];
  for (const word of forbidden) {
    if (sqlUpper.includes(word)) {
      throw new Error(`AI generated unsafe SQL containing ${word}`);
    }
  }

  return { sql: parsed.sql, explanation: parsed.explanation };
}

function executeQuery(sql) {
  try {
    const stmt = db.prepare(sql);
    const rows = stmt.all();
    return { rows, error: null };
  } catch (err) {
    return { rows: [], error: err.message };
  }
}

async function summarizeResults(question, rows, sql, apiKey) {
  const preview = JSON.stringify(rows.slice(0, 20));

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3002',
      'X-Title': 'MoneyGuy 2.0',
    },
    body: JSON.stringify({
      model: 'openai/gpt-4.1-nano',
      messages: [
        { role: 'system', content: `You are MoneyGuy — sharp, direct, zero fluff. Lead with the answer. When the user asks for details, LIST them specifically: account name, institution, type, last 4 digits, credit limit, balance, etc — whatever is available in the data. Format as a clean bullet list for multiple items. Numbers first, commentary only if it actually matters (overspending, interest, something suspicious). No cheerleading, no filler. Speak human, not database — never say "1 row" or show raw field names like "account_number_last4". Use $ signs and real names.` },
        { role: 'user', content: `Question: ${question}\nSQL: ${sql}\nResults (${rows.length} rows): ${preview}` },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) return 'Could not generate summary.';

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'No summary available.';
}

module.exports = { queryAI, executeQuery, summarizeResults };
