import { apiFetch } from '../UserContext';
import { useEffect, useState, useCallback } from 'react';

const STATUS_BAR = {
  ok:      'bg-emerald-500',
  warning: 'bg-amber-400',
  over:    'bg-rose-500',
};

const STATUS_LABEL = {
  ok:      { text: 'On track',  color: 'text-emerald-400' },
  warning: { text: 'Heads up',  color: 'text-amber-400'   },
  over:    { text: 'Over',      color: 'text-rose-400'    },
};

function fmt(cents) {
  return (Math.abs(cents || 0) / 100).toLocaleString('en-CA', {
    style: 'currency', currency: 'CAD', minimumFractionDigits: 2,
  });
}

export default function Budgets() {
  const [data, setData]         = useState(null);
  const [month, setMonth]       = useState(() => {
    const d = new Date();
    return { month: String(d.getMonth() + 1), year: String(d.getFullYear()) };
  });
  const [showAdd, setShowAdd]   = useState(false);
  const [addForm, setAddForm]   = useState({ category: '', limit: '' });
  const [saving, setSaving]     = useState(false);
  const [categories, setCategories] = useState([]);

  const load = useCallback(() => {
    apiFetch(`/api/budgets?month=${month.month}&year=${month.year}`)
      .then(r => r.json()).then(setData);
  }, [month]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    apiFetch('/api/categories').then(r => r.json()).then(d => {
      setCategories((d.categories || d || []).map(c => c.name || c));
    }).catch(() => {});
  }, []);

  const handleAdd = async () => {
    const limitCents = Math.round(parseFloat(addForm.limit) * 100);
    if (!addForm.category || isNaN(limitCents) || limitCents <= 0) return;
    setSaving(true);
    await apiFetch('/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: addForm.category, monthly_limit: limitCents }),
    });
    setSaving(false);
    setShowAdd(false);
    setAddForm({ category: '', limit: '' });
    load();
  };

  const handleDelete = async (id) => {
    await apiFetch(`/api/budgets/${id}`, { method: 'DELETE' });
    load();
  };

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Date(2026, i).toLocaleString('default', { month: 'long' }),
  }));

  if (!data) return <div className="text-gray-500 text-sm">Loading budgets…</div>;

  const { summary, budgets, unbudgeted } = data;
  const overBudgets    = budgets.filter(b => b.status === 'over');
  const warningBudgets = budgets.filter(b => b.status === 'warning');

  return (
    <div className="space-y-6 max-w-3xl">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold text-white">Budgets</h2>
          <p className="text-sm text-gray-400 mt-1">Monthly spending limits per category.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={month.month}
            onChange={e => setMonth(m => ({ ...m, month: e.target.value }))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white"
          >
            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <input
            type="number"
            value={month.year}
            onChange={e => setMonth(m => ({ ...m, year: e.target.value }))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white w-20"
          />
        </div>
      </div>

      {/* ── Alerts (over/warning) ── */}
      {(overBudgets.length > 0 || warningBudgets.length > 0) && (
        <div className="space-y-2">
          {overBudgets.map(b => (
            <div key={b.id} className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 text-sm">
              <span className="text-rose-400 text-base">⚠️</span>
              <span className="text-rose-300">
                You're <strong>{fmt(b.spent - b.monthlyLimit)}</strong> over budget on{' '}
                <strong>{b.category}</strong> this month.
              </span>
            </div>
          ))}
          {warningBudgets.map(b => (
            <div key={b.id} className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-sm">
              <span className="text-amber-400 text-base">💛</span>
              <span className="text-amber-300">
                {b.pct}% of your <strong>{b.category}</strong> budget used —{' '}
                {fmt(b.remaining)} left.
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Summary strip ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 grid grid-cols-3 gap-4">
        <SummaryItem label="Monthly Limit"  value={fmt(summary.totalLimit)}   color="text-white" />
        <SummaryItem label="Spent"          value={fmt(summary.totalSpent)}   color={summary.totalSpent > summary.totalLimit ? 'text-rose-400' : 'text-emerald-400'} />
        <SummaryItem label="Remaining"      value={fmt(summary.remaining)}    color={summary.remaining < 0 ? 'text-rose-400' : 'text-sky-400'} />
      </div>

      {/* ── Budget table (Mint-style) ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_2fr_auto] gap-4 px-5 py-3 border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
          <span>Category</span>
          <span>Progress</span>
          <span className="text-right">Limit</span>
        </div>

        {budgets.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-12">
            No budgets yet. Add one below.
          </div>
        )}

        {budgets.map(b => (
          <BudgetRow key={b.id} budget={b} onDelete={handleDelete} />
        ))}

        {/* Total row */}
        {budgets.length > 0 && (
          <div className="grid grid-cols-[1fr_2fr_auto] gap-4 px-5 py-4 border-t border-gray-800 bg-gray-950/40">
            <span className="text-sm font-semibold text-white">Total</span>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all ${
                    summary.totalSpent > summary.totalLimit ? 'bg-rose-500' :
                    summary.totalSpent / summary.totalLimit >= 0.8 ? 'bg-amber-400' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(summary.totalLimit > 0 ? (summary.totalSpent / summary.totalLimit) * 100 : 0, 100)}%` }}
                />
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap w-16 text-right">
                {summary.totalLimit > 0
                  ? `${Math.round((summary.totalSpent / summary.totalLimit) * 100)}%`
                  : '—'}
              </span>
            </div>
            <span className="text-sm font-semibold text-white text-right">{fmt(summary.totalLimit)}</span>
          </div>
        )}
      </div>

      {/* ── Add budget form ── */}
      {showAdd ? (
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Add Budget</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Category</label>
              {categories.length > 0 ? (
                <select
                  value={addForm.category}
                  onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value="">Select category…</option>
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="e.g. Groceries"
                  value={addForm.category}
                  onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                />
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Monthly Limit ($)</label>
              <input
                type="number"
                placeholder="e.g. 500"
                value={addForm.limit}
                onChange={e => setAddForm(f => ({ ...f, limit: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Budget'}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full py-3 border border-dashed border-gray-700 rounded-2xl text-sm text-gray-500 hover:text-gray-300 hover:border-gray-600 transition-colors"
        >
          + Add Budget
        </button>
      )}

      {/* ── Unbudgeted categories ── */}
      {unbudgeted.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Unbudgeted Spending This Month</h3>
          <div className="space-y-2">
            {unbudgeted.map((u, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-300">{u.category || 'Uncategorized'}</span>
                <span className="text-gray-400 font-mono">{fmt(u.total)}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-3">These categories have no budget set yet.</p>
        </div>
      )}
    </div>
  );
}

function BudgetRow({ budget: b, onDelete }) {
  const statusBar   = STATUS_BAR[b.status];
  const statusLabel = STATUS_LABEL[b.status];

  return (
    <div className="grid grid-cols-[1fr_2fr_auto] gap-4 items-center px-5 py-4 border-b border-gray-800/60 hover:bg-gray-800/30 transition-colors group">
      {/* Category */}
      <div>
        <div className="text-sm text-gray-100">{b.category}</div>
        <div className={`text-xs mt-0.5 ${statusLabel.color}`}>
          {b.status === 'over'
            ? `${fmt(b.spent - b.monthlyLimit)} over`
            : `${fmt(b.remaining)} left`}
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-gray-800 rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-2.5 rounded-full transition-all duration-500 ${statusBar}`}
            style={{ width: `${b.pct}%` }}
          />
        </div>
        <span className="text-xs text-gray-500 w-28 whitespace-nowrap">
          {fmt(b.spent)} of {fmt(b.monthlyLimit)}
        </span>
      </div>

      {/* Limit + delete */}
      <div className="flex items-center gap-3 justify-end">
        <span className="text-sm font-medium text-white text-right">{fmt(b.monthlyLimit)}</span>
        <button
          onClick={() => onDelete(b.id)}
          className="text-gray-700 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100 text-xs"
          title="Remove budget"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function SummaryItem({ label, value, color }) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}
