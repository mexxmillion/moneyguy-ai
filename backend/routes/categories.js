const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/categories
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT id, name, color, icon, parent_id
    FROM categories
    ORDER BY name
  `).all();
  res.json({ categories: rows });
});

// POST /api/categories
router.post('/', (req, res) => {
  const { name, color, icon } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const result = db.prepare(
      'INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)'
    ).run(name, color || '#6b7280', icon || '📁');
    res.json({ id: result.lastInsertRowid, ok: true });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Category already exists' });
    throw e;
  }
});

// PUT /api/categories/:id
router.put('/:id', (req, res) => {
  const { name, color, icon } = req.body;
  db.prepare('UPDATE categories SET name=?, color=?, icon=? WHERE id=?')
    .run(name, color, icon, Number(req.params.id));
  res.json({ ok: true });
});

// DELETE /api/categories/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM categories WHERE id=?').run(Number(req.params.id));
  res.json({ ok: true });
});

module.exports = router;
