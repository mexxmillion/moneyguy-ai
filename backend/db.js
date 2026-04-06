require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'moneyguy.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      emoji TEXT NOT NULL DEFAULT '👤',
      telegram_bot_token TEXT,
      telegram_user_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) DEFAULT 1,
      name TEXT NOT NULL,
      institution TEXT,
      type TEXT CHECK(type IN ('credit','debit','investment')) NOT NULL DEFAULT 'credit',
      currency TEXT NOT NULL DEFAULT 'CAD',
      account_number_last4 TEXT,
      card_type TEXT,
      credit_limit INTEGER,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      parent_id INTEGER REFERENCES categories(id),
      color TEXT DEFAULT '#6b7280',
      icon TEXT DEFAULT '📁'
    );

    CREATE TABLE IF NOT EXISTS statements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) DEFAULT 1,
      account_id INTEGER REFERENCES accounts(id),
      filename TEXT NOT NULL,
      period_start TEXT,
      period_end TEXT,
      opening_balance INTEGER,
      closing_balance INTEGER,
      total_debits INTEGER,
      total_credits INTEGER,
      minimum_payment INTEGER,
      payment_due_date TEXT,
      credit_limit INTEGER,
      available_credit INTEGER,
      source_file_path TEXT,
      source_file_hash TEXT,
      imported_by TEXT DEFAULT 'web',
      imported_at TEXT NOT NULL DEFAULT (datetime('now')),
      raw_text TEXT
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) DEFAULT 1,
      statement_id INTEGER REFERENCES statements(id),
      account_id INTEGER REFERENCES accounts(id),
      transaction_date TEXT NOT NULL,
      posting_date TEXT,
      description TEXT NOT NULL,
      merchant_name TEXT,
      amount INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'CAD',
      category TEXT,
      subcategory TEXT,
      is_reviewed INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS merchant_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant_pattern TEXT NOT NULL,
      category_id INTEGER REFERENCES categories(id),
      priority INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) DEFAULT 1,
      event_type TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      description TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) DEFAULT 1,
      category TEXT NOT NULL,
      monthly_limit INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, category)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
    CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_merchant ON transactions(merchant_name);
  `);

  // ALTER TABLE migrations for existing databases
  const alterStatements = [
    ['statements', 'opening_balance', 'INTEGER'],
    ['statements', 'closing_balance', 'INTEGER'],
    ['statements', 'total_debits', 'INTEGER'],
    ['statements', 'total_credits', 'INTEGER'],
    ['statements', 'minimum_payment', 'INTEGER'],
    ['statements', 'payment_due_date', 'TEXT'],
    ['statements', 'credit_limit', 'INTEGER'],
    ['statements', 'available_credit', 'INTEGER'],
    ['statements', 'source_file_path', 'TEXT'],
    ['statements', 'source_file_hash', 'TEXT'],
    ['statements', 'imported_by', "TEXT DEFAULT 'web'"],
    ['accounts', 'account_number_last4', 'TEXT'],
    ['accounts', 'card_type', 'TEXT'],
    ['accounts', 'credit_limit', 'INTEGER'],
    ['accounts', 'is_active', 'INTEGER DEFAULT 1'],
    // Multi-user columns (no FK in ALTER — SQLite limitation)
    ['accounts', 'user_id', 'INTEGER DEFAULT 1'],
    ['statements', 'user_id', 'INTEGER DEFAULT 1'],
    ['transactions', 'user_id', 'INTEGER DEFAULT 1'],
    ['audit_log', 'user_id', 'INTEGER DEFAULT 1'],
    ['budgets', 'user_id', 'INTEGER DEFAULT 1'],
    ['users', 'pin_hash', 'TEXT'],
  ];
  for (const [table, col, type] of alterStatements) {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`); } catch (e) { /* column already exists */ }
  }

  // Indexes that depend on ALTERed columns (must run after ALTER block)
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_statements_hash ON statements(source_file_hash)',
    'CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_statements_user ON statements(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_budgets_user ON budgets(user_id)',
  ];
  for (const sql of indexes) {
    try { db.exec(sql); } catch (e) { /* index or column may not exist yet */ }
  }

  // Rebuild budgets table if it has the old UNIQUE(category) constraint
  // Need UNIQUE(user_id, category) instead
  try {
    const info = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='budgets'").get();
    if (info && info.sql && info.sql.includes('category TEXT NOT NULL UNIQUE') && !info.sql.includes('UNIQUE(user_id')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS budgets_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER REFERENCES users(id) DEFAULT 1,
          category TEXT NOT NULL,
          monthly_limit INTEGER NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(user_id, category)
        );
        INSERT OR IGNORE INTO budgets_new (id, user_id, category, monthly_limit, is_active, created_at)
          SELECT id, COALESCE(user_id, 1), category, monthly_limit, is_active, created_at FROM budgets;
        DROP TABLE budgets;
        ALTER TABLE budgets_new RENAME TO budgets;
      `);
    }
  } catch (e) { /* table already correct */ }

  // Backfill user_id=1 for any existing rows with NULL user_id
  db.exec(`
    UPDATE accounts SET user_id = 1 WHERE user_id IS NULL;
    UPDATE transactions SET user_id = 1 WHERE user_id IS NULL;
    UPDATE statements SET user_id = 1 WHERE user_id IS NULL;
    UPDATE budgets SET user_id = 1 WHERE user_id IS NULL;
    UPDATE audit_log SET user_id = 1 WHERE user_id IS NULL;
  `);

  // Fix any amounts stored as floats (dollars) instead of integer cents
  db.exec(`
    UPDATE transactions SET amount = CAST(amount * 100 AS INTEGER)
    WHERE typeof(amount) != 'integer';
  `);

  // Ensure categories used in transactions exist in categories table
  const missingCats = [
    { name: 'Housing', color: '#eab308', icon: '🏠' },
    { name: 'Transfers', color: '#0ea5e9', icon: '🔄' },
    { name: 'Ignore', color: '#6b7280', icon: '🚫' },
  ];
  const insertCat = db.prepare('INSERT OR IGNORE INTO categories (name, color, icon) VALUES (?, ?, ?)');
  for (const c of missingCats) insertCat.run(c.name, c.color, c.icon);
}

function seedCategories() {
  const existing = db.prepare('SELECT COUNT(*) as count FROM categories').get();
  if (existing.count > 0) return;

  const cats = [
    { name: 'Groceries', color: '#22c55e', icon: '🛒' },
    { name: 'Dining', color: '#f97316', icon: '🍽️' },
    { name: 'Transport/Parking', color: '#3b82f6', icon: '🚗' },
    { name: 'Subscriptions', color: '#8b5cf6', icon: '📱' },
    { name: 'Shopping', color: '#ec4899', icon: '🛍️' },
    { name: 'Entertainment', color: '#14b8a6', icon: '🎭' },
    { name: 'Auto/Mechanic', color: '#64748b', icon: '🔧' },
    { name: 'Interest/Fees', color: '#ef4444', icon: '💳' },
    { name: 'Payments', color: '#10b981', icon: '✅' },
    { name: 'Uncategorized', color: '#6b7280', icon: '❓' },
  ];

  const insert = db.prepare('INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)');
  for (const c of cats) insert.run(c.name, c.color, c.icon);
}

function seedMerchantRules() {
  const existing = db.prepare('SELECT COUNT(*) as count FROM merchant_rules').get();
  if (existing.count > 0) return;

  const getCatId = db.prepare('SELECT id FROM categories WHERE name = ?');
  const insertRule = db.prepare('INSERT INTO merchant_rules (merchant_pattern, category_id, priority) VALUES (?, ?, ?)');

  const rules = [
    { patterns: ['T&T', 'SUPERMARKET', 'LOBLAWS', 'SOBEYS', 'SAVE-ON', 'METRO', 'WHOLE FOODS'], category: 'Groceries' },
    { patterns: ['RESTAURANT', 'CAFE', 'COFFEE', 'SUSHI', 'CHICKEN', 'BAKERY', 'TIM HORTONS', 'McDONALD', 'STARBUCKS', 'GUU', 'SHIOK', 'TRUONG THANH'], category: 'Dining' },
    { patterns: ['PAYBYPHONE', 'EASYPARK', 'TRANSLINK', 'UBER', 'LYFT'], category: 'Transport/Parking' },
    { patterns: ['NETFLIX', 'APPLE.COM/BILL', 'SPOTIFY', 'GOOGLE', 'AMAZON PRIME'], category: 'Subscriptions' },
    { patterns: ['AMAZON', 'WALMART', 'COSTCO', 'TOYS', 'MARKET MEATS'], category: 'Shopping' },
    { patterns: ['SHARON LEUNG ART', 'BCF', 'COASTAL RENAISSANCE'], category: 'Entertainment' },
    { patterns: ['MECHANIC', 'DISTRICT MECH', 'AUTO'], category: 'Auto/Mechanic' },
    { patterns: ['PURCHASE INTEREST', 'ANNUAL FEE'], category: 'Interest/Fees' },
    { patterns: ['PAYMENT - THANK YOU'], category: 'Payments' },
  ];

  for (const group of rules) {
    const cat = getCatId.get(group.category);
    if (!cat) continue;
    for (let i = 0; i < group.patterns.length; i++) {
      insertRule.run(group.patterns[i], cat.id, group.patterns.length - i);
    }
  }
}

function seedUsers() {
  const existing = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (existing.count > 0) return;

  const insertUser = db.prepare(`INSERT INTO users (id, name, emoji, telegram_bot_token, telegram_user_id) VALUES (?, ?, ?, ?, ?)`);

  // User 1: you
  insertUser.run(
    1, 'Me', '💰',
    process.env.TELEGRAM_BOT_TOKEN || null,
    process.env.TELEGRAM_AUTHORIZED_USER ? parseInt(process.env.TELEGRAM_AUTHORIZED_USER) : null
  );

  // User 2: wife
  insertUser.run(
    2, 'Wifey', '👩',
    '8775743198:AAE5jEZiimrT2EKWVDZXCCDHixwr5waxiZw',
    null // will be set when she first messages the bot
  );
}

migrate();
seedUsers();
seedCategories();
seedMerchantRules();

module.exports = db;
