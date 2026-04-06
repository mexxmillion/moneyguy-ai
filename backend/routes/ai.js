const express = require('express');
const { queryAI, executeQuery, summarizeResults } = require('../services/ai');

const router = express.Router();

router.post('/query', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: 'Question required' });

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'OpenRouter API key not configured' });

    // Step 1: AI generates SQL
    const { sql, explanation } = await queryAI(question, apiKey, req.userId);

    // Step 2: Execute query
    const { rows, error } = executeQuery(sql);
    if (error) {
      return res.json({ sql, explanation, error, rows: [], summary: `Query failed: ${error}` });
    }

    // Step 3: Summarize results
    const summary = await summarizeResults(question, rows, sql, apiKey);

    res.json({ sql, explanation, rows, summary, rowCount: rows.length });
  } catch (err) {
    console.error('AI query error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
