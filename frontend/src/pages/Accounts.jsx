import { apiFetch } from '../UserContext';
import { useEffect, useMemo, useState } from 'react';

// Type → icon + colors (Mint-inspired)
const TYPE_CONFIG = {
  cash:       { icon: '💵', label: 'Cash',         positive: true,  valueColor: 'text-emerald-400' },
  credit:     { icon: '💳', label: 'Credit Cards', positive: false, valueColor: 'text-rose-400' },
  loan:       { icon: '🎓', label: 'Loans',        positive: false, valueColor: 'text-rose-400' },
  investment: { icon: '📈', label: 'Investments',  positive: true,  valueColor: 'text-amber-400' },
  other:      { icon: '🏦', label: 'Other',        positive: true,  valueColor: 'text-gray-300' },
};

function getConfig(key) {
  return TYPE_CONFIG[key] || TYPE_CONFIG.other;
}

function timeAgo(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  const diff = (Date.now() - d) / 1000;
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function Accounts({ onOpenTransactions }) {
  const [data, setData] = useState(null);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    apiFetch('/api/accounts').then(r => r.json()).then(payload => {
      setData(payload);
      const initial = {};
      for (const group of payload.groups || []) initial[group.key] = true;
      setExpanded(initial);
    });
  }, []);

  const fmt = useMemo(() => (cents, forceSign = false) => {
    const abs = Math.abs(cents || 0) / 100;
    const str = abs.toLocaleString('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 2,
    });
    if (forceSign && cents < 0) return `-${str}`;
    return str;
  }, []);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
        Loading accounts…
      </div>
    );
  }

  const { summary, groups } = data;

  return (
    <div className="space-y-6 max-w-3xl">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold text-white">Accounts</h2>
          <p className="text-sm text-gray-400 mt-1">
            All accounts from imported statements — balances from latest statement.
          </p>
        </div>
        <span className="text-xs text-gray-600 self-end">
          {summary.accountCount} active account{summary.accountCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Net worth / summary strip (Mint mobile style) ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Accounts Summary</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <SummaryItem
            label="Net Worth"
            value={fmt(summary.netWorth)}
            color={summary.netWorth >= 0 ? 'text-emerald-400' : 'text-rose-400'}
          />
          <SummaryItem
            label="Cash"
            value={fmt(summary.cashTotal)}
            color="text-emerald-400"
          />
          <SummaryItem
            label="Credit"
            value={summary.debtTotal > 0 ? `-${fmt(summary.debtTotal)}` : fmt(summary.debtTotal)}
            color="text-rose-400"
          />
          <SummaryItem
            label="Investments"
            value={fmt(summary.investmentTotal)}
            color="text-amber-400"
          />
        </div>
      </div>

      {/* ── Account groups ── */}
      <div className="space-y-3">
        {groups.map(group => {
          const cfg = getConfig(group.key);
          const isOpen = expanded[group.key];

          return (
            <section
              key={group.key}
              className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden"
            >
              {/* Group header row */}
              <button
                onClick={() => setExpanded(prev => ({ ...prev, [group.key]: !prev[group.key] }))}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{cfg.icon}</span>
                  <div className="text-left">
                    <div className="text-sm font-semibold text-white">{cfg.label}</div>
                    <div className="text-xs text-gray-500">
                      {group.accountCount} account{group.accountCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className={`text-lg font-bold ${cfg.valueColor}`}>
                    {cfg.positive
                      ? fmt(group.totalBalance)
                      : (group.totalBalance > 0 ? `-${fmt(group.totalBalance)}` : fmt(group.totalBalance))
                    }
                  </div>
                  <Chevron open={isOpen} />
                </div>
              </button>

              {/* Account rows */}
              {isOpen && (
                <div className="border-t border-gray-800 divide-y divide-gray-800/60">
                  {group.accounts.map(account => (
                    <AccountRow
                      key={account.id}
                      account={account}
                      cfg={cfg}
                      fmt={fmt}
                      onOpenTransactions={onOpenTransactions}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {groups.length === 0 && (
        <div className="text-center text-gray-500 text-sm py-16">
          No accounts yet — upload a statement to get started.
        </div>
      )}
    </div>
  );
}

function AccountRow({ account, cfg, fmt, onOpenTransactions }) {
  const updated = timeAgo(account.lastStatementDate);

  return (
    <button
      onClick={() => onOpenTransactions?.(account.id)}
      className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left hover:bg-gray-800/40 transition-colors group"
    >
      {/* Left: name + meta */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-100 truncate">
            {account.institution ? `${account.institution} ${account.name}` : account.name}
          </span>
          {account.last4 && (
            <span className="text-xs text-gray-600">···· {account.last4}</span>
          )}
        </div>

        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
          {updated && <span>{updated}</span>}
          {account.transactionCount > 0 && (
            <span>{account.transactionCount} transaction{account.transactionCount !== 1 ? 's' : ''}</span>
          )}
          {account.paymentDueDate && (
            <span className="text-amber-500/80">Due {account.paymentDueDate}</span>
          )}
          {account.availableCredit != null && account.availableCredit > 0 && (
            <span className="text-gray-500">
              {fmt(account.availableCredit)} available
            </span>
          )}
        </div>
      </div>

      {/* Right: balance */}
      <div className="text-right shrink-0">
        <div className={`text-base font-semibold ${cfg.valueColor}`}>
          {cfg.positive
            ? fmt(account.balance)
            : (account.balance > 0 ? `-${fmt(account.balance)}` : fmt(account.balance))
          }
        </div>
        {account.creditLimit && account.creditLimit > 0 && (
          <div className="text-xs text-gray-600">
            of {fmt(account.creditLimit)} limit
          </div>
        )}
        <div className="text-xs text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
          View →
        </div>
      </div>
    </button>
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

function Chevron({ open }) {
  return (
    <svg
      className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}
