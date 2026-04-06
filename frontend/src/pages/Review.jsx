import { useState, useEffect } from 'react';
import CategoryBadge from '../components/CategoryBadge';

const fmt = (cents) => {
  const n = parseFloat(cents) || 0;
  const dollars = Number.isInteger(n) && Math.abs(n) > 100 ? n / 100 : n;
  return (dollars < 0 ? '-' : '') + Math.abs(dollars).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
};

export default function Review({ onBadgeCount }) {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch('/api/transactions/review')
      .then(r => r.json())
      .then(d => {
        setItems(d.transactions || []);
        onBadgeCount?.(d.count || 0);
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
    fetch('/api/transactions/categories').then(r => r.json()).then(setCategories);
  }, []);

  const dismiss = async (id) => {
    await fetch(`/api/transactions/review/${id}/dismiss`, { method: 'POST' });
    setItems(prev => prev.filter(t => t.id !== id));
    onBadgeCount?.(items.length - 1);
  };

  const deleteTx = async (id) => {
    if (!confirm('Delete this transaction?')) return;
    await fetch(`/api/transactions/review/${id}/delete`, { method: 'POST' });
    setItems(prev => prev.filter(t => t.id !== id));
    onBadgeCount?.(items.length - 1);
  };

  const recategorize = async (id, category) => {
    await fetch(`/api/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category }),
    });
    setItems(prev => prev.map(t => t.id === id ? { ...t, category } : t));
  };

  const dismissAll = async () => {
    await Promise.all(items.map(t => fetch(`/api/transactions/review/${t.id}/dismiss`, { method: 'POST' })));
    setItems([]);
    onBadgeCount?.(0);
  };

  if (loading) return <div className="text-center py-16 text-gray-600 text-sm animate-pulse">Loading review queue…</div>;

  if (items.length === 0) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <span className="text-4xl">✅</span>
      <p className="text-gray-400 font-medium">All clear — nothing needs review</p>
      <p className="text-gray-600 text-sm">Flagged transactions appear here when an import finds potential duplicates with different merchant names</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-200">Review Queue</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {items.length} transaction{items.length !== 1 ? 's' : ''} flagged as potential duplicates or unusual — same date/amount, different merchant
          </p>
        </div>
        <button onClick={dismissAll} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-400 hover:text-white">
          Dismiss all
        </button>
      </div>

      <div className="space-y-3">
        {items.map(tx => (
          <div key={tx.id} className="bg-gray-900 border border-amber-800/40 rounded-xl p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-amber-900/50 text-amber-400 border border-amber-800/60 rounded px-1.5 py-0.5">⚠ Flagged</span>
                  <span className="text-xs text-gray-600">{tx.transaction_date}</span>
                  <span className="text-xs text-gray-600">·</span>
                  <span className="text-xs text-gray-600">{tx.account_name || tx.institution || 'Unknown account'}</span>
                </div>
                <p className="text-sm font-medium text-gray-100">{tx.merchant_name}</p>
                <p className="text-xs text-gray-500 truncate">{tx.description}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-base font-bold font-mono ${tx.amount < 0 ? 'text-emerald-400' : 'text-gray-100'}`}>
                  {fmt(tx.amount)}
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">Category:</span>
                <select
                  value={tx.category || ''}
                  onChange={e => recategorize(tx.id, e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">Uncategorized</option>
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => dismiss(tx.id)}
                  className="px-3 py-1 bg-emerald-700 hover:bg-emerald-600 rounded text-xs text-white font-medium"
                >
                  ✓ Keep
                </button>
                <button
                  onClick={() => deleteTx(tx.id)}
                  className="px-3 py-1 bg-rose-900/50 hover:bg-rose-800 border border-rose-800/50 rounded text-xs text-rose-400 hover:text-white"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
