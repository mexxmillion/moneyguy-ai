const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const db = require('../db');
const { parsePdf, parseCsv } = require('../services/parser');
const { categorizeAll } = require('../services/categorizer');

const router = express.Router();

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

async function processFile(filepath, originalname, accountId) {
  const ext = path.extname(originalname).toLowerCase();
  const buffer = fs.readFileSync(filepath);
  let result;

  if (ext === '.pdf') {
    result = await parsePdf(buffer);
  } else if (ext === '.csv') {
    result = parseCsv(buffer);
  } else {
    return { success: false, error: `Unsupported file type: ${ext}`, count: 0 };
  }

  if (result.transactions.length === 0) {
    return { success: true, error: null, count: 0, warning: 'No transactions found in file' };
  }

  // Auto-categorize
  const categorized = categorizeAll(result.transactions);

  // Insert statement
  const stmt = db.prepare(
    'INSERT INTO statements (account_id, filename, raw_text) VALUES (?, ?, ?)'
  );
  const stmtResult = stmt.run(accountId, originalname, result.rawText);
  const statementId = stmtResult.lastInsertRowid;

  // Insert transactions
  const insertTx = db.prepare(`
    INSERT INTO transactions (statement_id, account_id, transaction_date, posting_date, description, merchant_name, amount, currency, category)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((txns) => {
    for (const t of txns) {
      insertTx.run(
        statementId, accountId, t.transaction_date, t.posting_date,
        t.description, t.merchant_name, t.amount, t.currency, t.category
      );
    }
  });

  insertMany(categorized);

  return { success: true, error: null, count: categorized.length, statementId };
}

router.post('/', upload.array('files', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Ensure default account exists
    let account = db.prepare('SELECT id FROM accounts LIMIT 1').get();
    if (!account) {
      const r = db.prepare("INSERT INTO accounts (name, institution, type) VALUES ('Default Account', 'Unknown', 'credit')").run();
      account = { id: r.lastInsertRowid };
    }

    const results = [];
    const tempDir = path.join(__dirname, '..', 'temp');

    for (const file of req.files) {
      const ext = path.extname(file.originalname).toLowerCase();

      if (ext === '.zip') {
        // Extract ZIP and process each file
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        try {
          const zip = new AdmZip(file.path);
          const entries = zip.getEntries();

          for (const entry of entries) {
            if (entry.isDirectory) continue;
            const entryExt = path.extname(entry.entryName).toLowerCase();
            if (entryExt !== '.pdf' && entryExt !== '.csv') continue;

            const extractPath = path.join(tempDir, entry.entryName);
            const extractDir = path.dirname(extractPath);
            if (!fs.existsSync(extractDir)) fs.mkdirSync(extractDir, { recursive: true });
            fs.writeFileSync(extractPath, entry.getData());

            const r = await processFile(extractPath, entry.entryName, account.id);
            results.push({ filename: entry.entryName, ...r });

            fs.unlinkSync(extractPath);
          }
        } finally {
          if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } else {
        const r = await processFile(file.path, file.originalname, account.id);
        results.push({ filename: file.originalname, ...r });
      }
    }

    const totalImported = results.reduce((sum, r) => sum + (r.count || 0), 0);
    res.json({ results, totalImported });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get accounts
router.get('/accounts', (req, res) => {
  const accounts = db.prepare('SELECT * FROM accounts').all();
  res.json(accounts);
});

// Create account
router.post('/accounts', (req, res) => {
  const { name, institution, type, currency } = req.body;
  const r = db.prepare('INSERT INTO accounts (name, institution, type, currency) VALUES (?, ?, ?, ?)').run(
    name, institution || null, type || 'credit', currency || 'CAD'
  );
  res.json({ id: r.lastInsertRowid });
});

module.exports = router;
