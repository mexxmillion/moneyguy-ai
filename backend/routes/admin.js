const express = require('express');
const db = require('../db');
const router = express.Router();

const RESET_PIN = process.env.RESET_PIN || '1234';

// GET /api/admin/stats — basic DB stats
router.get('/stats', (req, res) => {
  const transactions = db.prepare('SELECT COUNT(*) as count FROM transactions').get();
  const statements = db.prepare('SELECT COUNT(*) as count FROM statements').get();
  const accounts = db.prepare('SELECT COUNT(*) as count FROM accounts').get();
  const oldest = db.prepare('SELECT MIN(transaction_date) as date FROM transactions').get();
  const newest = db.prepare('SELECT MAX(transaction_date) as date FROM transactions').get();
  res.json({
    transactions: transactions.count,
    statements: statements.count,
    accounts: accounts.count,
    dateRange: { from: oldest.date, to: newest.date }
  });
});

// POST /api/admin/reset — wipe all data (PIN required)
router.post('/reset', (req, res) => {
  const { pin, scope } = req.body;

  if (!pin || pin !== RESET_PIN) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }

  try {
    if (scope === 'transactions') {
      // Only wipe transactions + statements, keep accounts/categories/rules
      db.prepare('DELETE FROM transactions').run();
      db.prepare('DELETE FROM statements').run();
      res.json({ ok: true, message: 'All transactions and statements deleted.' });
    } else if (scope === 'all') {
      // Nuclear option — wipe everything
      db.prepare('DELETE FROM transactions').run();
      db.prepare('DELETE FROM statements').run();
      db.prepare('DELETE FROM accounts').run();
      db.prepare('DELETE FROM merchant_rules').run();
      // Keep categories (they are just config)
      res.json({ ok: true, message: 'Database fully reset. All data deleted.' });
    } else {
      res.status(400).json({ error: 'scope must be "transactions" or "all"' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/audit — list recent audit log entries
router.get('/audit', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;

  const total = db.prepare('SELECT COUNT(*) as count FROM audit_log').get().count;
  const entries = db.prepare(
    'SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset);

  // Parse metadata JSON for convenience
  for (const entry of entries) {
    if (entry.metadata) {
      try { entry.metadata = JSON.parse(entry.metadata); } catch (e) { /* keep as string */ }
    }
  }

  res.json({ entries, total, page, limit, pages: Math.ceil(total / limit) });
});

module.exports = router;
