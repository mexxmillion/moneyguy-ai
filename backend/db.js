const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'moneyguy.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      institution TEXT,
      type TEXT CHECK(type IN ('credit','debit','investment')) NOT NULL DEFAULT 'credit',
      currency TEXT NOT NULL DEFAULT 'CAD'
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
      account_id INTEGER REFERENCES accounts(id),
      filename TEXT NOT NULL,
      period_start TEXT,
      period_end TEXT,
      imported_at TEXT NOT NULL DEFAULT (datetime('now')),
      raw_text TEXT
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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

    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
    CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_merchant ON transactions(merchant_name);
  `);
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

migrate();
seedCategories();
seedMerchantRules();

module.exports = db;
