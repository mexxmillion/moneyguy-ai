import { useState, useEffect } from 'react';
import { SpendingByCategory, DailySpendingChart } from '../components/ChartWidget';
import CategoryBadge from '../components/CategoryBadge';

export default function Dashboard({ onOpenAccounts, onOpenTransactions }) {
  const [stats, setStats] = useState(null);
  const [accountsData, setAccountsData] = useState(null);
  const [recent, setRecent] = useState([]);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return { month: String(d.getMonth() + 1), year: String(d.getFullYear()) };
  });

  useEffect(() => {
    fetch(`/api/transactions/stats?month=${month.month}&year=${month.year}`)
      .then(r => r.json()).then(setStats);
    fetch('/api/accounts')
      .then(r => r.json()).then(setAccountsData);
    fetch('/api/transactions?limit=10&sort=transaction_date&order=DESC')
      .then(r => r.json()).then(d => setRecent(d.transactions));
  }, [month]);

  const fmt = (cents) => '$' + (Math.abs(cents || 0) / 100).toFixed(2);

  const months = [];
  for (let m = 1; m <= 12; m++) months.push({ value: String(m), label: new Date(2026, m - 1).toLocaleString('default', { month: 'long' }) });

  if (!stats || !accountsData) return <div className="text-gray-500">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Month selector */}
      <div className="flex items-center gap-3">
        <select value={month.month} onChange={e => setMonth({ ...month, month: e.target.value })}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white">
          {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <input type="number" value={month.year} onChange={e => setMonth({ ...month, year: e.target.value })}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white w-24" />
      </div>

      {/* Net worth / quick stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Net Worth" value={fmt(accountsData.summary.netWorth)} color="text-emerald-400" sub="Cash + investments - debt" />
        <StatCard label="Cash" value={fmt(accountsData.summary.cashTotal)} color="text-sky-400" sub={`${accountsData.summary.accountCount} total accounts`} />
        <StatCard label="Credit Debt" value={fmt(accountsData.summary.debtTotal)} color="text-rose-400" sub="Latest statement balances" />
        <StatCard label="Investments" value={fmt(accountsData.summary.investmentTotal)} color="text-amber-400" sub="Imported account totals" />
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Spent" value={fmt(stats.totalSpent)} color="text-red-400" />
        <StatCard label="Total Paid" value={fmt(stats.totalPaid)} color="text-emerald-400" />
        <StatCard label="Biggest Purchase" value={stats.biggestPurchase ? fmt(stats.biggestPurchase.amount) : 'N/A'}
          sub={stats.biggestPurchase?.merchant_name} color="text-amber-400" />
        <StatCard label="Most Visited" value={stats.mostVisitedMerchant?.merchant_name || 'N/A'}
          sub={stats.mostVisitedMerchant ? `${stats.mostVisitedMerchant.visits} visits` : ''} color="text-blue-400" />
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Spending by Category</h3>
          <SpendingByCategory data={stats.byCategory} />
        </div>
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Daily Spending</h3>
          <DailySpendingChart data={stats.dailySpending} />
        </div>
      </div>

      {/* Accounts + top merchants + recent transactions */}
      <div className="grid xl:grid-cols-3 gap-6">
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 xl:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-400">Accounts Snapshot</h3>
            <button onClick={onOpenAccounts} className="text-xs text-emerald-400 hover:text-emerald-300">Open accounts</button>
          </div>
          <div className="space-y-3">
            {accountsData.groups.map(group => (
              <div key={group.key} className="rounded-xl border border-gray-800 bg-gray-950/60 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-sm text-gray-200">{group.label}</div>
                    <div className="text-xs text-gray-500">{group.accountCount} account{group.accountCount === 1 ? '' : 's'}</div>
                  </div>
                  <div className="text-sm font-semibold text-white">{fmt(group.totalBalance)}</div>
                </div>
                <div className="space-y-2">
                  {group.accounts.slice(0, 3).map(account => (
                    <button
                      key={account.id}
                      onClick={() => onOpenTransactions?.(account.id)}
                      className="w-full flex items-center justify-between text-left text-xs text-gray-400 hover:text-white"
                    >
                      <span className="truncate pr-3">{account.name}</span>
                      <span className="font-mono text-gray-300">{fmt(account.balance)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 xl:col-span-1">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Top Merchants</h3>
          <div className="space-y-2">
            {stats.topMerchants.map((m, i) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <span className="text-gray-300 truncate mr-3">{m.merchant_name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 text-xs">{m.count}x</span>
                  <span className="font-mono text-gray-200">{fmt(m.total)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 xl:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-400">Recent Transactions</h3>
            <button onClick={() => onOpenTransactions?.()} className="text-xs text-emerald-400 hover:text-emerald-300">See all</button>
          </div>
          <div className="space-y-2">
            {recent.map(tx => (
              <div key={tx.id} className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-gray-500 text-xs whitespace-nowrap">{tx.transaction_date}</span>
                  <span className="text-gray-300 truncate">{tx.merchant_name || tx.description}</span>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <CategoryBadge category={tx.category} />
                  <span className={`font-mono whitespace-nowrap ${tx.amount < 0 ? 'text-emerald-400' : 'text-gray-200'}`}>
                    {fmt(tx.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1 truncate">{sub}</p>}
    </div>
  );
}
