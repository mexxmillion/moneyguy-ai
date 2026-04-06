'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { fmt, fmtShort } from '@/components/format';

function getDefaultMonth() {
  const d = new Date();
  // default to last month if we're early in the month
  if (d.getDate() < 5) {
    d.setMonth(d.getMonth() - 1);
  }
  return { month: String(d.getMonth() + 1), year: String(d.getFullYear()) };
}

export default function ClientDashboard() {
  const [stats, setStats] = useState(null);
  const [accountsData, setAccountsData] = useState(null);
  const [budgetData, setBudgetData] = useState(null);
  const [recent, setRecent] = useState([]);
  const [month, setMonth] = useState(getDefaultMonth);
  const [loading, setLoading] = useState(true);

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Date(2026, i).toLocaleString('default', { month: 'long' }),
  }));

  const prevMonth = () => setMonth(m => {
    const d = new Date(parseInt(m.year), parseInt(m.month) - 2, 1);
    return { month: String(d.getMonth() + 1), year: String(d.getFullYear()) };
  });
  const nextMonth = () => setMonth(m => {
    const d = new Date(parseInt(m.year), parseInt(m.month), 1);
    return { month: String(d.getMonth() + 1), year: String(d.getFullYear()) };
  });

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/transactions/stats?month=${month.month}&year=${month.year}`).then(r => r.json()),
      fetch('/api/accounts').then(r => r.json()),
      fetch(`/api/budgets?month=${month.month}&year=${month.year}`).then(r => r.json()),
      fetch('/api/transactions?limit=6&sort=transaction_date&order=DESC').then(r => r.json()),
    ]).then(([s, a, b, t]) => {
      setStats(s);
      setAccountsData(a);
      setBudgetData(b);
      setRecent(t.transactions || []);
      setLoading(false);
    }).catch(err => {
      console.error('Dashboard load error:', err);
      setLoading(false);
    });
  }, [month.month, month.year]);

  const monthLabel = new Date(parseInt(month.year), parseInt(month.month) - 1)
    .toLocaleString('default', { month: 'long', year: 'numeric' });

  if (loading || !accountsData) {
    return (
      <AppShell title="Dashboard">
        <div className="flex items-center justify-center py-24 text-sm text-[var(--muted)] animate-pulse">Loading dashboard…</div>
      </AppShell>
    );
  }

  const netWorth = accountsData.summary.netWorth;
  const cashTotal = accountsData.summary.cashTotal;
  const debtTotal = accountsData.summary.debtTotal;
  const totalSpent = stats?.totalSpent || 0;
  const totalPaid = stats?.totalPaid || 0;
  const cashFlow = totalPaid - totalSpent;
  const spendingCategories = (stats?.byCategory || []).filter(c => c.category !== 'Payments');
  const topMerchants = stats?.topMerchants || [];

  return (
    <AppShell title="Dashboard" subtitle={`${monthLabel} · ${stats?.totalTransactions || 0} transactions`}
      actions={
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="rounded-full border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--surface-muted)]">‹</button>
          <select value={month.month} onChange={e => setMonth(m => ({ ...m, month: e.target.value }))}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-sm">
            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <input type="number" value={month.year} onChange={e => setMonth(m => ({ ...m, year: e.target.value }))}
            className="w-20 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-sm" />
          <button onClick={nextMonth} className="rounded-full border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--surface-muted)]">›</button>
        </div>
      }
    >
      {/* Hero */}
      <section className="primary-gradient relative overflow-hidden rounded-[2rem] px-8 py-10 text-white shadow-2xl shadow-blue-200/70 mb-8">
        <div className="relative z-10">
          <div className="text-xs font-semibold tracking-[0.3em] text-white/70">CURRENT NET WORTH</div>
          <div className="mt-2 flex flex-wrap items-end gap-4">
            <div className="text-5xl font-black tracking-tight md:text-7xl">{fmt(netWorth)}</div>
            <div className={`rounded-full px-3 py-1 text-sm font-semibold ${cashFlow >= 0 ? 'bg-white/20' : 'bg-red-400/30'}`}>
              {cashFlow >= 0 ? '+' : ''}{fmt(cashFlow)} this month
            </div>
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            <MiniStat label="Cash" value={fmt(cashTotal)} />
            <MiniStat label="Debt" value={`-${fmt(debtTotal)}`} />
            <MiniStat label="Investments" value={fmt(accountsData.summary.investmentTotal)} />
          </div>
        </div>
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
      </section>

      {/* KPI strip */}
      <section className="grid gap-4 md:grid-cols-3 mb-8">
        <MetricCard title="Monthly Spending" value={fmt(totalSpent)} hint={`${stats?.totalTransactions || 0} transactions`} />
        <MetricCard
          title="Cash Flow"
          value={(cashFlow >= 0 ? '+' : '') + fmt(cashFlow)}
          hint={`${fmt(totalPaid)} received vs ${fmt(totalSpent)} spent`}
        />
        <MetricCard
          title="Budget Status"
          value={budgetData?.summary?.totalLimit > 0 ? `${Math.round((budgetData.summary.totalSpent / budgetData.summary.totalLimit) * 100)}% used` : 'No budgets'}
          hint={budgetData?.summary?.totalLimit > 0 ? `${fmt(budgetData.summary.remaining)} remaining` : 'Set budgets to track spending'}
        />
      </section>

      {/* Main content */}
      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        {/* Left: categories + merchants */}
        <div className="space-y-6">
          <div className="surface-card rounded-[2rem] p-6">
            <h3 className="text-xl font-bold mb-5">Spending by Category</h3>
            {spendingCategories.length > 0 ? (
              <div className="space-y-4">
                {spendingCategories.slice(0, 7).map((c, i) => {
                  const pct = totalSpent > 0 ? Math.max(4, Math.round((c.total / totalSpent) * 100)) : 0;
                  return (
                    <div key={c.category}>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="font-medium">{c.category}</span>
                        <span className="text-[var(--muted)]">{fmtShort(c.total)} · {pct}%</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-[var(--surface-soft)]">
                        <div className="h-2.5 rounded-full bg-[var(--primary)] transition-all"
                          style={{ width: `${pct}%`, opacity: Math.max(0.35, 1 - i * 0.09) }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <p className="text-[var(--muted)] text-sm py-4">No spending data for this month.</p>}
          </div>

          {/* Budget snapshot */}
          {budgetData?.budgets?.length > 0 && (
            <div className="surface-card rounded-[2rem] p-6">
              <h3 className="text-xl font-bold mb-5">Budget Snapshot</h3>
              <div className="space-y-3">
                {budgetData.budgets.slice(0, 5).map(b => {
                  const barColor = b.status === 'over' ? 'bg-[var(--tertiary)]' : b.status === 'warning' ? 'bg-amber-500' : 'bg-[var(--secondary)]';
                  return (
                    <div key={b.id}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="font-medium">{b.category}</span>
                        <span className={b.status === 'over' ? 'text-[var(--tertiary)]' : b.status === 'warning' ? 'text-amber-600' : 'text-[var(--muted)]'}>
                          {b.status === 'over' ? `${fmt(b.spent - b.monthlyLimit)} over` : `${fmt(b.remaining)} left`}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[var(--surface-soft)]">
                        <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${b.pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: top merchants + recent */}
        <div className="space-y-6">
          <div className="surface-card rounded-[2rem] p-6">
            <h3 className="text-xl font-bold mb-5">Top Merchants</h3>
            {topMerchants.length > 0 ? (
              <div className="space-y-3">
                {topMerchants.slice(0, 6).map((m, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--surface-muted)] px-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{m.merchant_name}</div>
                      <div className="text-xs text-[var(--muted)]">{m.count}×</div>
                    </div>
                    <div className="text-sm font-bold flex-shrink-0">{fmtShort(m.total)}</div>
                  </div>
                ))}
              </div>
            ) : <p className="text-[var(--muted)] text-sm">No data</p>}
          </div>

          <div className="surface-card rounded-[2rem] p-6">
            <h3 className="text-xl font-bold mb-5">Recent</h3>
            <div className="space-y-3">
              {recent.map(tx => (
                <div key={tx.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{tx.merchant_name || tx.description}</div>
                    <div className="text-xs text-[var(--muted)]">{tx.category} · {tx.transaction_date}</div>
                  </div>
                  <div className={`text-sm font-bold flex-shrink-0 ${tx.amount < 0 ? 'text-[var(--secondary)]' : 'text-[var(--tertiary)]'}`}>
                    {tx.amount < 0 ? '+' : ''}{fmtShort(tx.amount)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function MetricCard({ title, value, hint }) {
  return (
    <div className="surface-card rounded-[1.75rem] p-6">
      <div className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--muted)]">{title}</div>
      <div className="mt-4 text-2xl font-black tracking-tight">{value}</div>
      <div className="mt-2 text-sm text-[var(--muted)]">{hint}</div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div>
      <div className="text-xs font-medium text-white/65">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}
