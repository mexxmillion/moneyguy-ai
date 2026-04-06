const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const db = require('../db');

function hashPin(pin) {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

function generateToken() {
  return crypto.randomUUID() + '-' + crypto.randomBytes(16).toString('hex');
}

// POST /api/auth/login — { user_id, pin }
router.post('/login', (req, res) => {
  const { user_id, pin } = req.body;
  if (!user_id || !pin) return res.status(400).json({ error: 'user_id and pin required' });

  const user = db.prepare('SELECT id, name, emoji, pin_hash FROM users WHERE id = ?').get(user_id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!user.pin_hash) return res.status(400).json({ error: 'PIN not set. Please set up your PIN first.' });

  if (hashPin(pin) !== user.pin_hash) {
    return res.status(401).json({ error: 'Incorrect PIN' });
  }

  const token = generateToken();
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);

  // Clean up old sessions (keep last 10 per user)
  db.prepare(`
    DELETE FROM sessions WHERE user_id = ? AND token NOT IN (
      SELECT token FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 10
    )
  `).run(user.id, user.id);

  res.json({ token, user: { id: user.id, name: user.name, emoji: user.emoji } });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  res.json({ ok: true });
});

// GET /api/auth/me — check session validity
router.get('/me', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  const session = db.prepare(`
    SELECT s.user_id, u.name, u.emoji FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ?
  `).get(token);

  if (!session) return res.status(401).json({ error: 'Invalid session' });

  res.json({ user: { id: session.user_id, name: session.name, emoji: session.emoji } });
});

// POST /api/auth/set-pin — { user_id, pin, current_pin? }
router.post('/set-pin', (req, res) => {
  const { user_id, pin, current_pin } = req.body;
  if (!user_id || !pin) return res.status(400).json({ error: 'user_id and pin required' });
  if (pin.length < 4) return res.status(400).json({ error: 'PIN must be at least 4 characters' });

  const user = db.prepare('SELECT id, pin_hash FROM users WHERE id = ?').get(user_id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // If PIN already set, require current PIN to change it
  if (user.pin_hash) {
    if (!current_pin) return res.status(400).json({ error: 'Current PIN required to change PIN' });
    if (hashPin(current_pin) !== user.pin_hash) return res.status(401).json({ error: 'Incorrect current PIN' });
  }

  db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(hashPin(pin), user_id);
  res.json({ ok: true });
});

// GET /api/auth/users — public user list for login screen (no sensitive data)
router.get('/users', (req, res) => {
  const users = db.prepare('SELECT id, name, emoji, (pin_hash IS NOT NULL) as has_pin FROM users ORDER BY id').all();
  res.json(users);
});

module.exports = router;
