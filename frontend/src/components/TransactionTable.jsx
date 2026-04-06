import { useState } from 'react';
import CategoryBadge from './CategoryBadge';

const fmt = (cents) => {
  const n = parseFloat(cents);
  const dollars = Number.isInteger(n) && Math.abs(n) > 100 ? n / 100 : n;
  return (dollars < 0 ? '-' : '') + Math.abs(dollars).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
};

const SORT_COLS = ['transaction_date', 'merchant_name', 'category', 'amount'];

export default function TransactionTable({
  transactions, categories, onUpdate,
  selectable, selectedIds, onSelect,
  sort, order, onSort,
}) {
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [lastClickedIdx, setLastClickedIdx] = useState(null);

  const handleRowClick = (e, tx, idx) => {
    if (!selectable || !onSelect) return;
    // Ignore clicks on interactive elements
    if (e.target.closest('select,button,input,a')) return;
    if (e.shiftKey && lastClickedIdx !== null) {
      const lo = Math.min(lastClickedIdx, idx);
      const hi = Math.max(lastClickedIdx, idx);
      for (let i = lo; i <= hi; i++) onSelect(transactions[i].id, true);
    } else {
      onSelect(tx.id);
      setLastClickedIdx(idx);
    }
  };

  const startEdit = (tx) => {
    setEditingId(tx.id);
    setEditValues({ category: tx.category, notes: tx.notes || '' });
  };

  const saveEdit = async (id) => {
    if (onUpdate) await onUpdate(id, editValues);
    setEditingId(null);
  };

  const SortIcon = ({ col }) => {
    if (!onSort) return null;
    if (sort !== col) return <span className="ml-1 text-gray-700">↕</span>;
    return <span className="ml-1 text-emerald-400">{order === 'ASC' ? '↑' : '↓'}</span>;
  };

  const handleSort = (col) => {
    if (!onSort || !SORT_COLS.includes(col)) return;
    if (sort === col) {
      onSort(col, order === 'ASC' ? 'DESC' : 'ASC');
    } else {
      onSort(col, col === 'amount' ? 'DESC' : 'ASC');
    }
  };

  const Th = ({ col, label, className = '' }) => (
    <th
      className={`p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider select-none
        ${SORT_COLS.includes(col) && onSort ? 'cursor-pointer hover:text-gray-300' : ''} ${className}`}
      onClick={() => handleSort(col)}
    >
      {label}<SortIcon col={col} />
    </th>
  );

  const isSelected = (id) => selectedIds?.has(id);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-950/60">
          <tr className="border-b border-gray-800">
            <Th col="transaction_date" label="Date" />
            <Th col="merchant_name" label="Merchant" />
            <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
            <Th col="category" label="Category" />
            <Th col="amount" label="Amount" className="text-right" />
            <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
            <th className="p-3 w-16" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/50">
          {transactions.map((tx, idx) => (
            <tr
              key={tx.id}
              onClick={(e) => handleRowClick(e, tx, idx)}
              className={`transition-colors group ${
                isSelected(tx.id)
                  ? 'bg-emerald-900/25 border-l-2 border-l-emerald-500'
                  : tx.category === 'Ignore'
                  ? 'opacity-40 hover:opacity-70 border-l-2 border-l-transparent'
                  : 'hover:bg-gray-800/30 border-l-2 border-l-transparent'
              } ${selectable ? 'cursor-pointer select-none' : ''}`}
            >
              <td className="p-3 whitespace-nowrap text-gray-400 text-xs">{tx.transaction_date}</td>
              <td className="p-3 text-gray-100 max-w-[180px] truncate font-medium">{tx.merchant_name}</td>
              <td className="p-3 text-gray-500 max-w-[220px] truncate text-xs">{tx.description}</td>
              <td className="p-3">
                {editingId === tx.id ? (
                  <select
                    value={editValues.category}
                    onChange={e => setEditValues({ ...editValues, category: e.target.value })}
                    className="bg-gray-800 border border-gray-600 text-sm rounded px-2 py-1 text-white"
                  >
                    {(categories || []).map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                ) : tx.category === 'Uncategorized' || !tx.category ? (
                  <select
                    defaultValue=""
                    onChange={e => { if (e.target.value && onUpdate) onUpdate(tx.id, { category: e.target.value }); }}
                    className="bg-amber-900/40 border border-amber-700/60 text-xs rounded px-2 py-1 text-amber-300 cursor-pointer hover:border-amber-500"
                  >
                    <option value="" disabled>⚡ Categorize</option>
                    {(categories || []).map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                ) : (
                  <CategoryBadge category={tx.category} />
                )}
              </td>
              <td className={`p-3 text-right font-mono whitespace-nowrap text-sm ${tx.amount < 0 ? 'text-emerald-400' : 'text-gray-200'}`}>
                {fmt(tx.amount)}
              </td>
              <td className="p-3">
                {editingId === tx.id ? (
                  <input
                    value={editValues.notes}
                    onChange={e => setEditValues({ ...editValues, notes: e.target.value })}
                    className="bg-gray-800 border border-gray-600 text-sm rounded px-2 py-1 w-full text-white"
                    placeholder="Notes…"
                  />
                ) : (
                  <span className="text-gray-600 text-xs">{tx.notes}</span>
                )}
              </td>
              <td className="p-3 text-center">
                {editingId === tx.id ? (
                  <div className="flex gap-1 justify-center">
                    <button onClick={() => saveEdit(tx.id)} className="text-emerald-400 hover:text-emerald-300 text-xs font-medium">Save</button>
                    <button onClick={() => setEditingId(null)} className="text-gray-500 hover:text-gray-300 text-xs">✕</button>
                  </div>
                ) : (
                  <button onClick={() => startEdit(tx)} className="text-gray-600 hover:text-gray-300 text-xs opacity-0 group-hover:opacity-100 transition-opacity">Edit</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {transactions.length === 0 && (
        <p className="text-gray-600 text-center py-10 text-sm">No transactions found</p>
      )}
    </div>
  );
}
