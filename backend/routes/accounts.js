const express = require('express');
const db = require('../db');

const router = express.Router();

const TYPE_META = {
  debit: { key: 'cash', label: 'Cash', tone: 'emerald' },
  credit: { key: 'credit', label: 'Credit Cards', tone: 'rose' },
  investment: { key: 'investment', label: 'Investments', tone: 'sky' },
  loan: { key: 'loan', label: 'Loans', tone: 'amber' },
};

function mapAccountType(type) {
  return TYPE_META[type] || { key: type || 'other', label: 'Other', tone: 'gray' };
}

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT
      a.id,
      a.name,
      a.institution,
      a.type,
      a.currency,
      a.account_number_last4,
      a.card_type,
      a.credit_limit,
      a.is_active,
      s.id AS latest_statement_id,
      s.period_end AS last_statement_date,
      s.closing_balance,
      s.available_credit,
      s.minimum_payment,
      s.payment_due_date,
      (
        SELECT COUNT(*)
        FROM transactions t
        WHERE t.account_id = a.id
      ) AS transaction_count
    FROM accounts a
    LEFT JOIN statements s ON s.id = (
      SELECT s2.id
      FROM statements s2
      WHERE s2.account_id = a.id
      ORDER BY COALESCE(s2.period_end, s2.imported_at) DESC, s2.id DESC
      LIMIT 1
    )
    WHERE a.is_active = 1
    ORDER BY
      CASE a.type
        WHEN 'debit' THEN 1
        WHEN 'credit' THEN 2
        WHEN 'loan' THEN 3
        WHEN 'investment' THEN 4
        ELSE 5
      END,
      COALESCE(a.institution, ''),
      a.name
  `).all();

  const groups = [];
  const byKey = new Map();
  let cashTotal = 0;
  let debtTotal = 0;
  let investmentTotal = 0;
  let loanTotal = 0;

  for (const row of rows) {
    const meta = mapAccountType(row.type);
    if (!byKey.has(meta.key)) {
      const group = {
        key: meta.key,
        label: meta.label,
        tone: meta.tone,
        totalBalance: 0,
        accountCount: 0,
        accounts: [],
      };
      byKey.set(meta.key, group);
      groups.push(group);
    }

    const balance = row.closing_balance || 0;
    const account = {
      id: row.id,
      name: row.name,
      institution: row.institution,
      type: row.type,
      currency: row.currency,
      last4: row.account_number_last4,
      cardType: row.card_type,
      creditLimit: row.credit_limit,
      availableCredit: row.available_credit,
      minimumPayment: row.minimum_payment,
      paymentDueDate: row.payment_due_date,
      balance,
      lastStatementDate: row.last_statement_date,
      transactionCount: row.transaction_count,
    };

    const group = byKey.get(meta.key);
    group.accounts.push(account);
    group.accountCount += 1;
    group.totalBalance += balance;

    if (row.type === 'debit') cashTotal += balance;
    else if (row.type === 'credit') debtTotal += balance;
    else if (row.type === 'investment') investmentTotal += balance;
    else if (row.type === 'loan') loanTotal += balance;
  }

  res.json({
    summary: {
      cashTotal,
      debtTotal,
      investmentTotal,
      loanTotal,
      netWorth: cashTotal + investmentTotal - debtTotal - loanTotal,
      accountCount: rows.length,
    },
    groups,
  });
});

router.get('/list', (req, res) => {
  const rows = db.prepare(`
    SELECT id, name, institution, type
    FROM accounts
    WHERE is_active = 1
    ORDER BY COALESCE(institution, ''), name
  `).all();

  res.json(rows.map(row => ({
    id: row.id,
    name: row.institution ? `${row.institution} • ${row.name}` : row.name,
    type: row.type,
  })));
});

router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const account = db.prepare(`
    SELECT
      a.*,
      s.period_start,
      s.period_end,
      s.closing_balance,
      s.available_credit,
      s.minimum_payment,
      s.payment_due_date
    FROM accounts a
    LEFT JOIN statements s ON s.id = (
      SELECT s2.id
      FROM statements s2
      WHERE s2.account_id = a.id
      ORDER BY COALESCE(s2.period_end, s2.imported_at) DESC, s2.id DESC
      LIMIT 1
    )
    WHERE a.id = ?
  `).get(id);

  if (!account) return res.status(404).json({ error: 'Account not found' });

  const transactions = db.prepare(`
    SELECT *
    FROM transactions
    WHERE account_id = ?
    ORDER BY transaction_date DESC, id DESC
    LIMIT 100
  `).all(id);

  res.json({ account, transactions });
});

module.exports = router;
