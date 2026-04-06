const db = require('../db');

function categorize(description) {
  const rules = db.prepare(`
    SELECT mr.merchant_pattern, c.name as category_name, mr.priority
    FROM merchant_rules mr
    JOIN categories c ON c.id = mr.category_id
    ORDER BY mr.priority DESC
  `).all();

  const upper = (description || '').toUpperCase();

  for (const rule of rules) {
    if (upper.includes(rule.merchant_pattern.toUpperCase())) {
      return { category: rule.category_name, rule: rule.merchant_pattern, confidence: 'high' };
    }
  }

  return { category: 'Uncategorized', rule: null, confidence: 'none' };
}

function categorizeAll(transactions) {
  return transactions.map(t => {
    const result = categorize(t.description);
    return { ...t, category: result.category, matched_rule: result.rule, confidence: result.confidence };
  });
}

module.exports = { categorize, categorizeAll };
