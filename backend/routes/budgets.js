const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/budgets?month=4&year=2026
// Returns all budgets with spent amount for the given month
router.get('/', (req, res) => {
  const now = new Date();
  const month = String(req.query.month || now.getMonth() + 1).padStart(2, '0');
  const year = String(req.query.year || now.getFullYear());
  const prefix = `${year}-${month}`;

  // All active budgets
  const budgets = db.prepare(`
    SELECT id, category, monthly_limit, is_active
    FROM budgets
    WHERE is_active = 1 AND user_id = ?
    ORDER BY category
  `).all(req.userId);

  // Actual spending per category for the month (positive amounts = spending)
  const spendingRows = db.prepare(`
    SELECT category, SUM(amount) AS total
    FROM transactions
    WHERE user_id = ? AND transaction_date LIKE ? || '-%'
      AND amount > 0
    GROUP BY category
  `).all(req.userId, prefix);

  const spendingMap = new Map(spendingRows.map(r => [r.category, r.total || 0]));

  // Also pull categories with spending but no budget (to show alerts)
  const allSpendingRows = db.prepare(`
    SELECT category, SUM(amount) AS total
    FROM transactions
    WHERE user_id = ? AND transaction_date LIKE ? || '-%'
      AND amount > 0
      AND category IS NOT NULL
      AND category != ''
    GROUP BY category
    ORDER BY total DESC
  `).all(req.userId, prefix);

  const budgetCategories = new Set(budgets.map(b => b.category));
  const unbudgeted = allSpendingRows
    .filter(r => !budgetCategories.has(r.category))
    .slice(0, 5); // top 5 unbudgeted categories

  const results = budgets.map(b => {
    const spent = spendingMap.get(b.category) || 0;
    const limit = b.monthly_limit;
    const remaining = limit - spent;
    const pct = limit > 0 ? Math.min(Math.round((spent / limit) * 100), 100) : 0;
    const status = pct >= 100 ? 'over' : pct >= 80 ? 'warning' : 'ok';

    return {
      id: b.id,
      category: b.category,
      monthlyLimit: limit,
      spent,
      remaining,
      pct,
      status, // 'ok' | 'warning' | 'over'
    };
  });

  // Summary
  const totalLimit = results.reduce((s, b) => s + b.monthlyLimit, 0);
  const totalSpent = results.reduce((s, b) => s + b.spent, 0);

  res.json({
    month: `${year}-${month}`,
    summary: { totalLimit, totalSpent, remaining: totalLimit - totalSpent },
    budgets: results,
    unbudgeted,
  });
});

// POST /api/budgets — create or update a budget
router.post('/', (req, res) => {
  const { category, monthly_limit } = req.body;
  if (!category || monthly_limit == null) {
    return res.status(400).json({ error: 'category and monthly_limit required' });
  }
  const limit = Math.round(Number(monthly_limit));
  if (isNaN(limit) || limit < 0) {
    return res.status(400).json({ error: 'monthly_limit must be a non-negative number (cents)' });
  }

  db.prepare(`
    INSERT INTO budgets (user_id, category, monthly_limit)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, category) DO UPDATE SET monthly_limit = excluded.monthly_limit, is_active = 1
  `).run(req.userId, category, limit);

  res.json({ ok: true });
});

// DELETE /api/budgets/:id
router.delete('/:id', (req, res) => {
  db.prepare('UPDATE budgets SET is_active = 0 WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

module.exports = router;
