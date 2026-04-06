require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

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

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const AUTHORIZED_USER = parseInt(process.env.TELEGRAM_AUTHORIZED_USER || '962930679');
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN not set in .env');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log('🤖 MoneyGuy Telegram bot started — @moneymaster8888_bot');

function isAuthorized(msg) {
  return msg.from && msg.from.id === AUTHORIZED_USER;
}

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

// /start
bot.onText(/\/start/, (msg) => {
  if (!isAuthorized(msg)) return bot.sendMessage(msg.chat.id, '🚫 Unauthorized.');
  bot.sendMessage(msg.chat.id,
    '💰 MoneyGuy 2.0 is online!\n\n' +
    'Ask me anything about your finances:\n\n' +
    '• "How much did I spend on groceries in February?"\n' +
    '• "Show my biggest purchases last month"\n' +
    '• "What did I spend at T&T?"\n' +
    '• "Total dining expenses by month"\n\n' +
    'Add "as pdf" to any question to get results as a PDF file.\n\n' +
    'Commands:\n' +
    '/start - this help\n' +
    '/summary - this month spending by category\n' +
    '/top - top 10 merchants all time'
  );
});

// /summary
bot.onText(/\/summary/, async (msg) => {
  if (!isAuthorized(msg)) return bot.sendMessage(msg.chat.id, '🚫 Unauthorized.');
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '📊 Pulling this month\'s summary...');
  try {
    const question = 'Show me total spending by category for this month, ordered by highest spend';
    const { sql } = await queryAI(question, OPENROUTER_API_KEY);
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
    const { sql } = await queryAI(question, OPENROUTER_API_KEY);
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

// --- File ingestion helpers ---

function downloadTelegramFile(filePath) {
  const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
  const tmpFile = path.join(os.tmpdir(), `moneyguy-${Date.now()}-${path.basename(filePath)}`);
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(tmpFile);
    https.get(url, (res) => {
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(tmpFile); });
    }).on('error', (err) => { fs.unlink(tmpFile, () => {}); reject(err); });
  });
}

function getDefaultAccount() {
  let account = db.prepare('SELECT id FROM accounts LIMIT 1').get();
  if (!account) {
    const r = db.prepare("INSERT INTO accounts (name, institution, type) VALUES ('Default Account', 'Unknown', 'credit')").run();
    account = { id: r.lastInsertRowid };
  }
  return account;
}

async function processAndInsert(transactions, filename, accountId, notes) {
  const categorized = categorizeAll(transactions);
  if (notes) for (const t of categorized) t.notes = notes;

  const { inserted, duplicates, flagged } = deduplicateTransactions(categorized);
  const toInsert = [...inserted, ...flagged];

  if (toInsert.length > 0) {
    const stmt = db.prepare('INSERT INTO statements (account_id, filename, raw_text) VALUES (?, ?, ?)');
    const stmtResult = stmt.run(accountId, filename, `[telegram: ${filename}]`);
    const statementId = stmtResult.lastInsertRowid;

    const insertTx = db.prepare(`
      INSERT INTO transactions (statement_id, account_id, transaction_date, posting_date, description, merchant_name, amount, currency, category, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertMany = db.transaction((txns) => {
      for (const t of txns) {
        insertTx.run(statementId, accountId, t.transaction_date, t.posting_date,
          t.description, t.merchant_name, t.amount, t.currency, t.category, t.notes || null);
      }
    });
    insertMany(toInsert);
  }

  return {
    imported: inserted.length,
    duplicates: duplicates.length,
    flagged: flagged.length,
    transactions: toInsert, // actual transactions for display
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

  // Account info
  if (stats.accountName) {
    parts.push(`🏦 Account: ${stats.accountName}${stats.isNewAccount ? ' (new)' : ''}`);
  }

  // Statement period
  if (stats.period) {
    parts.push(`📅 Period: ${stats.period}`);
  }

  // Balances
  if (stats.closingBalance !== undefined) {
    parts.push(`💳 Balance: ${formatAmount(stats.closingBalance)}`);
  }
  if (stats.paymentDueDate) {
    parts.push(`⏰ Due: ${stats.paymentDueDate} — min ${formatAmount(stats.minimumPayment || 0)}`);
  }

  parts.push('');

  // Transaction counts
  parts.push(`✅ Imported ${stats.imported} new transactions`);
  if (stats.duplicates > 0) parts.push(`⏭️ ${stats.duplicates} duplicates skipped`);
  if (stats.flagged > 0) parts.push(`⚠️ ${stats.flagged} flagged for review`);

  // Show transaction highlights
  if (stats.transactions && stats.transactions.length > 0) {
    const txns = stats.transactions;
    parts.push('');

    if (txns.length <= 8) {
      // Small — show all
      parts.push('📋 Transactions:');
      txns.forEach(t => {
        const sign = t.amount < 0 ? '-' : '';
        parts.push(`  ${t.transaction_date} | ${t.merchant_name || t.description} | ${sign}${formatAmount(Math.abs(t.amount))} | ${t.category || '—'}`);
      });
    } else {
      // Large — show highlights only
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
      parts.push(`
📊 Full details at http://100.90.81.105:5173`);
    }
  }

  if (stats.error) parts.push(`\n❌ ${stats.error}`);
  return parts.join('\n');
}

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

