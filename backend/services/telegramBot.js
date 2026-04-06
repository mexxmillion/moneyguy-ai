require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const crypto = require('crypto');
const TelegramBot = require('node-telegram-bot-api');
const { queryAI, executeQuery, summarizeResults } = require('./ai');
const { parsePdf, parseCsv, parseImageTransactions, deduplicateTransactions } = require('./parser');
const { categorizeAll } = require('./categorizer');
const PDFDocument = require('pdfkit');
const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const db = require('../db');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const activeBots = new Map(); // botToken -> TelegramBot instance

function formatAmount(cents) {
  return '$' + (cents / 100).toFixed(2);
}

function formatRows(rows, maxRows = 15) {
  if (!rows || rows.length === 0) return 'No results found.';
  const display = rows.slice(0, maxRows);
  const lines = display.map(row => {
    if (row.transaction_date && row.merchant_name && row.amount !== undefined) {
      return row.transaction_date + ' | ' + row.merchant_name + ' | ' + formatAmount(row.amount) + ' | ' + (row.category || '—');
    }
    return Object.entries(row).map(([k, v]) => k + ': ' + v).join(' | ');
  });
  let text = lines.join('\n');
  if (rows.length > maxRows) text += '\n\n...and ' + (rows.length - maxRows) + ' more rows';
  return text;
}

async function generatePDF(question, rows, summary, sql) {
  const tmpFile = path.join(os.tmpdir(), 'moneyguy-export-' + Date.now() + '.pdf');
  const doc = new PDFDocument({ margin: 40 });
  const stream = fs.createWriteStream(tmpFile);
  doc.pipe(stream);

  doc.fontSize(18).font('Helvetica-Bold').text('MoneyGuy 2.0 — Query Export', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica').fillColor('#666').text('Generated: ' + new Date().toLocaleString(), { align: 'center' });
  doc.moveDown();

  doc.fontSize(13).font('Helvetica-Bold').fillColor('#000').text('Question:');
  doc.fontSize(11).font('Helvetica').text(question);
  doc.moveDown();

  doc.fontSize(13).font('Helvetica-Bold').text('AI Summary:');
  doc.fontSize(11).font('Helvetica').text(summary || 'No summary available.');
  doc.moveDown();

  doc.fontSize(10).font('Helvetica-Bold').fillColor('#555').text('SQL Query:');
  doc.fontSize(9).font('Helvetica').fillColor('#333').text(sql || '');
  doc.moveDown();

  doc.fontSize(13).font('Helvetica-Bold').fillColor('#000').text('Results (' + rows.length + ' rows):');
  doc.moveDown(0.3);

  if (rows.length === 0) {
    doc.fontSize(11).font('Helvetica').text('No results found.');
  } else {
    const cols = Object.keys(rows[0]);
    const colWidth = Math.max(80, Math.floor(500 / cols.length));

    doc.fontSize(9).font('Helvetica-Bold');
    let x = 40;
    const headerY = doc.y;
    cols.forEach(col => {
      doc.text(col.toUpperCase(), x, headerY, { width: colWidth, continued: true });
      x += colWidth;
    });
    doc.text('', { continued: false });
    doc.moveDown(0.2);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#ccc');
    doc.moveDown(0.2);

    doc.fontSize(8).font('Helvetica');
    rows.slice(0, 100).forEach(row => {
      x = 40;
      const rowY = doc.y;
      cols.forEach(col => {
        let val = row[col];
        if (col === 'amount' && typeof val === 'number') val = formatAmount(val);
        doc.text(String(val != null ? val : '—'), x, rowY, { width: colWidth, continued: true });
        x += colWidth;
      });
      doc.text('', { continued: false });
      if (doc.y > 750) doc.addPage();
    });

    if (rows.length > 100) {
      doc.moveDown().fontSize(9).fillColor('#666').text('(Showing 100 of ' + rows.length + ' rows)');
    }
  }

  doc.end();
  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(tmpFile));
    stream.on('error', reject);
  });
}

// --- File ingestion helpers ---

