import { useState, useEffect, useCallback } from 'react';
import TransactionTable from '../components/TransactionTable';
import SearchBar from '../components/SearchBar';
import TransactionSummary from '../components/TransactionSummary';

export default function Transactions({ initialFilters = {} }) {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkCategory, setBulkCategory] = useState('');
  const [sort, setSort] = useState('transaction_date');
  const [order, setOrder] = useState('DESC');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  useEffect(() => {
    fetch('/api/transactions/categories').then(r => r.json()).then(setCategories);
    fetch('/api/transactions/filters').then(r => r.json()).then(data => setAccounts(data.accounts || []));
  }, []);

  useEffect(() => {
    setFilters(initialFilters || {});
    setPage(1);
  }, [initialFilters]);

  const loadTransactions = useCallback(() => {
    const params = new URLSearchParams({ page, limit: 50, sort, order, ...filters });
    // Remove empty params
    for (const [k, v] of params.entries()) {
      if (!v) params.delete(k);
    }
    fetch(`/api/transactions?${params}`)
      .then(r => r.json())
      .then(data => {
        setTransactions(data.transactions);
        setTotalPages(data.totalPages);
        setTotal(data.total);
      });
  }, [page, filters, sort, order]);

  const handleSort = (col, dir) => { setSort(col); setOrder(dir); setPage(1); };

  const handleAiCategorize = async () => {
    setAiLoading(true);
    setAiResult(null);
    try {
      const r = await fetch('/api/transactions/ai-categorize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const d = await r.json();
      setAiResult(d.updated);
      loadTransactions();
    } catch { setAiResult(-1); }
    setAiLoading(false);
  };

  useEffect(() => { loadTransactions(); }, [loadTransactions]);

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setPage(1);
  };

  const handleUpdate = async (id, values) => {
    await fetch(`/api/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    loadTransactions();
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkCategorize = async () => {
    if (selectedIds.size === 0 || !bulkCategory) return;
    await fetch('/api/transactions/bulk-categorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [...selectedIds], category: bulkCategory }),
    });
    setSelectedIds(new Set());
    loadTransactions();
  };

  const exportUrl = (format) => {
    const params = new URLSearchParams(filters);
    for (const [k, v] of params.entries()) if (!v) params.delete(k);
    return `/api/export/${format}?${params}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-200">
          Transactions <span className="text-gray-500 text-sm font-normal">({total})</span>
        </h2>
        <div className="flex gap-2">
          <button onClick={handleAiCategorize} disabled={aiLoading}
            className="px-3 py-1.5 bg-violet-700 hover:bg-violet-600 disabled:opacity-50 rounded-lg text-xs text-white font-medium flex items-center gap-1.5">
            {aiLoading ? '⏳ Categorizing…' : '✨ AI Categorize'}
          </button>
          {aiResult !== null && (
            <span className="text-xs text-emerald-400">{aiResult > 0 ? `✓ ${aiResult} updated` : aiResult === 0 ? '✓ All categorized' : '✗ Error'}</span>
          )}
          <a href={exportUrl('csv')} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-300">Export CSV</a>
          <a href={exportUrl('pdf')} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-300">Export PDF</a>
        </div>
      </div>

      <SearchBar filters={filters} onChange={handleFilterChange} categories={categories} accounts={accounts} />

      <TransactionSummary filters={filters} />

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-gray-900 rounded-lg px-4 py-2 border border-gray-800">
          <span className="text-sm text-gray-400">{selectedIds.size} selected</span>
          <select value={bulkCategory} onChange={e => setBulkCategory(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white">
            <option value="">Select category...</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <button onClick={handleBulkCategorize}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded text-xs text-white">
            Apply
          </button>
          <button onClick={() => setSelectedIds(new Set())}
            className="text-gray-500 hover:text-gray-300 text-xs">Clear</button>
        </div>
      )}

      <div className="bg-gray-900 rounded-xl border border-gray-800">
        <TransactionTable
          transactions={transactions}
          categories={categories}
          onUpdate={handleUpdate}
          selectable
          selectedIds={selectedIds}
          onSelect={toggleSelect}
          sort={sort}
          order={order}
          onSort={handleSort}
        />
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300 disabled:opacity-50">
            Prev
          </button>
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300 disabled:opacity-50">
            Next
          </button>
        </div>
      )}
    </div>
  );
}
