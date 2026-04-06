import { apiFetch } from '../UserContext';
import { useState, useEffect, useCallback } from 'react';
import CategoryBadge from '../components/CategoryBadge';

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [rules, setRules] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [newRule, setNewRule] = useState({ merchant_pattern: '', category_id: '' });

  useEffect(() => {
    apiFetch('/api/transactions/categories').then(r => r.json()).then(setCategories);
    apiFetch('/api/transactions/merchant-rules').then(r => r.json()).then(setRules);
  }, []);

  const loadTransactions = useCallback(() => {
    apiFetch(`/api/transactions?page=${page}&limit=30&sort=transaction_date&order=DESC`)
      .then(r => r.json())
      .then(data => {
        setTransactions(data.transactions);
        setTotalPages(data.totalPages);
      });
  }, [page]);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  const updateCategory = async (id, category) => {
    await apiFetch(`/api/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, is_reviewed: true }),
    });
    loadTransactions();
  };

  const addRule = async () => {
    if (!newRule.merchant_pattern || !newRule.category_id) return;
    await apiFetch('/api/transactions/merchant-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newRule, priority: 10 }),
    });
    setNewRule({ merchant_pattern: '', category_id: '' });
    apiFetch('/api/transactions/merchant-rules').then(r => r.json()).then(setRules);
  };

  const findMatchingRule = (desc) => {
    const upper = (desc || '').toUpperCase();
    return rules.find(r => upper.includes(r.merchant_pattern.toUpperCase()));
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-200">Category Review</h2>

      {/* Add rule */}
      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Add Merchant Rule</h3>
        <div className="flex gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Merchant Pattern</label>
            <input
              value={newRule.merchant_pattern}
              onChange={e => setNewRule({ ...newRule, merchant_pattern: e.target.value })}
              placeholder="e.g. STARBUCKS"
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white w-48"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Category</label>
            <select
              value={newRule.category_id}
              onChange={e => setNewRule({ ...newRule, category_id: e.target.value })}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="">Select...</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <button onClick={addRule}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm text-white">
            Add Rule
          </button>
        </div>
      </div>

      {/* Current rules */}
      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Active Rules ({rules.length})</h3>
        <div className="flex flex-wrap gap-2">
          {rules.map(r => (
            <div key={r.id} className="flex items-center gap-1.5 bg-gray-800 rounded-lg px-2.5 py-1.5 text-xs">
              <span className="text-gray-400 font-mono">{r.merchant_pattern}</span>
              <span className="text-gray-600">→</span>
              <CategoryBadge category={r.category_name} />
            </div>
          ))}
        </div>
      </div>

      {/* Transaction review */}
      <div className="bg-gray-900 rounded-xl border border-gray-800">
        <div className="p-4 border-b border-gray-800">
          <h3 className="text-sm font-medium text-gray-400">Review Transactions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-800">
                <th className="p-2 text-left">Date</th>
                <th className="p-2 text-left">Description</th>
                <th className="p-2 text-left">Matched Rule</th>
                <th className="p-2 text-left">Category</th>
                <th className="p-2 text-right">Amount</th>
                <th className="p-2 text-center">Change Category</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => {
                const matchedRule = findMatchingRule(tx.description);
                return (
                  <tr key={tx.id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                    <td className="p-2 text-gray-300 whitespace-nowrap">{tx.transaction_date}</td>
                    <td className="p-2 text-gray-400 max-w-[300px] truncate">{tx.description}</td>
                    <td className="p-2">
                      {matchedRule ? (
                        <span className="text-xs font-mono text-emerald-400">{matchedRule.merchant_pattern}</span>
                      ) : (
                        <span className="text-xs text-gray-600">No match</span>
                      )}
                    </td>
                    <td className="p-2"><CategoryBadge category={tx.category} /></td>
                    <td className="p-2 text-right font-mono text-gray-200">
                      ${(tx.amount / 100).toFixed(2)}
                    </td>
                    <td className="p-2">
                      <select
                        value={tx.category || ''}
                        onChange={e => updateCategory(tx.id, e.target.value)}
                        className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white w-full"
                      >
                        {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 p-3 border-t border-gray-800">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-300 disabled:opacity-50">Prev</button>
            <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-300 disabled:opacity-50">Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