function downloadTelegramFile(botToken, filePath) {
  const url = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
  const tmpFile = path.join(os.tmpdir(), `moneyguy-${Date.now()}-${path.basename(filePath)}`);
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(tmpFile);
    https.get(url, (res) => {
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(tmpFile); });
    }).on('error', (err) => { fs.unlink(tmpFile, () => {}); reject(err); });
  });
}

function getDefaultAccount(userId) {
  let account = db.prepare('SELECT id FROM accounts WHERE user_id = ? LIMIT 1').get(userId);
  if (!account) {
    const r = db.prepare("INSERT INTO accounts (user_id, name, institution, type) VALUES (?, 'Default Account', 'Unknown', 'credit')").run(userId);
    account = { id: r.lastInsertRowid };
  }
  return account;
}

async function processAndInsert(transactions, filename, accountId, userId, notes) {
  const categorized = categorizeAll(transactions);
  if (notes) for (const t of categorized) t.notes = notes;

  const { inserted, duplicates, flagged } = deduplicateTransactions(categorized);
  const toInsert = [...inserted, ...flagged];

  if (toInsert.length > 0) {
    const stmt = db.prepare('INSERT INTO statements (user_id, account_id, filename, raw_text) VALUES (?, ?, ?, ?)');
    const stmtResult = stmt.run(userId, accountId, filename, `[telegram: ${filename}]`);
    const statementId = stmtResult.lastInsertRowid;

    const insertTx = db.prepare(`
      INSERT INTO transactions (user_id, statement_id, account_id, transaction_date, posting_date, description, merchant_name, amount, currency, category, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertMany = db.transaction((txns) => {
      for (const t of txns) {
        insertTx.run(userId, statementId, accountId, t.transaction_date, t.posting_date,
          t.description, t.merchant_name, t.amount, t.currency, t.category, t.notes || null);
      }
    });
    insertMany(toInsert);
  }

  return {
    imported: inserted.length,
    duplicates: duplicates.length,
    flagged: flagged.length,
    transactions: toInsert,
  };
}

function formatImportSummary(stats) {
  const parts = [];

  if (stats.alreadyImported) {
    parts.push('⏭️ Already seen this file!');
    if (stats.firstImportedAt) parts.push(`First imported: ${stats.firstImportedAt}`);
    if (stats.accountName) parts.push(`Account: ${stats.accountName}`);
    if (stats.period) parts.push(`Period: ${stats.period}`);
    parts.push('Nothing new added.');
    return parts.join('\n');
  }

  if (stats.accountName) {
    parts.push(`🏦 Account: ${stats.accountName}${stats.isNewAccount ? ' (new)' : ''}`);
  }
  if (stats.period) {
    parts.push(`📅 Period: ${stats.period}`);
  }
  if (stats.closingBalance !== undefined) {
    parts.push(`💳 Balance: ${formatAmount(stats.closingBalance)}`);
  }
  if (stats.paymentDueDate) {
    parts.push(`⏰ Due: ${stats.paymentDueDate} — min ${formatAmount(stats.minimumPayment || 0)}`);
  }
  parts.push('');

  parts.push(`✅ Imported ${stats.imported} new transactions`);
  if (stats.duplicates > 0) parts.push(`⏭️ ${stats.duplicates} duplicates skipped`);
  if (stats.flagged > 0) parts.push(`⚠️ ${stats.flagged} flagged for review`);

  if (stats.transactions && stats.transactions.length > 0) {
    const txns = stats.transactions;
    parts.push('');

    if (txns.length <= 8) {
      parts.push('📋 Transactions:');
      txns.forEach(t => {
        const sign = t.amount < 0 ? '-' : '';
        parts.push(`  ${t.transaction_date} | ${t.merchant_name || t.description} | ${sign}${formatAmount(Math.abs(t.amount))} | ${t.category || '—'}`);
      });
    } else {
      const biggest = [...txns].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)).slice(0, 3);
      const byCategory = txns.reduce((acc, t) => {
        const cat = t.category || 'Other';
        acc[cat] = (acc[cat] || 0) + Math.abs(t.amount);
        return acc;
      }, {});
      const topCats = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 4);
      const total = txns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);

      parts.push(`💸 Total spent: ${formatAmount(total)}`);
      parts.push('');
      parts.push('🏆 Top categories:');
      topCats.forEach(([cat, amt]) => parts.push(`  ${cat}: ${formatAmount(amt)}`));
      parts.push('');
      parts.push('🔥 Biggest purchases:');
      biggest.forEach(t => parts.push(`  ${t.transaction_date} | ${t.merchant_name || t.description} | ${formatAmount(Math.abs(t.amount))}`) );
      parts.push(`\n📊 Full details at http://100.90.81.105:5173`);
    }
  }

  if (stats.error) parts.push(`\n❌ ${stats.error}`);
  return parts.join('\n');
}

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

