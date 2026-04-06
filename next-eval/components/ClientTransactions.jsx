'use client';

import { useState, useEffect, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import { fmt, fmtShort } from '@/components/format';

const SORTS = ['transaction_date', 'merchant_name', 'category', 'amount'];

export default function ClientTransactions({ initialFilters = {} }) {
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
  const [summary, setSummary] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editVals, setEditVals] = useState({});

  useEffect(() => {
    fetch('/api/transactions/categories').then(r => r.json()).then(setCategories);
    fetch('/api/transactions/filters').then(r => r.json()).then(d => setAccounts(d.accounts || []));
  }, []);

  const load = useCallback(() => {
    const params = new URLSearchParams({ page, limit: 50, sort, order, ...filters });
    for (const [k, v] of [...params.entries()]) { if (!v) params.delete(k); }
    fetch(`/api/transactions?${params}`).then(r => r.json()).then(d => {
      setTransactions(d.transactions || []);
      setTotalPages(d.totalPages || 1);
      setTotal(d.total || 0);
    });
    const sp = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) sp.set(k, v); });
    fetch(`/api/transactions/summary?${sp}`).then(r => r.json()).then(setSummary);
  }, [page, filters, sort, order]);

  useEffect(() => { load(); }, [load]);

  const handleSort = (col) => {
    if (sort === col) setOrder(o => o === 'ASC' ? 'DESC' : 'ASC');
    else { setSort(col); setOrder(col === 'amount' ? 'DESC' : 'ASC'); }
    setPage(1);
  };

  const toggle = (id) => setSelectedIds(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleUpdate = async (id, vals) => {
    await fetch(`/api/transactions/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(vals) });
    load();
  };

  const handleBulk = async () => {
    if (!selectedIds.size || !bulkCategory) return;
    await fetch('/api/transactions/bulk-categorize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [...selectedIds], category: bulkCategory }) });
    setSelectedIds(new Set());
    load();
  };

  const handleAI = async () => {
    setAiLoading(true); setAiResult(null);
    try {
      const r = await fetch('/api/transactions/ai-categorize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const d = await r.json();
      setAiResult(d.updated);
      load();
    } catch { setAiResult(-1); }
    setAiLoading(false);
  };

  const exportUrl = (fmt) => {
    const p = new URLSearchParams(filters);
    for (const [k, v] of [...p.entries()]) { if (!v) p.delete(k); }
    return `/api/export/${fmt}?${p}`;
  };

  const SortTh = ({ col, label, right }) => (
    <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted)] cursor-pointer hover:text-[var(--text)] ${right ? 'text-right' : 'text-left'}`} onClick={() => handleSort(col)}>
      {label} {sort === col ? (order === 'ASC' ? '↑' : '↓') : ''}
    </th>
  );

  return (
    <AppShell
      title="Transactions"
      subtitle={`${total} transactions total`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleAI} disabled={aiLoading} className="flex items-center gap-2 rounded-full bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-200 disabled:opacity-50">
            {aiLoading ? '⏳ Categorising…' : '✨ AI Categorize'}
          </button>
          {aiResult !== null && <span className="text-xs font-medium text-[var(--secondary)]">{aiResult > 0 ? `✓ ${aiResult} updated` : '✓ All done'}</span>}
          <a href={exportUrl('csv')} className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface-muted)]">CSV</a>
          <a href={exportUrl('pdf')} className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface-muted)]">PDF</a>
        </div>
      }
    >
      {/* Filters */}
      <div className="surface-card rounded-[1.5rem] p-5 mb-6 flex flex-wrap gap-3 items-end">
        {[
          { key: 'search', label: 'Search', type: 'text', placeholder: 'Description…' },
          { key: 'merchant', label: 'Merchant', type: 'text', placeholder: 'Merchant…' },
          { key: 'date_from', label: 'From', type: 'date' },
          { key: 'date_to', label: 'To', type: 'date' },
        ].map(({ key, label, type, placeholder }) => (
          <div key={key}>
            <label className="block text-xs text-[var(--muted)] mb-1">{label}</label>
            <input type={type} value={filters[key] || ''} onChange={e => { setFilters(f => ({ ...f, [key]: e.target.value })); setPage(1); }} placeholder={placeholder}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20" />
          </div>
        ))}
        <div>
          <label className="block text-xs text-[var(--muted)] mb-1">Category</label>
          <select value={filters.category || ''} onChange={e => { setFilters(f => ({ ...f, category: e.target.value })); setPage(1); }}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm focus:outline-none">
            <option value="">All</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-[var(--muted)] mb-1">Account</label>
          <select value={filters.account_id || ''} onChange={e => { setFilters(f => ({ ...f, account_id: e.target.value })); setPage(1); }}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm max-w-[200px] focus:outline-none">
            <option value="">All accounts</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      </div>

      {/* Summary strip */}
      {summary && (
        <div className="surface-card rounded-[1.5rem] mb-6 grid grid-cols-3 divide-x divide-[var(--border)] sm:grid-cols-6">
          {[
            ['Count', (summary.count||0).toLocaleString(), ''],
            ['Total', fmt(summary.sum), 'text-[var(--tertiary)]'],
            ['Avg', fmt(summary.avg), 'text-amber-600'],
            ['Min', fmt(summary.min), 'text-[var(--secondary)]'],
            ['Max', fmt(summary.max), 'text-[var(--tertiary)]'],
            ['Credits', fmt(summary.totalCredits), 'text-[var(--primary)]'],
          ].map(([label, value, color]) => (
            <div key={label} className="px-4 py-3 text-center">
              <div className="text-xs text-[var(--muted)]">{label}</div>
              <div className={`mt-1 text-sm font-bold ${color}`}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="surface-card rounded-2xl mb-4 flex items-center gap-3 px-5 py-3">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <select value={bulkCategory} onChange={e => setBulkCategory(e.target.value)}
            className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm">
            <option value="">Select category…</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <button onClick={handleBulk} className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white">Apply</button>
          <button onClick={() => setSelectedIds(new Set())} className="text-sm text-[var(--muted)] hover:text-[var(--text)]">Clear</button>
        </div>
      )}

      {/* Table */}
      <div className="surface-card rounded-[1.5rem] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
              <tr>
                <SortTh col="transaction_date" label="Date" />
                <SortTh col="merchant_name" label="Merchant" />
                <SortTh col="category" label="Category" />
                <SortTh col="amount" label="Amount" right />
                <th className="px-4 py-3 text-xs font-semibold uppercase text-[var(--muted)]">Notes</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {transactions.map(tx => (
                <tr key={tx.id} onClick={() => toggle(tx.id)} className={`cursor-pointer transition-colors ${selectedIds.has(tx.id) ? 'bg-blue-50' : 'hover:bg-[var(--surface-muted)]'}`}>
                  <td className="px-4 py-4 text-xs text-[var(--muted)] whitespace-nowrap">{tx.transaction_date}</td>
                  <td className="px-4 py-4 max-w-[180px] truncate font-semibold">{tx.merchant_name}</td>
                  <td className="px-4 py-4">
                    {editId === tx.id ? (
                      <select value={editVals.category || ''} onChange={e => setEditVals(v => ({ ...v, category: e.target.value }))}
                        onClick={e => e.stopPropagation()}
                        className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 text-xs">
                        {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-xs font-medium">{tx.category || '?'}</span>
                    )}
                  </td>
                  <td className={`px-4 py-4 text-right font-mono text-sm font-semibold ${tx.amount < 0 ? 'text-[var(--secondary)]' : 'text-[var(--tertiary)]'}`}>
                    {tx.amount < 0 ? '+' : ''}{fmtShort(tx.amount)}
                  </td>
                  <td className="px-4 py-4 text-xs text-[var(--muted)] max-w-[140px] truncate">{tx.notes}</td>
                  <td className="px-4 py-4 text-center" onClick={e => e.stopPropagation()}>
                    {editId === tx.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => { handleUpdate(tx.id, editVals); setEditId(null); }} className="text-xs font-semibold text-[var(--secondary)]">Save</button>
                        <button onClick={() => setEditId(null)} className="text-xs text-[var(--muted)]">✕</button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditId(tx.id); setEditVals({ category: tx.category, notes: tx.notes || '' }); }}
                        className="text-xs text-[var(--muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--text)]">Edit</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {transactions.length === 0 && <p className="text-center py-12 text-[var(--muted)] text-sm">No transactions found</p>}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 border-t border-[var(--border)] px-5 py-4">
            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
              className="rounded-full border border-[var(--border)] px-4 py-1.5 text-sm disabled:opacity-40">Prev</button>
            <span className="text-sm text-[var(--muted)]">Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}
              className="rounded-full border border-[var(--border)] px-4 py-1.5 text-sm disabled:opacity-40">Next</button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