// Handle photos (compressed screenshots)
bot.on('photo', async (msg) => {
  if (!isAuthorized(msg)) return bot.sendMessage(msg.chat.id, '🚫 Unauthorized.');
  const chatId = msg.chat.id;
  bot.sendChatAction(chatId, 'typing');

  let tmpFile;
  try {
    const photo = msg.photo[msg.photo.length - 1]; // highest resolution
    const file = await bot.getFile(photo.file_id);
    tmpFile = await downloadTelegramFile(file.file_path);

    const result = await parseImageTransactions(tmpFile, OPENROUTER_API_KEY);
    if (result.transactions.length === 0) {
      return bot.sendMessage(chatId, '⚠️ No transactions found in this screenshot.' + (result.error ? ` (${result.error})` : ''));
    }

    const account = getDefaultAccount();
    const stats = await processAndInsert(result.transactions, 'screenshot.jpg', account.id, 'imported from screenshot');
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
    tmpFile = await downloadTelegramFile(file.file_path);
    const account = getDefaultAccount();

    // Image sent as document
    if (IMAGE_MIMES.includes(mime) || IMAGE_EXTS.includes(ext)) {
      const result = await parseImageTransactions(tmpFile, OPENROUTER_API_KEY);
      if (result.transactions.length === 0) {
        return bot.sendMessage(chatId, '⚠️ No transactions found in this image.' + (result.error ? ` (${result.error})` : ''));
      }
      const stats = await processAndInsert(result.transactions, filename, account.id, 'imported from screenshot');
      return bot.sendMessage(chatId, formatImportSummary(stats));
    }

    // PDF
    if (ext === '.pdf' || mime === 'application/pdf') {
      const buffer = fs.readFileSync(tmpFile);
      const result = await parsePdf(buffer);
      if (result.transactions.length === 0) {
        return bot.sendMessage(chatId, '⚠️ No transactions found in this PDF.');
      }
      const stats = await processAndInsert(result.transactions, filename, account.id, null);
      return bot.sendMessage(chatId, formatImportSummary(stats));
    }

    // CSV
    if (ext === '.csv' || mime === 'text/csv') {
      const buffer = fs.readFileSync(tmpFile);
      const result = parseCsv(buffer);
      if (result.transactions.length === 0) {
        return bot.sendMessage(chatId, '⚠️ No transactions found in this CSV.');
      }
      const stats = await processAndInsert(result.transactions, filename, account.id, null);
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
          if (entryExt === '.pdf') result = await parsePdf(entry.getData());
          else if (entryExt === '.csv') result = parseCsv(entry.getData());
          else continue;

          if (result.transactions.length > 0) {
            const stats = await processAndInsert(result.transactions, entry.entryName, account.id, null);
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
  if (msg.photo || msg.document) return; // handled above
  if (!isAuthorized(msg)) return;
  if (!msg.text || msg.text.startsWith('/')) return;

  const chatId = msg.chat.id;
  const question = msg.text.trim();
  const wantsPDF = /\bas pdf\b|\bpdf\b/i.test(question);
  const cleanQuestion = question.replace(/\bas pdf\b|\bpdf\b/gi, '').trim();

  bot.sendChatAction(chatId, wantsPDF ? 'upload_document' : 'typing');
  const thinkingMsg = await bot.sendMessage(chatId, '🤔 Thinking...');

  try {
    const { sql, explanation } = await queryAI(cleanQuestion, OPENROUTER_API_KEY);
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
      const tableText = formatRows(rows);
      const reply = summary + '\n\n' + tableText + '\n\n(' + rows.length + ' rows)';
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