/**
 * Register all event handlers for a single bot instance tied to a user.
 */
function registerBotHandlers(bot, user) {
  const userId = user.id;
  const botToken = user.telegram_bot_token;
  const authorizedTelegramId = user.telegram_user_id;

  function isAuthorized(msg) {
    // If no telegram_user_id is set, capture the first user who messages
    if (!authorizedTelegramId && msg.from) {
      user.telegram_user_id = msg.from.id;
      db.prepare('UPDATE users SET telegram_user_id = ? WHERE id = ?').run(msg.from.id, userId);
      console.log(`Auto-registered Telegram user ${msg.from.id} for ${user.name}`);
      return true;
    }
    return msg.from && msg.from.id === authorizedTelegramId;
  }

  // /start
  bot.onText(/\/start/, (msg) => {
    if (!isAuthorized(msg)) return bot.sendMessage(msg.chat.id, '🚫 Unauthorized.');
    bot.sendMessage(msg.chat.id,
      `💰 MoneyGuy 2.0 is online! (${user.name})\n\n` +
      'Ask me anything about your finances:\n\n' +
      '• "How much did I spend on groceries in February?"\n' +
      '• "Show my biggest purchases last month"\n' +
      '• "What did I spend at T&T?"\n' +
      '• "Total dining expenses by month"\n\n' +
      'Add "as pdf" to any question to get results as a PDF file.\n\n' +
      'Commands:\n' +
      '/start - this help\n' +
      '/summary - this month spending by category\n' +
      '/top - top 10 merchants all time\n' +
      '/setpin <pin> - set web login PIN\n' +
      '/changepin <old> <new> - change PIN\n' +
      '/resetpin - clear PIN for recovery'
    );
  });

  // /summary
  bot.onText(/\/summary/, async (msg) => {
    if (!isAuthorized(msg)) return bot.sendMessage(msg.chat.id, '🚫 Unauthorized.');
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, '📊 Pulling this month\'s summary...');
    try {
      const question = 'Show me total spending by category for this month, ordered by highest spend';
      const { sql } = await queryAI(question, OPENROUTER_API_KEY, userId);
      const { rows, error } = executeQuery(sql);
      if (error) return bot.sendMessage(chatId, '❌ Error: ' + error);
      const summary = await summarizeResults(question, rows, sql, OPENROUTER_API_KEY);
      bot.sendMessage(chatId, '📊 This Month by Category\n\n' + formatRows(rows) + '\n\n' + summary);
    } catch (err) {
      bot.sendMessage(chatId, '❌ Error: ' + err.message);
    }
  });

  // /top
  bot.onText(/\/top/, async (msg) => {
    if (!isAuthorized(msg)) return bot.sendMessage(msg.chat.id, '🚫 Unauthorized.');
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, '🏆 Finding your top merchants...');
    try {
      const question = 'Show top 10 merchants by total amount spent, all time';
      const { sql } = await queryAI(question, OPENROUTER_API_KEY, userId);
      const { rows, error } = executeQuery(sql);
      if (error) return bot.sendMessage(chatId, '❌ Error: ' + error);
      const lines = rows.map((r, i) => {
        const name = r.merchant_name || r.description || r.merchant || '?';
        const amt = r.total || r.total_amount || r.amount || 0;
        return (i + 1) + '. ' + name + ' — ' + formatAmount(typeof amt === 'number' ? amt : amt * 100);
      });
      bot.sendMessage(chatId, '🏆 Top Merchants (All Time)\n\n' + lines.join('\n'));
    } catch (err) {
      bot.sendMessage(chatId, '❌ Error: ' + err.message);
    }
  });

  // /setpin <pin> — set or change web login PIN
  bot.onText(/\/setpin(?:\s+(.+))?/, (msg, match) => {
    if (!isAuthorized(msg)) return bot.sendMessage(msg.chat.id, '🚫 Unauthorized.');
    const chatId = msg.chat.id;
    const newPin = match[1]?.trim();

    if (!newPin || newPin.length < 4) {
      return bot.sendMessage(chatId, '🔐 Usage: /setpin <pin>\nPIN must be at least 4 characters.\nThis sets your web app login PIN.');
    }

    const u = db.prepare('SELECT pin_hash FROM users WHERE id = ?').get(userId);
    if (u && u.pin_hash) {
      return bot.sendMessage(chatId, '🔐 PIN is already set. Use /changepin <old> <new> to change it.');
    }

    const hash = crypto.createHash('sha256').update(newPin).digest('hex');
    db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(hash, userId);
    bot.sendMessage(chatId, '✅ Web login PIN set! You can now log in at the web app.');
  });

  // /changepin <old> <new> — change web login PIN
  bot.onText(/\/changepin(?:\s+(.+))?/, (msg, match) => {
    if (!isAuthorized(msg)) return bot.sendMessage(msg.chat.id, '🚫 Unauthorized.');
    const chatId = msg.chat.id;
    const args = match[1]?.trim().split(/\s+/);

    if (!args || args.length < 2) {
      return bot.sendMessage(chatId, '🔐 Usage: /changepin <current_pin> <new_pin>\nNew PIN must be at least 4 characters.');
    }

    const [oldPin, newPinVal] = args;
    if (newPinVal.length < 4) {
      return bot.sendMessage(chatId, '❌ New PIN must be at least 4 characters.');
    }

    const u = db.prepare('SELECT pin_hash FROM users WHERE id = ?').get(userId);
    if (!u || !u.pin_hash) {
      return bot.sendMessage(chatId, '🔐 No PIN set yet. Use /setpin <pin> first.');
    }

    const oldHash = crypto.createHash('sha256').update(oldPin).digest('hex');
    if (oldHash !== u.pin_hash) {
      return bot.sendMessage(chatId, '❌ Incorrect current PIN.');
    }

    const newHash = crypto.createHash('sha256').update(newPinVal).digest('hex');
    db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(newHash, userId);

    // Invalidate all web sessions for this user
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);

    bot.sendMessage(chatId, '✅ PIN changed! All web sessions have been logged out.');
  });

  // /resetpin — clear PIN (for recovery)
  bot.onText(/\/resetpin/, (msg) => {
    if (!isAuthorized(msg)) return bot.sendMessage(msg.chat.id, '🚫 Unauthorized.');
    const chatId = msg.chat.id;
    db.prepare('UPDATE users SET pin_hash = NULL WHERE id = ?').run(userId);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    bot.sendMessage(chatId, '✅ PIN cleared. You can set a new one with /setpin <pin> or through the web app.');
  });

  // Handle photos (compressed screenshots)
  bot.on('photo', async (msg) => {
    if (!isAuthorized(msg)) return bot.sendMessage(msg.chat.id, '🚫 Unauthorized.');
    const chatId = msg.chat.id;
    bot.sendChatAction(chatId, 'typing');

    let tmpFile;
    try {
      const photo = msg.photo[msg.photo.length - 1];
      const file = await bot.getFile(photo.file_id);
      tmpFile = await downloadTelegramFile(botToken, file.file_path);

      const result = await parseImageTransactions(tmpFile, OPENROUTER_API_KEY);
      if (result.transactions.length === 0) {
        return bot.sendMessage(chatId, '⚠️ No transactions found in this screenshot.' + (result.error ? ` (${result.error})` : ''));
      }

      const account = getDefaultAccount(userId);
      const stats = await processAndInsert(result.transactions, 'screenshot.jpg', account.id, userId, 'imported from screenshot');
      bot.sendMessage(chatId, formatImportSummary(stats));
    } catch (err) {
      bot.sendMessage(chatId, '❌ Error processing photo: ' + err.message);
    } finally {
      if (tmpFile) fs.unlink(tmpFile, () => {});
    }
  });

  // Handle documents (PDF, CSV, ZIP, or images sent as files)
  bot.on('document', async (msg) => {
    if (!isAuthorized(msg)) return bot.sendMessage(msg.chat.id, '🚫 Unauthorized.');
    const chatId = msg.chat.id;
    const doc = msg.document;
    const mime = doc.mime_type || '';
    const filename = doc.file_name || 'unknown';
    const ext = path.extname(filename).toLowerCase();
    bot.sendChatAction(chatId, 'typing');

    let tmpFile;
    try {
      const file = await bot.getFile(doc.file_id);
      tmpFile = await downloadTelegramFile(botToken, file.file_path);
      const account = getDefaultAccount(userId);

      // Image sent as document
      if (IMAGE_MIMES.includes(mime) || IMAGE_EXTS.includes(ext)) {
        const result = await parseImageTransactions(tmpFile, OPENROUTER_API_KEY);
        if (result.transactions.length === 0) {
          return bot.sendMessage(chatId, '⚠️ No transactions found in this image.' + (result.error ? ` (${result.error})` : ''));
        }
        const stats = await processAndInsert(result.transactions, filename, account.id, userId, 'imported from screenshot');
        return bot.sendMessage(chatId, formatImportSummary(stats));
      }

      // PDF
      if (ext === '.pdf' || mime === 'application/pdf') {
        const buffer = fs.readFileSync(tmpFile);
        const result = await parsePdf(buffer, OPENROUTER_API_KEY);
        if (result.transactions.length === 0) {
          return bot.sendMessage(chatId, '⚠️ No transactions found in this PDF.' + (result.error ? '\n' + result.error : ''));
        }
        const stats = await processAndInsert(result.transactions, filename, account.id, userId, null);
        return bot.sendMessage(chatId, formatImportSummary(stats));
      }

      // CSV
      if (ext === '.csv' || mime === 'text/csv') {
        const buffer = fs.readFileSync(tmpFile);
        const result = parseCsv(buffer);
        if (result.transactions.length === 0) {
          return bot.sendMessage(chatId, '⚠️ No transactions found in this CSV.');
        }
        const stats = await processAndInsert(result.transactions, filename, account.id, userId, null);
        return bot.sendMessage(chatId, formatImportSummary(stats));
      }

      // ZIP
      if (ext === '.zip' || mime === 'application/zip') {
        const zip = new AdmZip(tmpFile);
        const entries = zip.getEntries();
        let totalStats = { imported: 0, duplicates: 0, flagged: 0 };

        for (const entry of entries) {
          if (entry.isDirectory) continue;
          const entryExt = path.extname(entry.entryName).toLowerCase();
          const entryPath = path.join(os.tmpdir(), `moneyguy-zip-${Date.now()}-${path.basename(entry.entryName)}`);
          try {
            fs.writeFileSync(entryPath, entry.getData());
            let result;
            if (entryExt === '.pdf') result = await parsePdf(entry.getData(), OPENROUTER_API_KEY);
            else if (entryExt === '.csv') result = parseCsv(entry.getData());
            else continue;

            if (result.transactions.length > 0) {
              const stats = await processAndInsert(result.transactions, entry.entryName, account.id, userId, null);
              totalStats.imported += stats.imported;
              totalStats.duplicates += stats.duplicates;
              totalStats.flagged += stats.flagged;
            }
          } finally {
            fs.unlink(entryPath, () => {});
          }
        }

        return bot.sendMessage(chatId, formatImportSummary(totalStats));
      }

      bot.sendMessage(chatId, `⚠️ Unsupported file type: ${ext || mime}. Send PDF, CSV, ZIP, or a screenshot.`);
    } catch (err) {
      bot.sendMessage(chatId, '❌ Error processing file: ' + err.message);
    } finally {
      if (tmpFile) fs.unlink(tmpFile, () => {});
    }
  });

  // Natural language — any other message
  bot.on('message', async (msg) => {
    if (msg.photo || msg.document) return;
    if (!isAuthorized(msg)) return;
    if (!msg.text || msg.text.startsWith('/')) return;

    const chatId = msg.chat.id;
    const question = msg.text.trim();
    const wantsPDF = /\bas pdf\b|\bpdf\b/i.test(question);
    const cleanQuestion = question.replace(/\bas pdf\b|\bpdf\b/gi, '').trim();

    bot.sendChatAction(chatId, wantsPDF ? 'upload_document' : 'typing');
    const thinkingMsg = await bot.sendMessage(chatId, '🤔 Thinking...');

    try {
      const { sql, explanation } = await queryAI(cleanQuestion, OPENROUTER_API_KEY, userId);
      const { rows, error } = executeQuery(sql);

      if (error) {
        return bot.editMessageText('❌ Query error: ' + error, {
          chat_id: chatId, message_id: thinkingMsg.message_id
        });
      }

      const summary = await summarizeResults(cleanQuestion, rows, sql, OPENROUTER_API_KEY);

      if (wantsPDF) {
        await bot.editMessageText('📄 Generating PDF with ' + rows.length + ' rows...', {
          chat_id: chatId, message_id: thinkingMsg.message_id
        });
        const pdfPath = await generatePDF(cleanQuestion, rows, summary, sql);
        await bot.sendDocument(chatId, pdfPath, { caption: summary });
        fs.unlink(pdfPath, () => {});
      } else {
        const isTransactionList = rows.length > 0 && rows[0].transaction_date && rows.length > 1;

        let reply = summary;
        if (isTransactionList) {
          reply += '\n\n' + formatRows(rows);
          if (rows.length > 15) reply += '\n\n(' + rows.length + ' total — send "as pdf" for full list)';
        }

        bot.editMessageText(reply, {
          chat_id: chatId,
          message_id: thinkingMsg.message_id
        });
      }
    } catch (err) {
      bot.editMessageText('❌ Error: ' + err.message, {
        chat_id: chatId, message_id: thinkingMsg.message_id
      });
    }
  });
}

