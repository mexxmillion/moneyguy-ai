const express = require('express');
const db = require('../db');
const router = express.Router();

const RESET_PIN = process.env.RESET_PIN || '1234';

// GET /api/admin/stats — basic DB stats
router.get('/stats', (req, res) => {
  const transactions = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE user_id = ?').get(req.userId);
  const statements = db.prepare('SELECT COUNT(*) as count FROM statements WHERE user_id = ?').get(req.userId);
  const accounts = db.prepare('SELECT COUNT(*) as count FROM accounts WHERE user_id = ?').get(req.userId);
  const oldest = db.prepare('SELECT MIN(transaction_date) as date FROM transactions WHERE user_id = ?').get(req.userId);
  const newest = db.prepare('SELECT MAX(transaction_date) as date FROM transactions WHERE user_id = ?').get(req.userId);
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
      // Only wipe transactions + statements for this user
      db.prepare('DELETE FROM transactions WHERE user_id = ?').run(req.userId);
      db.prepare('DELETE FROM statements WHERE user_id = ?').run(req.userId);
      res.json({ ok: true, message: 'All transactions and statements deleted.' });
    } else if (scope === 'all') {
      // Nuclear option — wipe everything for this user
      db.prepare('DELETE FROM transactions WHERE user_id = ?').run(req.userId);
      db.prepare('DELETE FROM statements WHERE user_id = ?').run(req.userId);
      db.prepare('DELETE FROM accounts WHERE user_id = ?').run(req.userId);
      // Keep categories and merchant_rules (shared)
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

  const total = db.prepare('SELECT COUNT(*) as count FROM audit_log WHERE user_id = ?').get(req.userId).count;
  const entries = db.prepare(
    'SELECT * FROM audit_log WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(req.userId, limit, offset);

  // Parse metadata JSON for convenience
  for (const entry of entries) {
    if (entry.metadata) {
      try { entry.metadata = JSON.parse(entry.metadata); } catch (e) { /* keep as string */ }
    }
  }

  res.json({ entries, total, page, limit, pages: Math.ceil(total / limit) });
});

module.exports = router;
