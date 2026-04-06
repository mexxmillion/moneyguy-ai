'use client';

import { useEffect, useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import { fmt } from '@/components/format';

const TYPE_CONFIG = {
  cash:       { icon: '💵', label: 'Cash',         positive: true,  color: 'text-[var(--secondary)]' },
  credit:     { icon: '💳', label: 'Credit Cards', positive: false, color: 'text-[var(--tertiary)]' },
  loan:       { icon: '🎓', label: 'Loans',        positive: false, color: 'text-[var(--tertiary)]' },
  investment: { icon: '📈', label: 'Investments',  positive: true,  color: 'text-[var(--primary)]' },
  other:      { icon: '🏦', label: 'Other',        positive: true,  color: 'text-[var(--muted)]' },
};

function cfg(key) { return TYPE_CONFIG[key] || TYPE_CONFIG.other; }

function timeAgo(dateStr) {
  if (!dateStr) return null;
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function ClientAccounts() {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState({});

  useEffect(() => {
    fetch('/api/accounts').then(r => r.json()).then(p => {
      setData(p);
      const init = {};
      for (const g of p.groups || []) init[g.key] = true;
      setOpen(init);
    });
  }, []);

  if (!data) return <AppShell title="Accounts"><div className="text-sm text-[var(--muted)]">Loading…</div></AppShell>;

  const { summary, groups } = data;

  const summaryItems = [
    { label: 'Net Worth', value: fmt(summary.netWorth), color: summary.netWorth >= 0 ? 'text-[var(--secondary)]' : 'text-[var(--tertiary)]' },
    { label: 'Cash', value: fmt(summary.cashTotal), color: 'text-[var(--secondary)]' },
    { label: 'Debt', value: `-${fmt(summary.debtTotal)}`, color: 'text-[var(--tertiary)]' },
    { label: 'Investments', value: fmt(summary.investmentTotal), color: 'text-[var(--primary)]' },
  ];

  return (
    <AppShell title="Portfolio Overview" subtitle="All accounts from imported statements — balances from latest statement.">
      {/* Hero net worth */}
      <div className="primary-gradient relative overflow-hidden rounded-[2rem] px-8 py-10 text-white shadow-2xl shadow-blue-200/60 mb-8">
        <div className="text-xs font-semibold tracking-[0.3em] text-white/70">TOTAL BALANCE</div>
        <div className="mt-2 text-5xl font-black tracking-tight md:text-7xl">{fmt(summary.netWorth)}</div>
        <div className="mt-8 grid gap-6 sm:grid-cols-4">
          {summaryItems.map(s => (
            <div key={s.label}>
              <div className="text-xs text-white/60">{s.label}</div>
              <div className="mt-1 text-lg font-bold">{s.value}</div>
            </div>
          ))}
        </div>
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
      </div>

      {/* Account groups */}
      <div className="space-y-4">
        {groups.map(group => {
          const c = cfg(group.key);
          const isOpen = open[group.key];
          const balance = c.positive ? fmt(group.totalBalance) : `-${fmt(group.totalBalance)}`;
          return (
            <section key={group.key} className="surface-card rounded-[2rem] overflow-hidden">
              <button
                onClick={() => setOpen(p => ({ ...p, [group.key]: !p[group.key] }))}
                className="w-full flex items-center justify-between px-6 py-5 hover:bg-[var(--surface-muted)] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className="text-2xl">{c.icon}</span>
                  <div className="text-left">
                    <div className="font-bold text-[var(--text)]">{c.label}</div>
                    <div className="text-xs text-[var(--muted)]">{group.accountCount} account{group.accountCount !== 1 ? 's' : ''}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xl font-black ${c.color}`}>{balance}</span>
                  <svg className={`w-4 h-4 text-[var(--muted)] transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-[var(--border)] divide-y divide-[var(--border)]">
                  {group.accounts.map(account => {
                    const bal = c.positive ? fmt(account.balance) : `-${fmt(account.balance)}`;
                    return (
                      <div key={account.id} className="flex items-center justify-between gap-4 px-6 py-5 hover:bg-[var(--surface-muted)] transition-colors">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm">{account.institution ? `${account.institution} ${account.name}` : account.name}{account.last4 ? <span className="text-[var(--muted)] font-normal"> ···· {account.last4}</span> : null}</div>
                          <div className="mt-1 flex flex-wrap gap-3 text-xs text-[var(--muted)]">
                            {timeAgo(account.lastStatementDate) && <span>{timeAgo(account.lastStatementDate)}</span>}
                            {account.transactionCount > 0 && <span>{account.transactionCount} txns</span>}
                            {account.paymentDueDate && <span className="text-amber-600">Due {account.paymentDueDate}</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`text-lg font-black ${c.color}`}>{bal}</div>
                          {account.creditLimit > 0 && <div className="text-xs text-[var(--muted)]">of {fmt(account.creditLimit)} limit</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
        {groups.length === 0 && <p className="text-center text-[var(--muted)] py-16">No accounts yet — upload a statement to get started.</p>}
      </div>
    </AppShell>
  );
}
