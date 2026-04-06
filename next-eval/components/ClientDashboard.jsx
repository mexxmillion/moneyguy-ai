'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { fmt, fmtShort } from '@/components/format';

export default function ClientDashboard() {
  const [stats, setStats] = useState(null);
  const [accountsData, setAccountsData] = useState(null);
  const [budgetData, setBudgetData] = useState(null);
  const [recent, setRecent] = useState([]);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return { month: String(d.getMonth() + 1), year: String(d.getFullYear()) };
  });

  useEffect(() => {
    fetch(`/api/transactions/stats?month=${month.month}&year=${month.year}`).then(r => r.json()).then(setStats);
    fetch('/api/accounts').then(r => r.json()).then(setAccountsData);
    fetch(`/api/budgets?month=${month.month}&year=${month.year}`).then(r => r.json()).then(setBudgetData);
    fetch('/api/transactions?limit=6&sort=transaction_date&order=DESC').then(r => r.json()).then(d => setRecent(d.transactions || []));
  }, [month]);

  if (!stats || !accountsData) {
    return <AppShell title="Dashboard" subtitle="Portfolio snapshot with existing workflow, remixed with Stitch language."><div className="text-sm text-[var(--muted)]">Loading dashboard…</div></AppShell>;
  }

  const netWorth = accountsData.summary.netWorth;
  const cashTotal = accountsData.summary.cashTotal;
  const debtTotal = accountsData.summary.debtTotal;
  const spendingCategories = (stats.byCategory || []).filter(c => c.category !== 'Payments');
  const topMerchants = stats.topMerchants || [];
  const totalSpent = stats.totalSpent || 0;
  const totalPaid = stats.totalPaid || 0;
  const cashFlow = totalPaid - totalSpent;

  return (
    <AppShell title="Dashboard" subtitle="Same MoneyGuy dashboard logic, but skinned with the Stitch visual language instead of the old Vite chrome.">
      <section className="primary-gradient relative overflow-hidden rounded-[2rem] px-8 py-10 text-white shadow-2xl shadow-blue-200/70">
        <div className="relative z-10">
          <div className="text-xs font-semibold tracking-[0.3em] text-white/70">CURRENT NET WORTH</div>
          <div className="mt-2 flex flex-wrap items-end gap-4">
            <div className="text-5xl font-black tracking-tight md:text-7xl">{fmt(netWorth)}</div>
            <div className={`rounded-full px-3 py-1 text-sm font-semibold ${cashFlow >= 0 ? 'bg-white/20' : 'bg-rose-400/30'}`}>{cashFlow >= 0 ? '+' : ''}{fmt(cashFlow)}</div>
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            <MiniStat label="Liquid Assets" value={fmt(cashTotal)} />
            <MiniStat label="Debt" value={`-${fmt(debtTotal)}`} />
            <MiniStat label="Recent Spend" value={fmt(totalSpent)} />
          </div>
        </div>
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
      </section>

      <section className="mt-8 grid gap-6 md:grid-cols-3">
        <MetricCard title="Monthly Spending" value={fmt(totalSpent)} hint={`${stats.totalTransactions || 0} transactions`} />
        <MetricCard title="Savings Rate" value={cashFlow >= 0 ? 'Positive' : 'Negative'} hint={`${cashFlow >= 0 ? '+' : ''}${fmt(cashFlow)} net`} />
        <MetricCard title="Budgets" value={budgetData?.budgets?.length || 0} hint={`${budgetData?.summary?.remaining ? fmt(budgetData.summary.remaining) : '$0.00'} remaining`} />
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="surface-card rounded-[2rem] p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">Spending by Category</h3>
              <p className="text-sm text-[var(--muted)]">Current Vite data, Stitch-style presentation.</p>
            </div>
          </div>
          <div className="space-y-4">
            {spendingCategories.slice(0, 6).map((c, index) => {
              const pct = totalSpent > 0 ? Math.max(8, Math.round((c.total / totalSpent) * 100)) : 0;
              return (
                <div key={c.category}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium">{c.category}</span>
                    <span className="text-[var(--muted)]">{fmtShort(c.total)}</span>
                  </div>
                  <div className="h-3 rounded-full bg-[var(--surface-soft)]">
                    <div className="h-3 rounded-full bg-[var(--primary)]" style={{ width: `${pct}%`, opacity: 1 - index * 0.08 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="surface-card rounded-[2rem] p-6">
            <h3 className="text-xl font-bold">Top Merchants</h3>
            <div className="mt-5 space-y-3">
              {topMerchants.slice(0, 5).map((m, i) => (
                <div key={`${m.merchant_name}-${i}`} className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--surface-muted)] px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold">{m.merchant_name}</div>
                    <div className="text-xs text-[var(--muted)]">{m.count} visits</div>
                  </div>
                  <div className="text-sm font-bold">{fmtShort(m.total)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="surface-card rounded-[2rem] p-6">
            <h3 className="text-xl font-bold">Recent Transactions</h3>
            <div className="mt-5 space-y-3">
              {recent.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{tx.merchant_name || tx.description}</div>
                    <div className="text-xs text-[var(--muted)]">{tx.category || 'Uncategorized'} · {tx.transaction_date}</div>
                  </div>
                  <div className={`text-sm font-bold ${tx.amount < 0 ? 'text-[var(--secondary)]' : 'text-[var(--tertiary)]'}`}>
                    {tx.amount < 0 ? '+' : '-'}{fmtShort(tx.amount)}
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
      <div className="mt-4 text-3xl font-black tracking-tight">{value}</div>
      <div className="mt-3 text-sm text-[var(--muted)]">{hint}</div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div>
      <div className="text-xs font-medium text-white/65">{label}</div>
      <div className="mt-2 text-xl font-bold">{value}</div>
    </div>
  );
}
