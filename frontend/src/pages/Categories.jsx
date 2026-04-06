import { apiFetch } from '../UserContext';
import { useState, useEffect, useCallback } from 'react';
import CategoryBadge from '../components/CategoryBadge';

const ICON_OPTIONS = ['📁','🛒','🍽️','🚗','📱','🛍️','🎭','🔧','💳','✅','❓','🚫','🔄','🏠','🐾','💊','🎓','👶','💇','🏋️','✈️','🎁','🧾','💡','📦'];
const COLOR_OPTIONS = [
  { value: '#22c55e', label: 'Green' },
  { value: '#f97316', label: 'Orange' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Violet' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#14b8a6', label: 'Teal' },
  { value: '#64748b', label: 'Slate' },
  { value: '#ef4444', label: 'Red' },
  { value: '#10b981', label: 'Emerald' },
  { value: '#eab308', label: 'Yellow' },
  { value: '#0ea5e9', label: 'Sky' },
  { value: '#6b7280', label: 'Gray' },
];

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [rules, setRules] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [newRule, setNewRule] = useState({ merchant_pattern: '', category_id: '' });

  // Category management state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', color: '', icon: '' });
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', color: '#6b7280', icon: '📁' });
  const [catError, setCatError] = useState('');

  const loadCategories = useCallback(() => {
    apiFetch('/api/transactions/categories').then(r => r.json()).then(setCategories);
  }, []);

  useEffect(() => {
    loadCategories();
    apiFetch('/api/transactions/merchant-rules').then(r => r.json()).then(setRules);
  }, [loadCategories]);

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

  // --- Category CRUD ---

  function startEdit(cat) {
    setEditingId(cat.id);
    setEditForm({ name: cat.name, color: cat.color || '#6b7280', icon: cat.icon || '📁' });
    setCatError('');
  }

  function cancelEdit() {
    setEditingId(null);
    setCatError('');
  }

  async function saveEdit() {
    setCatError('');
    if (!editForm.name.trim()) { setCatError('Name required'); return; }
    const oldCat = categories.find(c => c.id === editingId);
    const res = await apiFetch(`/api/categories/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    if (!res.ok) { setCatError('Failed to save'); return; }
    // If name changed, update all transactions using the old name
    if (oldCat && oldCat.name !== editForm.name.trim()) {
      await apiFetch('/api/transactions/bulk-recategorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_category: oldCat.name, new_category: editForm.name.trim() }),
      });
    }
    setEditingId(null);
    loadCategories();
    loadTransactions();
  }

  async function addCategory() {
    setCatError('');
    if (!addForm.name.trim()) { setCatError('Name required'); return; }
    const res = await apiFetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(addForm),
    });
    const data = await res.json();
    if (!res.ok) { setCatError(data.error || 'Failed to add'); return; }
    setAddForm({ name: '', color: '#6b7280', icon: '📁' });
    setShowAdd(false);
    loadCategories();
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-200">Categories & Rules</h2>

      {/* Category management */}
      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-400">Categories ({categories.length})</h3>
          {!showAdd && (
            <button onClick={() => { setShowAdd(true); setCatError(''); }}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs text-white font-medium">
              + Add Category
            </button>
          )}
        </div>

        {/* Add new category form */}
        {showAdd && (
          <div className="bg-gray-800 rounded-lg p-4 mb-4 border border-gray-700">
            <h4 className="text-sm font-medium text-white mb-3">New Category</h4>
            <div className="flex gap-3 items-end flex-wrap">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Icon</label>
                <div className="flex gap-1 flex-wrap max-w-xs">
                  {ICON_OPTIONS.map(icon => (
                    <button key={icon} onClick={() => setAddForm({ ...addForm, icon })}
                      className={`w-8 h-8 rounded text-lg flex items-center justify-center transition-colors ${
                        addForm.icon === icon ? 'bg-emerald-600 ring-2 ring-emerald-400' : 'bg-gray-700 hover:bg-gray-600'
                      }`}>
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="block text-xs text-gray-500 mb-1">Name</label>
                <input value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })}
                  placeholder="e.g. Pet Care"
                  onKeyDown={e => e.key === 'Enter' && addCategory()}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white" autoFocus />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Color</label>
                <div className="flex gap-1 flex-wrap">
                  {COLOR_OPTIONS.map(c => (
                    <button key={c.value} onClick={() => setAddForm({ ...addForm, color: c.value })}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        addForm.color === c.value ? 'border-white scale-125' : 'border-transparent hover:scale-110'
                      }`}
                      style={{ backgroundColor: c.value }} title={c.label} />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={addCategory}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm text-white font-medium">
                  Add
                </button>
                <button onClick={() => { setShowAdd(false); setCatError(''); }}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-sm text-white">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {catError && (
          <div className="mb-3 text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{catError}</div>
        )}

        {/* Category list */}
        <div className="grid gap-2">
          {categories.map(cat => (
            <div key={cat.id} className="flex items-center gap-3 bg-gray-800 rounded-lg px-3 py-2.5 group">
              {editingId === cat.id ? (
                <>
                  {/* Editing mode */}
                  <div className="flex gap-1">
                    {ICON_OPTIONS.slice(0, 12).map(icon => (
                      <button key={icon} onClick={() => setEditForm({ ...editForm, icon })}
                        className={`w-7 h-7 rounded text-sm flex items-center justify-center ${
                          editForm.icon === icon ? 'bg-emerald-600 ring-1 ring-emerald-400' : 'bg-gray-700 hover:bg-gray-600'
                        }`}>
                        {icon}
                      </button>
                    ))}
                  </div>
                  <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                    className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white" autoFocus />
                  <div className="flex gap-1">
                    {COLOR_OPTIONS.map(c => (
                      <button key={c.value} onClick={() => setEditForm({ ...editForm, color: c.value })}
                        className={`w-5 h-5 rounded-full border-2 ${
                          editForm.color === c.value ? 'border-white scale-125' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c.value }} />
                    ))}
                  </div>
                  <button onClick={saveEdit} className="text-emerald-400 hover:text-emerald-300 text-xs font-medium px-2">Save</button>
                  <button onClick={cancelEdit} className="text-gray-500 hover:text-gray-300 text-xs px-2">Cancel</button>
                </>
              ) : (
                <>
                  {/* Display mode */}
                  <span className="text-lg w-7 text-center">{cat.icon || '📁'}</span>
                  <span className="flex-1 text-sm text-white font-medium">{cat.name}</span>
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color || '#6b7280' }} />
                  <button onClick={() => startEdit(cat)}
                    className="text-gray-500 hover:text-white text-xs px-2 py-1 rounded hover:bg-gray-700 transition-colors">
                    Edit
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

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
