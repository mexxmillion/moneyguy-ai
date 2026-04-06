const express = require('express');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');
const db = require('../db');

const router = express.Router();

function getFilteredTransactions(query) {
  const { category, merchant, search, date_from, date_to, amount_min, amount_max, account_id } = query;
  const conditions = [];
  const params = [];

  if (category) { conditions.push('t.category = ?'); params.push(category); }
  if (merchant) { conditions.push('t.merchant_name LIKE ?'); params.push(`%${merchant}%`); }
  if (search) { conditions.push('t.description LIKE ?'); params.push(`%${search}%`); }
  if (date_from) { conditions.push('t.transaction_date >= ?'); params.push(date_from); }
  if (date_to) { conditions.push('t.transaction_date <= ?'); params.push(date_to); }
  if (amount_min) { conditions.push('t.amount >= ?'); params.push(Math.round(parseFloat(amount_min) * 100)); }
  if (amount_max) { conditions.push('t.amount <= ?'); params.push(Math.round(parseFloat(amount_max) * 100)); }
  if (account_id) { conditions.push('t.account_id = ?'); params.push(parseInt(account_id)); }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  return db.prepare(`
    SELECT t.transaction_date, t.description, t.merchant_name, t.amount, t.currency, t.category, t.notes
    FROM transactions t
    ${where}
    ORDER BY t.transaction_date DESC
  `).all(...params);
}

router.get('/csv', (req, res) => {
  const rows = getFilteredTransactions(req.query);

  const data = rows.map(r => ({
    Date: r.transaction_date,
    Description: r.description,
    Merchant: r.merchant_name,
    Amount: (r.amount / 100).toFixed(2),
    Currency: r.currency,
    Category: r.category,
    Notes: r.notes || '',
  }));

  const parser = new Parser();
  const csv = parser.parse(data);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=transactions.csv');
  res.send(csv);
});

router.get('/pdf', (req, res) => {
  const rows = getFilteredTransactions(req.query);

  const doc = new PDFDocument({ margin: 40, size: 'LETTER', layout: 'landscape' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=transactions.pdf');
  doc.pipe(res);

  // Title
  doc.fontSize(18).text('MoneyGuy 2.0 — Transaction Report', { align: 'center' });
  doc.moveDown(0.5);

  // Summary
  const total = rows.reduce((s, r) => s + r.amount, 0);
  doc.fontSize(10).text(`Total transactions: ${rows.length} | Total amount: $${(total / 100).toFixed(2)}`, { align: 'center' });
  doc.moveDown();

  // Table header
  const cols = [
    { label: 'Date', x: 40, w: 80 },
    { label: 'Merchant', x: 120, w: 200 },
    { label: 'Description', x: 320, w: 200 },
    { label: 'Category', x: 520, w: 100 },
    { label: 'Amount', x: 620, w: 80 },
  ];

  let y = doc.y;
  doc.fontSize(8).font('Helvetica-Bold');
  for (const col of cols) {
    doc.text(col.label, col.x, y, { width: col.w });
  }
  y += 15;
  doc.moveTo(40, y).lineTo(720, y).stroke();
  y += 5;

  doc.font('Helvetica').fontSize(7);
  for (const row of rows) {
    if (y > 560) {
      doc.addPage();
      y = 40;
    }

    doc.text(row.transaction_date || '', cols[0].x, y, { width: cols[0].w });
    doc.text((row.merchant_name || '').substring(0, 35), cols[1].x, y, { width: cols[1].w });
    doc.text((row.description || '').substring(0, 35), cols[2].x, y, { width: cols[2].w });
    doc.text(row.category || '', cols[3].x, y, { width: cols[3].w });
    doc.text('$' + (row.amount / 100).toFixed(2), cols[4].x, y, { width: cols[4].w, align: 'right' });
    y += 12;
  }

  doc.end();
});

module.exports = router;
