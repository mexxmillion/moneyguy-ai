require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/upload', require('./routes/upload'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/accounts', require('./routes/accounts'));
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

// Start Telegram bot
if (process.env.TELEGRAM_BOT_TOKEN) {
  require('./services/telegramBot');
}
