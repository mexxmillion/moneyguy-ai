const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const {
    page = 1, limit = 50, sort = 'transaction_date', order = 'DESC',
    category, merchant, search, date_from, date_to,
    amount_min, amount_max, account_id,
  } = req.query;

  const conditions = [];
  const params = [];

  if (category) { conditions.push('t.category = ?'); params.push(category); }
  if (merchant) { conditions.push('t.merchant_name LIKE ?'); params.push(`%${merchant}%`); }
  if (search) { conditions.push('t.description LIKE ?'); params.push(`%${search}%`); }
  if (date_from) { conditions.push('t.transaction_date >= ?'); params.push(date_from); }
  if (date_to) { conditions.push('t.transaction_date <= ?'); params.push(date_to); }
  if (amount_min) { conditions.push('t.amount >= ?'); params.push(Math.round(parseFloat(amount_min) * 100)); }
  if (amount_max) { conditions.push('t.amount <= ?'); params.push(Math.round(parseFloat(amount_max) * 100)); }
  if (account_id) { conditions.push('t.account_id = ?'); params.push(parseInt(account_id)); }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const allowedSorts = ['transaction_date', 'amount', 'merchant_name', 'category', 'created_at'];
  const sortCol = allowedSorts.includes(sort) ? sort : 'transaction_date';
  const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM transactions t ${where}`).get(...params);
  const rows = db.prepare(`
    SELECT t.*, a.name as account_name
    FROM transactions t
    LEFT JOIN accounts a ON a.id = t.account_id
    ${where}
    ORDER BY t.${sortCol} ${sortOrder}
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  res.json({
    transactions: rows,
    total: countRow.total,
    page: parseInt(page),
    totalPages: Math.ceil(countRow.total / parseInt(limit)),
  });
});

// Update transaction
router.patch('/:id', (req, res) => {
  const { category, subcategory, notes, is_reviewed } = req.body;
  const sets = [];
  const params = [];

  if (category !== undefined) { sets.push('category = ?'); params.push(category); }
  if (subcategory !== undefined) { sets.push('subcategory = ?'); params.push(subcategory); }
  if (notes !== undefined) { sets.push('notes = ?'); params.push(notes); }
  if (is_reviewed !== undefined) { sets.push('is_reviewed = ?'); params.push(is_reviewed ? 1 : 0); }

  if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update' });

  params.push(req.params.id);
  db.prepare(`UPDATE transactions SET ${sets.join(', ')} WHERE id = ?`).run(...params);

  const updated = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// Bulk re-categorize
router.post('/bulk-categorize', (req, res) => {
  const { ids, category } = req.body;
  if (!ids || !Array.isArray(ids) || !category) {
    return res.status(400).json({ error: 'ids (array) and category required' });
  }

  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`UPDATE transactions SET category = ? WHERE id IN (${placeholders})`).run(category, ...ids);
  res.json({ updated: ids.length });
});

// Get categories
router.get('/categories', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories').all();
  res.json(categories);
});

router.get('/filters', (req, res) => {
  const accounts = db.prepare(`
    SELECT id, name, institution, type
    FROM accounts
    WHERE is_active = 1
    ORDER BY COALESCE(institution, ''), name
  `).all();

  res.json({
    accounts: accounts.map(account => ({
      id: account.id,
      name: account.institution ? `${account.institution} • ${account.name}` : account.name,
      type: account.type,
    })),
  });
});