/**
 * Start a single bot for a given user record.
 */
function startBotForUser(user) {
  if (!user.telegram_bot_token) return;
  if (activeBots.has(user.telegram_bot_token)) return; // already running

  try {
    const bot = new TelegramBot(user.telegram_bot_token, { polling: true });
    activeBots.set(user.telegram_bot_token, bot);
    registerBotHandlers(bot, user);

    // Register slash commands in Telegram's menu
    bot.setMyCommands([
      { command: 'start', description: 'Help & getting started' },
      { command: 'summary', description: 'This month spending by category' },
      { command: 'top', description: 'Top 10 merchants all time' },
      { command: 'setpin', description: 'Set web login PIN' },
      { command: 'changepin', description: 'Change web login PIN' },
      { command: 'resetpin', description: 'Clear PIN for recovery' },
    ]).catch(() => {});

    console.log(`🤖 Bot started for ${user.name} (user ${user.id})`);
  } catch (err) {
    console.error(`Failed to start bot for ${user.name}:`, err.message);
  }
}

/**
 * Start bots for all users that have a telegram_bot_token.
 */
function startAll() {
  const users = db.prepare('SELECT id, name, emoji, telegram_bot_token, telegram_user_id FROM users WHERE telegram_bot_token IS NOT NULL').all();
  if (users.length === 0) {
    console.log('No Telegram bots configured. Add bot tokens via /api/users.');
    return;
  }
  for (const user of users) {
    startBotForUser(user);
  }
}

module.exports = { startAll, startBotForUser };
