import { useState, useEffect } from 'react';
import { SpendingDonut, DailySpendingChart, COLORS } from '../components/ChartWidget';
import CategoryBadge from '../components/CategoryBadge';

const fmt = (cents, sign = false) => {
  const val = (Math.abs(cents || 0) / 100).toLocaleString('en-CA', {
    style: 'currency', currency: 'CAD', minimumFractionDigits: 2,
  });
  return sign && cents < 0 ? `-${val}` : val;
};

const fmtShort = (cents) => {
  const abs = Math.abs(cents || 0) / 100;
  if (abs >= 1000) return '$' + (abs / 1000).toFixed(1) + 'k';
  return '$' + abs.toFixed(0);
};

export default function Dashboard({ onOpenAccounts, onOpenTransactions }) {
  const [stats, setStats] = useState(null);
  const [accountsData, setAccountsData] = useState(null);
  const [budgetData, setBudgetData] = useState(null);
  const [recent, setRecent] = useState([]);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    // Default to last month if current month has no data yet (common at start of month)
    return { month: String(d.getMonth() + 1), year: String(d.getFullYear()) };
  });

  useEffect(() => {
    fetch(`/api/transactions/stats?month=${month.month}&year=${month.year}`)
      .then(r => r.json()).then(d => {
        // If no data this month, try last month automatically
        if (d.totalTransactions === 0) {
          const d2 = new Date(parseInt(month.year), parseInt(month.month) - 2, 1);
          const lastMonth = { month: String(d2.getMonth() + 1), year: String(d2.getFullYear()) };
          fetch(`/api/transactions/stats?month=${lastMonth.month}&year=${lastMonth.year}`)
            .then(r => r.json()).then(d3 => {
              if (d3.totalTransactions > 0) setMonth(lastMonth);
            });
        }
        setStats(d);
      });
    fetch('/api/accounts').then(r => r.json()).then(setAccountsData);
    fetch(`/api/budgets?month=${month.month}&year=${month.year}`).then(r => r.json()).then(setBudgetData);
    fetch('/api/transactions?limit=8&sort=transaction_date&order=DESC')
      .then(r => r.json()).then(d => setRecent(d.transactions));
  }, [month]);

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Date(2026, i).toLocaleString('default', { month: 'long' }),
  }));

  const prevMonth = () => {
    const d = new Date(parseInt(month.year), parseInt(month.month) - 2, 1);
    setMonth({ month: String(d.getMonth() + 1), year: String(d.getFullYear()) });
  };
  const nextMonth = () => {
    const d = new Date(parseInt(month.year), parseInt(month.month), 1);
    setMonth({ month: String(d.getMonth() + 1), year: String(d.getFullYear()) });
  };

  if (!stats || !accountsData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 text-sm animate-pulse">Loading…</div>
      </div>
    );
  }

  const netWorth = accountsData.summary.netWorth;
  const cashTotal = accountsData.summary.cashTotal;
  const debtTotal = accountsData.summary.debtTotal;
  const cashFlow = stats.totalPaid - stats.totalSpent; // positive = net inflow
  const spendingCategories = stats.byCategory.filter(c => c.category !== 'Payments');
  const donutTotal = spendingCategories.reduce((s, c) => s + c.total, 0);
  const monthLabel = new Date(parseInt(month.year), parseInt(month.month) - 1).toLocaleString('default', { month: 'short', year: 'numeric' });

  return (
    <div className="space-y-5">

      {/* ── Month nav ── */}
      <div className="flex items-center gap-3">
        <button onClick={prevMonth} className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white text-sm transition-colors">‹</button>
        <div className="flex items-center gap-2">
          <select value={month.month} onChange={e => setMonth(m => ({ ...m, month: e.target.value }))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white">
            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <input type="number" value={month.year} onChange={e => setMonth(m => ({ ...m, year: e.target.value }))}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white w-20" />
        </div>
        <button onClick={nextMonth} className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white text-sm transition-colors">›</button>
        <span className="text-xs text-gray-600 ml-1">{stats.totalTransactions} transactions</span>
      </div>

      {/* ── Row 1: Net worth hero + account breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Net worth hero */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-900/50 border border-gray-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Net Worth</p>
            <p className={`text-4xl font-bold tracking-tight ${netWorth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {fmt(netWorth)}
            </p>
          </div>
          <div className="mt-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Cash</span>
              <span className="text-sky-400 font-medium">{fmt(cashTotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Credit Debt</span>
              <span className="text-rose-400 font-medium">-{fmt(debtTotal)}</span>
            </div>
            {accountsData.summary.investmentTotal > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Investments</span>
                <span className="text-amber-400 font-medium">{fmt(accountsData.summary.investmentTotal)}</span>
              </div>
            )}
          </div>
          <button onClick={onOpenAccounts} className="mt-4 text-xs text-emerald-400 hover:text-emerald-300 text-left transition-colors">
            View all accounts →
          </button>
        </div>

        {/* Cash flow */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-gray-500 uppercase tracking-widest">Cash Flow</p>
            <span className="text-xs text-gray-600">{monthLabel}</span>
          </div>
          <div className="space-y-4">
            <CashFlowBar label="Spent" amount={stats.totalSpent} color="bg-rose-500" max={Math.max(stats.totalSpent, stats.totalPaid)} icon="↑" />
            <CashFlowBar label="Paid / Received" amount={stats.totalPaid} color="bg-emerald-500" max={Math.max(stats.totalSpent, stats.totalPaid)} icon="↓" />
          </div>
          <div className={`mt-5 pt-4 border-t border-gray-800 flex justify-between items-center`}>
            <span className="text-sm text-gray-400">Net</span>
            <span className={`text-lg font-bold ${cashFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {cashFlow >= 0 ? '+' : ''}{fmt(cashFlow)}
            </span>
          </div>
        </div>

        {/* Month quick stats */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">This Month</p>
          <div className="space-y-3">
            <QuickStat label="Total Spent" value={fmt(stats.totalSpent)} color="text-rose-400" />
            <QuickStat label="Avg / Transaction"
              value={stats.totalTransactions > 0 ? fmt(Math.round(stats.totalSpent / stats.totalTransactions)) : '—'}
              color="text-amber-400" />
            <QuickStat label="Biggest Purchase"
              value={stats.biggestPurchase ? fmt(stats.biggestPurchase.amount) : '—'}
              sub={stats.biggestPurchase?.merchant_name}
              color="text-rose-300" />
            <QuickStat label="Most Visited"
              value={stats.mostVisitedMerchant?.merchant_name || '—'}
              sub={stats.mostVisitedMerchant ? `${stats.mostVisitedMerchant.visits}x` : ''}
              color="text-blue-400" />
          </div>
        </div>
      </div>

      {/* ── Row 2: Donut + daily chart ── */}
      <div className="grid md:grid-cols-5 gap-4">

        {/* Spending donut + legend */}
        <div className="md:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-sm font-medium text-gray-300 mb-4">Spending by Category</p>
          {spendingCategories.length > 0 ? (
            <div className="flex gap-4 items-start">
              <div className="w-36 flex-shrink-0">
                <SpendingDonut
                  data={spendingCategories}
                  centerLabel={{ label: 'Total', value: fmtShort(donutTotal) }}
                />
              </div>
              <div className="flex-1 space-y-1.5 min-w-0 pt-1">
                {spendingCategories.slice(0, 7).map((c, i) => (
                  <div key={c.category} className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-gray-300 truncate flex-1">{c.category}</span>
                    <span className="text-gray-500 flex-shrink-0">{((c.total / donutTotal) * 100).toFixed(0)}%</span>
                    <span className="text-gray-200 font-mono flex-shrink-0">{fmtShort(c.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-gray-600 text-sm text-center py-8">No spending data</p>
          )}
        </div>

        {/* Daily spending line */}
        <div className="md:col-span-3 bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-sm font-medium text-gray-300 mb-4">Daily Spending</p>
          <DailySpendingChart data={stats.dailySpending} />
        </div>
      </div>

      {/* ── Row 3: Budgets snapshot + top merchants + recent ── */}
      <div className="grid xl:grid-cols-3 gap-4">

        {/* Budget progress snapshot */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-300">Budgets</p>
            <span className="text-xs text-gray-600">{monthLabel}</span>
          </div>
          {budgetData && budgetData.budgets.length > 0 ? (
            <div className="space-y-3">
              {budgetData.budgets.slice(0, 5).map(b => {
                const pct = Math.min(b.pct, 100);
                const color = b.status === 'over' ? 'bg-rose-500' : b.status === 'warning' ? 'bg-amber-400' : 'bg-emerald-500';
                const textColor = b.status === 'over' ? 'text-rose-400' : b.status === 'warning' ? 'text-amber-400' : 'text-gray-500';
                return (
                  <div key={b.id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-300">{b.category}</span>
                      <span className={textColor}>
                        {b.status === 'over' ? 'Over' : `${fmt(b.remaining)} left`}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {budgetData.summary.totalLimit > 0 && (
                <div className="pt-2 border-t border-gray-800 flex justify-between text-xs text-gray-500">
                  <span>Total</span>
                  <span>{fmt(budgetData.summary.totalSpent)} / {fmt(budgetData.summary.totalLimit)}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-600 text-sm">No budgets set.</p>
          )}
        </div>

        {/* Top merchants */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-sm font-medium text-gray-300 mb-4">Top Merchants</p>
          {stats.topMerchants.length > 0 ? (
            <div className="space-y-2">
              {stats.topMerchants.slice(0, 7).map((m, i) => (
                <div key={i} className="flex items-center gap-2 text-sm group">
                  <span className="text-gray-700 text-xs w-4 flex-shrink-0">{i + 1}</span>
                  <span className="text-gray-300 truncate flex-1">{m.merchant_name}</span>
                  <span className="text-gray-600 text-xs flex-shrink-0">{m.count}x</span>
                  <span className="font-mono text-gray-200 text-xs flex-shrink-0">{fmtShort(m.total)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 text-sm">No data</p>
          )}
        </div>

        {/* Recent transactions */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-300">Recent</p>
            <button onClick={() => onOpenTransactions?.()} className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
              See all →
            </button>
          </div>
          <div className="space-y-2.5">
            {recent.map(tx => (
              <button
                key={tx.id}
                onClick={() => onOpenTransactions?.()}
                className="w-full flex items-center gap-3 text-left group"
              >
                <div className="w-7 h-7 rounded-lg bg-gray-800 flex items-center justify-center text-xs flex-shrink-0">
                  {getCategoryEmoji(tx.category)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-200 truncate group-hover:text-white transition-colors">
                    {tx.merchant_name || tx.description}
                  </p>
                  <p className="text-xs text-gray-600">{tx.transaction_date}</p>
                </div>
                <span className={`text-xs font-mono flex-shrink-0 ${tx.amount < 0 ? 'text-emerald-400' : 'text-gray-300'}`}>
                  {tx.amount < 0 ? '+' : ''}{fmtShort(tx.amount)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}

function CashFlowBar({ label, amount, color, max, icon }) {
  const pct = max > 0 ? (amount / max) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-gray-400">{icon} {label}</span>
        <span className="text-gray-200 font-mono">{fmt(amount)}</span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function QuickStat({ label, value, sub, color }) {
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-xs text-gray-500 flex-shrink-0 pt-0.5">{label}</span>
      <div className="text-right min-w-0">
        <span className={`text-sm font-medium ${color} block truncate`}>{value}</span>
        {sub && <span className="text-xs text-gray-600 block truncate">{sub}</span>}
      </div>
    </div>
  );
}

function getCategoryEmoji(cat) {
  const map = {
    'Groceries': '🛒', 'Dining': '🍽️', 'Transport/Parking': '🚗',
    'Shopping': '🛍️', 'Subscriptions': '📱', 'Entertainment': '🎭',
    'Auto/Mechanic': '🔧', 'Interest/Fees': '💳', 'Payments': '✅',
    'Uncategorized': '❓',
  };
  return map[cat] || '💸';
}
