const db = require('./db');
const { categorize } = require('./services/categorizer');

// Sample transactions for testing
const sampleTransactions = [
  { date: '2026-02-03', desc: 'T&T SUPERMARKET VANCOUVER BC', amount: 4523 },
  { date: '2026-02-04', desc: 'STARBUCKS #1234 VANCOUVER BC', amount: 675 },
  { date: '2026-02-05', desc: 'NETFLIX.COM', amount: 1699 },
  { date: '2026-02-06', desc: 'UBER *TRIP VANCOUVER', amount: 1245 },
  { date: '2026-02-07', desc: 'AMAZON.CA *1A2B3C AMZN.CA/PM', amount: 5999 },
  { date: '2026-02-08', desc: 'LOBLAWS #3456 BURNABY BC', amount: 8734 },
  { date: '2026-02-09', desc: 'TIM HORTONS #567 VANCOUVER BC', amount: 425 },
  { date: '2026-02-10', desc: 'PAYBYPHONE VANCOUVER', amount: 300 },
  { date: '2026-02-11', desc: 'SAVE-ON-FOODS #890 VANCOUVER', amount: 6721 },
  { date: '2026-02-12', desc: 'APPLE.COM/BILL', amount: 1399 },
  { date: '2026-02-13', desc: 'COSTCO WHOLESALE BURNABY BC', amount: 15678 },
  { date: '2026-02-14', desc: 'GUU GARDEN VANCOUVER BC', amount: 4250 },
  { date: '2026-02-15', desc: 'TRANSLINK COMPASS VANCOUVER', amount: 9800 },
  { date: '2026-02-16', desc: 'WHOLE FOODS MARKET VANCOUVER', amount: 7845 },
  { date: '2026-02-17', desc: 'McDONALD\'S #1234 VANCOUVER BC', amount: 1123 },
  { date: '2026-02-18', desc: 'SPOTIFY CANADA', amount: 1099 },
  { date: '2026-02-19', desc: 'DISTRICT MECH AUTO REPAIR', amount: 32500 },
  { date: '2026-02-20', desc: 'SHIOK SINGAPORE KITCHEN VAN', amount: 3875 },
  { date: '2026-02-21', desc: 'PURCHASE INTEREST', amount: 2341 },
  { date: '2026-02-22', desc: 'PAYMENT - THANK YOU', amount: -150000 },
  { date: '2026-02-23', desc: 'TRUONG THANH RESTAURANT VAN', amount: 2890 },
  { date: '2026-02-24', desc: 'WALMART #5678 SURREY BC', amount: 4532 },
  { date: '2026-02-25', desc: 'EASYPARK VANCOUVER', amount: 500 },
  { date: '2026-02-26', desc: 'LYFT *RIDE VANCOUVER', amount: 1876 },
  { date: '2026-02-27', desc: 'METRO VANCOUVER BC', amount: 5623 },
  { date: '2026-02-28', desc: 'SHARON LEUNG ART STUDIO', amount: 8500 },
  { date: '2026-03-01', desc: 'T&T SUPERMARKET RICHMOND BC', amount: 5234 },
  { date: '2026-03-02', desc: 'STARBUCKS #5678 BURNABY BC', amount: 750 },
  { date: '2026-03-03', desc: 'AMAZON PRIME MEMBERSHIP', amount: 999 },
  { date: '2026-03-04', desc: 'COASTAL RENAISSANCE GALLERY', amount: 12000 },
  { date: '2026-03-05', desc: 'SOBEYS #234 VANCOUVER BC', amount: 6543 },
  { date: '2026-03-06', desc: 'GOOGLE *CLOUD SERVICES', amount: 2500 },
  { date: '2026-03-07', desc: 'CHICKEN CORNER RESTAURANT', amount: 2100 },
  { date: '2026-03-08', desc: 'BCF BOWLING CENTER FUN', amount: 4500 },
  { date: '2026-03-09', desc: 'ANNUAL FEE', amount: 12000 },
  { date: '2026-03-10', desc: 'MARKET MEATS GRANVILLE ISLAND', amount: 3456 },
  { date: '2026-03-11', desc: 'CAFE MEDINA VANCOUVER BC', amount: 3200 },
  { date: '2026-03-12', desc: 'PAYMENT - THANK YOU', amount: -100000 },
  { date: '2026-03-13', desc: 'TOYS R US METROTOWN BC', amount: 7890 },
  { date: '2026-03-14', desc: 'SUSHI GARDEN BURNABY BC', amount: 4100 },
  { date: '2026-03-15', desc: 'T&T SUPERMARKET METROTOWN', amount: 3890 },
];

// Ensure account exists
let account = db.prepare('SELECT id FROM accounts LIMIT 1').get();
if (!account) {
  const r = db.prepare("INSERT INTO accounts (name, institution, type) VALUES ('RBC Visa', 'Royal Bank of Canada', 'credit')").run();
  account = { id: r.lastInsertRowid };
} else {
  db.prepare("UPDATE accounts SET name = 'RBC Visa', institution = 'Royal Bank of Canada' WHERE id = ?").run(account.id);
}

// Create statement
const stmtResult = db.prepare(
  "INSERT INTO statements (account_id, filename, period_start, period_end, raw_text) VALUES (?, 'seed-data.csv', '2026-02-01', '2026-03-15', 'Seed data for testing')"
).run(account.id);

const statementId = stmtResult.lastInsertRowid;

// Insert transactions
const insert = db.prepare(`
  INSERT INTO transactions (statement_id, account_id, transaction_date, description, merchant_name, amount, currency, category)
  VALUES (?, ?, ?, ?, ?, ?, 'CAD', ?)
`);

const insertAll = db.transaction(() => {
  for (const t of sampleTransactions) {
    const cat = categorize(t.desc);
    insert.run(statementId, account.id, t.date, t.desc, t.desc.split(/\s{2,}/)[0], t.amount, cat.category);
  }
});

insertAll();

console.log(`Seeded ${sampleTransactions.length} transactions into account "${account.id}"`);
console.log('Done!');
