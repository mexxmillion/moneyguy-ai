import { useState } from 'react';
import CategoryBadge from './CategoryBadge';

export default function TransactionTable({ transactions, categories, onUpdate, selectable, selectedIds, onSelect }) {
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});

  const startEdit = (tx) => {
    setEditingId(tx.id);
    setEditValues({ category: tx.category, notes: tx.notes || '' });
  };

  const saveEdit = async (id) => {
    if (onUpdate) await onUpdate(id, editValues);
    setEditingId(null);
  };

  const fmt = (cents) => {
    const val = (cents / 100).toFixed(2);
    return cents < 0 ? `-$${Math.abs(cents / 100).toFixed(2)}` : `$${val}`;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-400 border-b border-gray-800">
            {selectable && <th className="p-2 text-left w-8"></th>}
            <th className="p-2 text-left">Date</th>
            <th className="p-2 text-left">Merchant</th>
            <th className="p-2 text-left">Description</th>
            <th className="p-2 text-left">Category</th>
            <th className="p-2 text-right">Amount</th>
            <th className="p-2 text-left">Notes</th>
            <th className="p-2 text-center w-16">Edit</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map(tx => (
            <tr key={tx.id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
              {selectable && (
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={selectedIds?.has(tx.id)}
                    onChange={() => onSelect?.(tx.id)}
                    className="rounded bg-gray-800 border-gray-600"
                  />
                </td>
              )}
              <td className="p-2 whitespace-nowrap text-gray-300">{tx.transaction_date}</td>
              <td className="p-2 text-gray-200 max-w-[200px] truncate">{tx.merchant_name}</td>
              <td className="p-2 text-gray-400 max-w-[250px] truncate">{tx.description}</td>
              <td className="p-2">
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
                ) : (
                  <CategoryBadge category={tx.category} />
                )}
              </td>
              <td className={`p-2 text-right font-mono whitespace-nowrap ${tx.amount < 0 ? 'text-emerald-400' : 'text-gray-200'}`}>
                {fmt(tx.amount)}
              </td>
              <td className="p-2">
                {editingId === tx.id ? (
                  <input
                    value={editValues.notes}
                    onChange={e => setEditValues({ ...editValues, notes: e.target.value })}
                    className="bg-gray-800 border border-gray-600 text-sm rounded px-2 py-1 w-full text-white"
                    placeholder="Notes..."
                  />
                ) : (
                  <span className="text-gray-500 text-xs">{tx.notes}</span>
                )}
              </td>
              <td className="p-2 text-center">
                {editingId === tx.id ? (
                  <div className="flex gap-1 justify-center">
                    <button onClick={() => saveEdit(tx.id)} className="text-emerald-400 hover:text-emerald-300 text-xs">Save</button>
                    <button onClick={() => setEditingId(null)} className="text-gray-500 hover:text-gray-300 text-xs">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => startEdit(tx)} className="text-gray-500 hover:text-gray-300 text-xs">Edit</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {transactions.length === 0 && (
        <p className="text-gray-500 text-center py-8">No transactions found</p>
      )}
    </div>
  );
}