// Dashboard stats
router.get('/stats', (req, res) => {
  const { month, year } = req.query;
  let dateFilter = '';
  const params = [];

  if (month && year) {
    dateFilter = "WHERE t.transaction_date LIKE ?";
    params.push(`${year}-${month.padStart(2, '0')}%`);
  }

  // Spending by category
  const byCategory = db.prepare(`
    SELECT category, SUM(amount) as total, COUNT(*) as count
    FROM transactions t ${dateFilter}
    ${dateFilter ? 'AND' : 'WHERE'} category != 'Payments'
    GROUP BY category ORDER BY total DESC
  `).all(...params);

  // Top merchants
  const topMerchants = db.prepare(`
    SELECT merchant_name, SUM(amount) as total, COUNT(*) as count
    FROM transactions t ${dateFilter}
    ${dateFilter ? 'AND' : 'WHERE'} category != 'Payments'
    GROUP BY merchant_name ORDER BY total DESC LIMIT 10
  `).all(...params);

  // Daily spending
  const dailySpending = db.prepare(`
    SELECT transaction_date, SUM(amount) as total
    FROM transactions t ${dateFilter}
    ${dateFilter ? 'AND' : 'WHERE'} category != 'Payments'
    GROUP BY transaction_date ORDER BY transaction_date
  `).all(...params);

  // Quick stats
  const totalSpent = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM transactions t ${dateFilter}
    ${dateFilter ? 'AND' : 'WHERE'} category != 'Payments' AND amount > 0
  `).get(...params);

  const totalPaid = db.prepare(`
    SELECT COALESCE(SUM(ABS(amount)), 0) as total FROM transactions t
    ${dateFilter ? dateFilter + ' AND' : 'WHERE'} category = 'Payments'
  `).get(...params);

  const biggest = db.prepare(`
    SELECT * FROM transactions t ${dateFilter}
    ${dateFilter ? 'AND' : 'WHERE'} category != 'Payments'
    ORDER BY amount DESC LIMIT 1
  `).get(...params);

  const mostVisited = db.prepare(`
    SELECT merchant_name, COUNT(*) as visits FROM transactions t ${dateFilter}
    ${dateFilter ? 'AND' : 'WHERE'} category != 'Payments'
    GROUP BY merchant_name ORDER BY visits DESC LIMIT 1
  `).get(...params);

  const totalTransactions = db.prepare(`
    SELECT COUNT(*) as count FROM transactions t ${dateFilter}
  `).get(...params);

  res.json({
    byCategory,
    topMerchants,
    dailySpending,
    totalSpent: totalSpent.total,
    totalPaid: totalPaid.total,
    biggestPurchase: biggest || null,
    mostVisitedMerchant: mostVisited || null,
    totalTransactions: totalTransactions.count,
  });
});

// Summary stats for current filter (sum, min, max, avg, count + trends)
router.get('/summary', (req, res) => {
  const {
    category, merchant, search, date_from, date_to,
    amount_min, amount_max, account_id,
  } = req.query;

  const conditions = [];
  const params = [];

  if (category) { conditions.push('t.category = ?'); params.push(category); }
  if (merchant) { conditions.push('t.merchant_name LIKE ?'); params.push(`%${merchant}%`); }
  if (search) { conditions.push('t.description LIKE ?'); params.push(`%${search}%`); }
  if (date_from) { conditions.push('t.transaction_date >= ?'); params.push(date_from); }
  if (date_to) { conditions.push('t.transaction_date <= ?'); params.push(date_to); }
  if (amount_min) { conditions.push('t.amount >= ?'); params.push(Math.round(parseFloat(amount_min) * 100)); }
  if (amount_max) { conditions.push('t.amount <= ?'); params.push(Math.round(parseFloat(amount_max) * 100)); }
  if (account_id) { conditions.push('t.account_id = ?'); params.push(parseInt(account_id)); }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  // Core stats (charges only — exclude credits/payments)
  const core = db.prepare(`
    SELECT
      COUNT(*) as count,
      COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as sum,
      COALESCE(MIN(CASE WHEN amount > 0 THEN amount END), 0) as min,
      COALESCE(MAX(CASE WHEN amount > 0 THEN amount END), 0) as max,
      COALESCE(AVG(CASE WHEN amount > 0 THEN amount END), 0) as avg,
      COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as total_credits
    FROM transactions t ${where}
  `).get(...params);

  // Biggest single expense
  const biggest = db.prepare(`
    SELECT merchant_name, amount, transaction_date, category
    FROM transactions t ${where}
    ${where ? 'AND' : 'WHERE'} amount > 0
    ORDER BY amount DESC LIMIT 1
  `).get(...params);

  // Most frequent merchant
  const topMerchant = db.prepare(`
    SELECT merchant_name, COUNT(*) as visits, SUM(amount) as total
    FROM transactions t ${where}
    ${where ? 'AND' : 'WHERE'} amount > 0
    GROUP BY merchant_name ORDER BY visits DESC LIMIT 1
  `).get(...params);

  // Spending by day of week
  const byDow = db.prepare(`
    SELECT
      CAST(strftime('%w', transaction_date) AS INTEGER) as dow,
      SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total,
      COUNT(*) as count
    FROM transactions t ${where}
    GROUP BY dow ORDER BY dow
  `).all(...params);

  // Spending by month (trend)
  const byMonth = db.prepare(`
    SELECT
      strftime('%Y-%m', transaction_date) as month,
      SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total,
      COUNT(*) as count
    FROM transactions t ${where}
    GROUP BY month ORDER BY month
  `).all(...params);

  // Category breakdown
  const byCategory = db.prepare(`
    SELECT category, SUM(amount) as total, COUNT(*) as count
    FROM transactions t ${where}
    ${where ? 'AND' : 'WHERE'} amount > 0
    GROUP BY category ORDER BY total DESC
  `).all(...params);

  const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dowFull = DOW_LABELS.map((label, i) => {
    const found = byDow.find(d => d.dow === i);
    return { label, total: found ? found.total : 0, count: found ? found.count : 0 };
  });

  res.json({
    count: core.count,
    sum: core.sum,
    min: core.min,
    max: core.max,
    avg: Math.round(core.avg),
    totalCredits: core.total_credits,
    biggest: biggest || null,
    topMerchant: topMerchant || null,
    byDow: dowFull,
    byMonth,
    byCategory,
  });
});

// Merchant rules
router.get('/merchant-rules', (req, res) => {
  const rules = db.prepare(`
    SELECT mr.*, c.name as category_name
    FROM merchant_rules mr
    JOIN categories c ON c.id = mr.category_id
    ORDER BY mr.priority DESC
  `).all();
  res.json(rules);
});

router.post('/merchant-rules', (req, res) => {
  const { merchant_pattern, category_id, priority } = req.body;
  const r = db.prepare('INSERT INTO merchant_rules (merchant_pattern, category_id, priority) VALUES (?, ?, ?)').run(
    merchant_pattern, category_id, priority || 0
  );
  res.json({ id: r.lastInsertRowid });
});

module.exports = router;

// AI auto-categorize uncategorized transactions
router.post('/ai-categorize', async (req, res) => {
  const { ids } = req.body;

  const where = ids && ids.length > 0
    ? `WHERE id IN (${ids.map(() => '?').join(',')}) AND category = 'Uncategorized'`
    : `WHERE category = 'Uncategorized'`;
  const params = ids && ids.length > 0 ? ids : [];

  const rows = db.prepare(`SELECT id, merchant_name, description, amount FROM transactions ${where}`).all(...params);
  if (rows.length === 0) return res.json({ updated: 0, results: [] });

  const categories = db.prepare("SELECT name FROM categories WHERE name != 'Uncategorized'").all().map(c => c.name);

  const txLines = rows.map(r => JSON.stringify({ id: r.id, merchant: r.merchant_name, desc: r.description, amount: r.amount })).join('\n');

  const prompt = `You are a personal finance categorizer. Assign each transaction the best category from: ${categories.join(', ')}.

Rules:
- Monthly fee, service charge, bank fee → Interest/Fees
- e-Transfer, Online Banking transfer → Transfers
- Rent, lease, ECO-WORLD → Housing
- Restaurant, BBQ, sushi, food, eggette, flourist, barbeque, tast → Dining
- Dog, pet, whisker, bark → Shopping
- AMEX, CIBC, Mastercard payment → Payments
- City of, parking, transit, paybyphone → Transport/Parking
- Grocery, market, superstore → Groceries
- Netflix, Spotify, subscription → Subscriptions
- If truly unclear → Uncategorized

Respond ONLY with a JSON array like: [{"id":1,"category":"Dining"}]

Transactions:
${txLines}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'openai/gpt-4.1-nano', messages: [{ role: 'user', content: prompt }], temperature: 0 }),
    });
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return res.status(500).json({ error: 'AI returned no valid JSON', raw: content });

    const results = JSON.parse(jsonMatch[0]);
    const stmt = db.prepare('UPDATE transactions SET category = ? WHERE id = ?');
    let updated = 0;
    for (const { id, category } of results) {
      stmt.run(category, id);
      updated++;
    }
    res.json({ updated, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
