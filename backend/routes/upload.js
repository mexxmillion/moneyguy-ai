const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const AdmZip = require('adm-zip');
const db = require('../db');
const { parsePdf, parseCsv, parseImageTransactions, deduplicateTransactions, extractStatementMetadata } = require('../services/parser');
const { categorizeAll } = require('../services/categorizer');

const router = express.Router();

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const originalsDir = path.join(uploadsDir, 'originals');
if (!fs.existsSync(originalsDir)) fs.mkdirSync(originalsDir, { recursive: true });

function logAudit(eventType, entityType, entityId, description, metadata) {
  db.prepare(
    'INSERT INTO audit_log (event_type, entity_type, entity_id, description, metadata) VALUES (?, ?, ?, ?, ?)'
  ).run(eventType, entityType, entityId, description, metadata ? JSON.stringify(metadata) : null);
}

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

async function processFile(filepath, originalname, importedBy = 'web') {
  const ext = path.extname(originalname).toLowerCase();
  const buffer = fs.readFileSync(filepath);
  const apiKey = process.env.OPENROUTER_API_KEY;

  // Compute file hash for dedup/audit
  const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

  // Check if already imported
  const existingStmt = db.prepare(`
    SELECT s.id, s.imported_at, s.period_start, s.period_end, a.name as account_name
    FROM statements s LEFT JOIN accounts a ON s.account_id = a.id
    WHERE s.source_file_hash = ?
  `).get(fileHash);
  if (existingStmt) {
    logAudit('upload', 'statement', existingStmt.id, `Duplicate upload skipped: ${originalname}`, { filename: originalname, hash: fileHash });
    return {
      success: true, error: null, count: 0, statementId: existingStmt.id,
      imported: 0, duplicates: 0, flagged: 0,
      alreadyImported: true, fileHash, duplicate: true,
      firstImportedAt: existingStmt.imported_at,
      accountName: existingStmt.account_name,
      period: existingStmt.period_start && existingStmt.period_end
        ? `${existingStmt.period_start} to ${existingStmt.period_end}` : null,
    };
  }

  let result;
  let fromImage = false;

  if (ext === '.pdf') {
    result = await parsePdf(buffer, apiKey);
  } else if (ext === '.csv') {
    result = parseCsv(buffer);
  } else if (IMAGE_EXTS.includes(ext)) {
    if (!apiKey) {
      logAudit('upload', 'statement', null, `Upload failed: no API key for image ${originalname}`, { filename: originalname, hash: fileHash });
      return { success: false, error: 'OPENROUTER_API_KEY not configured', count: 0 };
    }
    result = await parseImageTransactions(filepath, apiKey);
    result.rawText = `[screenshot: ${originalname}]`;
    fromImage = true;
  } else {
    logAudit('upload', 'statement', null, `Upload failed: unsupported file type ${ext}`, { filename: originalname, hash: fileHash });
    return { success: false, error: `Unsupported file type: ${ext}`, count: 0 };
  }

  if (result.error && result.transactions.length === 0) {
    logAudit('upload', 'statement', null, `Upload failed: ${result.error}`, { filename: originalname, hash: fileHash });
    return { success: false, error: result.error, count: 0 };
  }

  if (result.transactions.length === 0) {
    logAudit('upload', 'statement', null, `Upload produced no transactions: ${originalname}`, { filename: originalname, hash: fileHash });
    return { success: true, error: null, count: 0, warning: 'No transactions found in file' };
  }

  // Extract statement metadata (account info, balances, period)
  let metadata = null;
  if (apiKey) {
    // Use raw text if available, otherwise use first transaction descriptions as hints
    const textForMeta = result.rawText || result.transactions.map(t => t.description).join(' ');
    metadata = await extractStatementMetadata(textForMeta, apiKey);
  }

  // Find or create account based on metadata
  let accountId;
  let accountName;
  let isNewAccount = false;

  if (metadata && metadata.account_number_last4 && metadata.institution) {
    const existingAccount = db.prepare(
      'SELECT id, name, credit_limit FROM accounts WHERE account_number_last4 = ? AND institution = ?'
    ).get(metadata.account_number_last4, metadata.institution);

    if (existingAccount) {
      accountId = existingAccount.id;
      accountName = existingAccount.name;
      // Update any missing/changed fields
      db.prepare(`UPDATE accounts SET 
        credit_limit = COALESCE(?, credit_limit),
        card_type = COALESCE(?, card_type),
        account_number_last4 = COALESCE(?, account_number_last4)
        WHERE id = ?`).run(
        metadata.credit_limit || null,
        metadata.card_type || null,
        metadata.account_number_last4 || null,
        accountId
      );
    } else {
      const cardType = metadata.card_type || null;
      const accType = metadata.account_type || 'credit';
      const currency = metadata.currency || 'CAD';
      const name = metadata.institution + (cardType ? ` ${cardType}` : '') + ` ...${metadata.account_number_last4}`;
      const r = db.prepare(
        'INSERT INTO accounts (name, institution, type, currency, account_number_last4, card_type, credit_limit) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(name, metadata.institution, accType, currency, metadata.account_number_last4, cardType, metadata.credit_limit || null);
      accountId = r.lastInsertRowid;
      accountName = name;
      isNewAccount = true;
    }
  } else {
    // Fallback: use or create default account
    let account = db.prepare('SELECT id, name FROM accounts LIMIT 1').get();
    if (!account) {
      const r = db.prepare("INSERT INTO accounts (name, institution, type) VALUES ('Default Account', 'Unknown', 'credit')").run();
      account = { id: r.lastInsertRowid, name: 'Default Account' };
      isNewAccount = true;
    }
    accountId = account.id;
    accountName = account.name;
  }

  // Store original file
  const sourceFilePath = path.join(originalsDir, fileHash + ext);
  if (!fs.existsSync(sourceFilePath)) {
    fs.writeFileSync(sourceFilePath, buffer);
  }

  // Auto-categorize
  const categorized = categorizeAll(result.transactions);

  // Add notes for image-sourced transactions
  if (fromImage) {
    for (const t of categorized) t.notes = 'imported from screenshot';
  }

  // Dedup transactions
  const { inserted, duplicates, flagged } = deduplicateTransactions(categorized);

  if (inserted.length === 0) {
    logAudit('upload', 'statement', null, `All transactions were duplicates: ${originalname}`, {
      filename: originalname, hash: fileHash, accountId, duplicateCount: duplicates.length, flaggedCount: flagged.length,
    });
    return {
      success: true, error: null, count: 0,
      imported: 0, duplicates: duplicates.length, flagged: flagged.length,
      warning: 'All transactions were duplicates', fileHash, accountId, accountName,
    };
  }

  // Insert statement with full metadata
  const stmt = db.prepare(`
    INSERT INTO statements (account_id, filename, period_start, period_end, opening_balance, closing_balance,
      total_debits, total_credits, minimum_payment, payment_due_date, credit_limit, available_credit,
      source_file_path, source_file_hash, imported_by, raw_text)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const stmtResult = stmt.run(
    accountId, originalname,
    metadata?.statement_period_start || null, metadata?.statement_period_end || null,
    metadata?.opening_balance || null, metadata?.closing_balance || null,
    metadata?.total_debits || null, metadata?.total_credits || null,
    metadata?.minimum_payment || null, metadata?.payment_due_date || null,
    metadata?.credit_limit || null, metadata?.available_credit || null,
    sourceFilePath, fileHash, importedBy,
    result.rawText || ''
  );
  const statementId = stmtResult.lastInsertRowid;

  // Insert transactions
  const insertTx = db.prepare(`
    INSERT INTO transactions (statement_id, account_id, transaction_date, posting_date, description, merchant_name, amount, currency, category, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((txns) => {
    for (const t of txns) {
      insertTx.run(
        statementId, accountId, t.transaction_date, t.posting_date,
        t.description, t.merchant_name, t.amount, t.currency, t.category, t.notes || null
      );
    }
  });

  const toInsert = [...inserted, ...flagged];
  insertMany(toInsert);

  const period = (metadata?.statement_period_start && metadata?.statement_period_end)
    ? `${metadata.statement_period_start} to ${metadata.statement_period_end}` : null;

  // Audit log
  logAudit('upload', 'statement', statementId, `Imported ${originalname}: ${toInsert.length} transactions`, {
    filename: originalname, hash: fileHash, accountId, accountName,
    transactionCount: toInsert.length, duplicateCount: duplicates.length, flaggedCount: flagged.length,
    period, importedBy,
  });

  return {
    success: true, error: null, count: toInsert.length, statementId,
    imported: inserted.length, duplicates: duplicates.length, flagged: flagged.length,
    accountId, accountName, period, isNewAccount, fileHash, alreadyImported: false,
  };
}

router.post('/', upload.array('files', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const importedBy = req.body.imported_by || 'web';
    const results = [];
    const tempDir = path.join(__dirname, '..', 'temp');

    for (const file of req.files) {
      const ext = path.extname(file.originalname).toLowerCase();

      if (ext === '.zip') {
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

            const r = await processFile(extractPath, entry.entryName, importedBy);
            results.push({ filename: entry.entryName, ...r });

            fs.unlinkSync(extractPath);
          }
        } finally {
          if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } else {
        const r = await processFile(file.path, file.originalname, importedBy);
        results.push({ filename: file.originalname, ...r });
      }
    }

    const totalImported = results.reduce((sum, r) => sum + (r.count || 0), 0);
    const totalDuplicates = results.reduce((sum, r) => sum + (r.duplicates || 0), 0);
    const totalFlagged = results.reduce((sum, r) => sum + (r.flagged || 0), 0);
    const errors = results.filter(r => r.error).map(r => ({ filename: r.filename, error: r.error }));
    res.json({ imported: totalImported, duplicates: totalDuplicates, flagged: totalFlagged, errors, results });
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
