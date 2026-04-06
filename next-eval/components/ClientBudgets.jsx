'use client';

import { useEffect, useState, useCallback } from 'react';
import AppShell from '@/components/AppShell';
import { fmt } from '@/components/format';

export default function ClientBudgets() {
  const [data, setData] = useState(null);
  const [month, setMonth] = useState(() => { const d=new Date(); return { month:String(d.getMonth()+1), year:String(d.getFullYear()) }; });
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ category:'', limit:'' });
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);

  const load = useCallback(() => {
    fetch(`/api/budgets?month=${month.month}&year=${month.year}`).then(r=>r.json()).then(setData);
  }, [month]);

  useEffect(()=>{ load(); }, [load]);
  useEffect(()=>{ fetch('/api/categories').then(r=>r.json()).then(d=>setCategories((d.categories||d||[]).map(c=>c.name||c))).catch(()=>{}); }, []);

  const handleAdd = async () => {
    const limitCents = Math.round(parseFloat(addForm.limit)*100);
    if (!addForm.category || isNaN(limitCents) || limitCents <= 0) return;
    setSaving(true);
    await fetch('/api/budgets', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ category:addForm.category, monthly_limit:limitCents }) });
    setSaving(false); setShowAdd(false); setAddForm({ category:'', limit:'' }); load();
  };

  const handleDelete = async (id) => { await fetch(`/api/budgets/${id}`,{method:'DELETE'}); load(); };

  if (!data) return <AppShell title="Budget"><div className="text-sm text-[var(--muted)]">Loading budgets…</div></AppShell>;

  const { summary, budgets, unbudgeted } = data;
  const monthLabel = new Date(parseInt(month.year), parseInt(month.month)-1).toLocaleString('default',{month:'long', year:'numeric'});
  const over = budgets.filter(b=>b.status==='over');
  const warn = budgets.filter(b=>b.status==='warning');

  return (
    <AppShell title="Budget" subtitle={monthLabel}>
      {/* Hero */}
      {summary.totalLimit > 0 && (
        <div className="primary-gradient relative overflow-hidden rounded-[2rem] px-8 py-10 text-white shadow-2xl shadow-blue-200/60 mb-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="text-xs font-semibold tracking-[0.3em] text-white/70 mb-4 uppercase">{monthLabel}</div>
              <div className="text-4xl font-black md:text-6xl leading-none">
                {summary.remaining >= 0 ? `On track to save ${fmt(summary.remaining)}` : `${fmt(Math.abs(summary.remaining))} over budget`}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-white/60 mb-1">Monthly Budget</div>
              <div className="text-3xl font-bold">{fmt(summary.totalLimit)}</div>
            </div>
          </div>
          <div className="mt-8 h-2 rounded-full bg-white/20 overflow-hidden">
            <div className="h-2 rounded-full bg-white transition-all" style={{ width: `${Math.min(summary.totalLimit>0?(summary.totalSpent/summary.totalLimit)*100:0,100)}%` }} />
          </div>
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        </div>
      )}

      {/* Alerts */}
      {(over.length > 0 || warn.length > 0) && (
        <div className="mb-8 space-y-3">
          {over.map(b => (
            <div key={b.id} className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm">
              <span className="text-lg">⚠️</span>
              <span className="text-red-700">You're <strong>{fmt(b.spent-b.monthlyLimit)}</strong> over budget on <strong>{b.category}</strong>.</span>
            </div>
          ))}
          {warn.map(b => (
            <div key={b.id} className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm">
              <span className="text-lg">💛</span>
              <span className="text-amber-700">{b.pct}% of your <strong>{b.category}</strong> budget used — <strong>{fmt(b.remaining)}</strong> left.</span>
            </div>
          ))}
        </div>
      )}

      {/* Month nav */}
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <select value={month.month} onChange={e=>setMonth(m=>({...m,month:e.target.value}))}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm">
            {Array.from({length:12},(_,i)=>({v:String(i+1),l:new Date(2026,i).toLocaleString('default',{month:'long'})})).map(m=><option key={m.v} value={m.v}>{m.l}</option>)}
          </select>
          <input type="number" value={month.year} onChange={e=>setMonth(m=>({...m,year:e.target.value}))}
            className="w-20 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm" />
        </div>
        <button onClick={()=>setShowAdd(true)} className="rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-200/60">+ Add Budget</button>
      </div>

      {/* Budget cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        {budgets.map(b => {
          const barColor = b.status==='over' ? 'bg-[var(--tertiary)]' : b.status==='warning' ? 'bg-amber-500' : 'bg-[var(--secondary)]';
          const labelColor = b.status==='over' ? 'text-[var(--tertiary)]' : b.status==='warning' ? 'text-amber-600' : 'text-[var(--muted)]';
          return (
            <div key={b.id} className="surface-card group rounded-[1.75rem] p-6">
              <div className="flex items-start justify-between mb-6">
                <div className="text-lg font-bold">{b.category}</div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${b.status==='over'?'bg-red-100 text-red-700':b.status==='warning'?'bg-amber-100 text-amber-700':'bg-green-100 text-green-700'}`}>{b.pct}%</span>
              </div>
              <div className="flex items-baseline justify-between mb-4">
                <div className="text-2xl font-black">{fmt(b.spent)}</div>
                <div className="text-sm text-[var(--muted)]">/ {fmt(b.monthlyLimit)}</div>
              </div>
              <div className="h-2 w-full rounded-full bg-[var(--surface-soft)] overflow-hidden">
                <div className={`h-2 rounded-full transition-all ${barColor}`} style={{ width:`${b.pct}%` }} />
              </div>
              <div className={`mt-4 flex items-center justify-between text-xs ${labelColor}`}>
                <span>{b.status==='over' ? `${fmt(b.spent-b.monthlyLimit)} over` : `${fmt(b.remaining)} left`}</span>
                <button onClick={()=>handleDelete(b.id)} className="opacity-0 group-hover:opacity-100 text-[var(--muted)] hover:text-[var(--tertiary)] transition-opacity">✕</button>
              </div>
            </div>
          );
        })}
        {budgets.length === 0 && <p className="col-span-3 text-center py-12 text-[var(--muted)]">No budgets set yet.</p>}
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="surface-card rounded-[1.75rem] p-6 mb-6 space-y-4">
          <h3 className="font-bold text-lg">Add Budget</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1">Category</label>
              {categories.length > 0 ? (
                <select value={addForm.category} onChange={e=>setAddForm(f=>({...f,category:e.target.value}))}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm">
                  <option value="">Select…</option>
                  {categories.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <input type="text" value={addForm.category} onChange={e=>setAddForm(f=>({...f,category:e.target.value}))} placeholder="e.g. Groceries"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm" />
              )}
            </div>
            <div>
              <label className="block text-xs text-[var(--muted)] mb-1">Monthly Limit ($)</label>
              <input type="number" value={addForm.limit} onChange={e=>setAddForm(f=>({...f,limit:e.target.value}))} placeholder="500"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving} className="rounded-full bg-[var(--secondary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving?'Saving…':'Save Budget'}</button>
            <button onClick={()=>setShowAdd(false)} className="rounded-full border border-[var(--border)] px-5 py-2.5 text-sm font-medium">Cancel</button>
          </div>
        </div>
      )}

      {/* Unbudgeted */}
      {unbudgeted?.length > 0 && (
        <div className="surface-card rounded-[1.75rem] p-6">
          <h3 className="font-semibold mb-4 text-[var(--muted)]">Unbudgeted Spending This Month</h3>
          <div className="space-y-2">
            {unbudgeted.map((u,i) => (
              <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-[var(--border)] last:border-0">
                <span>{u.category||'Uncategorized'}</span>
                <span className="font-semibold text-[var(--tertiary)]">{fmt(u.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}
