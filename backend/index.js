require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

// Multi-user middleware: read X-User-Id header, default to 1
app.use((req, res, next) => {
  req.userId = parseInt(req.headers['x-user-id']) || 1;
  next();
});

// Users API
const db = require('./db');
app.get('/api/users', (req, res) => {
  const users = db.prepare('SELECT id, name, emoji FROM users ORDER BY id').all();
  res.json(users);
});
app.post('/api/users', (req, res) => {
  const { name, emoji, telegram_bot_token, telegram_user_id } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const r = db.prepare('INSERT INTO users (name, emoji, telegram_bot_token, telegram_user_id) VALUES (?, ?, ?, ?)').run(
    name, emoji || '👤', telegram_bot_token || null, telegram_user_id || null
  );
  res.json({ id: r.lastInsertRowid });

  // Hot-start the new user's bot if token provided
  if (telegram_bot_token) {
    try { require('./services/telegramBot').startBotForUser({ id: r.lastInsertRowid, telegram_bot_token, telegram_user_id }); } catch (e) {}
  }
});

// Routes
app.use('/api/upload', require('./routes/upload'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/budgets', require('./routes/budgets'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/export', require('./routes/export'));
app.use('/api/admin', require('./routes/admin'));

// Serve frontend in production
const distPath = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(distPath, 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`MoneyGuy 2.0 backend running on http://localhost:${PORT}`);
});

// Start Telegram bots for all users
require('./services/telegramBot').startAll();
