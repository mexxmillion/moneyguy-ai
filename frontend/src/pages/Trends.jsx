import { apiFetch } from '../UserContext';
import { useState, useEffect } from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement,
  LineElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { COLORS } from '../components/ChartWidget';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler);

const fmt = (cents) => {
  const n = parseFloat(cents) || 0;
  const dollars = Number.isInteger(n) && Math.abs(n) > 100 ? n / 100 : n;
  return dollars.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 });
};

const fmtFull = (cents) => {
  const n = parseFloat(cents) || 0;
  const dollars = Number.isInteger(n) && Math.abs(n) > 100 ? n / 100 : n;
  return dollars.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2 });
};

const GRID = { color: '#1f2937' };
const TICK = { color: '#6b7280', font: { size: 11 } };

// Quick presets
const PRESETS = [
  { label: 'Last 30d', days: 30 },
  { label: 'Last 60d', days: 60 },
  { label: 'Last 90d', days: 90 },
  { label: 'This year', year: true },
  { label: 'All time', all: true },
];

function getPresetDates(preset) {
  const to = new Date();
  let from = new Date();
  if (preset.days) {
    from.setDate(from.getDate() - preset.days);
  } else if (preset.year) {
    from = new Date(to.getFullYear(), 0, 1);
  } else if (preset.all) {
    from = new Date('2020-01-01');
  }
  return {
    date_from: from.toISOString().slice(0, 10),
    date_to: to.toISOString().slice(0, 10),
  };
}

export default function Trends() {
  const [filters, setFilters] = useState(() => getPresetDates({ all: true }));
  const [groupBy, setGroupBy] = useState('day');
  const [accounts, setAccounts] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activePreset, setActivePreset] = useState('All time');
  const [showCumulative, setShowCumulative] = useState(false);

  useEffect(() => {
    apiFetch('/api/accounts').then(r => r.json()).then(d => setAccounts(d.accounts || []));
    apiFetch('/api/transactions/categories').then(r => r.json()).then(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ group_by: groupBy });
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    apiFetch(`/api/transactions/trends?${params}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [JSON.stringify(filters), groupBy]);

  const setPreset = (p) => {
    setActivePreset(p.label);
    const dates = getPresetDates(p);
    setFilters(f => ({ ...f, ...dates }));
    // Auto group_by
    if (p.days && p.days <= 30) setGroupBy('day');
    else if (p.days && p.days <= 90) setGroupBy('week');
    else setGroupBy('month');
  };

  const updateFilter = (k, v) => {
    setActivePreset(null);
    setFilters(f => ({ ...f, [k]: v }));
  };

  // ── Charts ──
  const timeLabels = data?.overTime.map(r => r.period) || [];

  const spendingChartData = {
    labels: timeLabels,
    datasets: showCumulative ? [
      {
        label: 'Cumulative Spend',
        data: data?.cumulativeData.map(r => {
          const n = parseFloat(r.cumulative);
          return Number.isInteger(n) && n > 100 ? n / 100 : n;
        }) || [],
        borderColor: '#f97316',
        backgroundColor: 'rgba(249,115,22,0.08)',
        fill: true, tension: 0.3, pointRadius: 2,
      }
    ] : [
      {
        label: 'Spending',
        data: data?.overTime.map(r => {
          const n = parseFloat(r.spending);
          return Number.isInteger(n) && n > 100 ? n / 100 : n;
        }) || [],
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239,68,68,0.08)',
        fill: true, tension: 0.3, pointRadius: 3,
      },
      {
        label: 'Income / Credits',
        data: data?.overTime.map(r => {
          const n = parseFloat(r.income);
          return Number.isInteger(n) && n > 100 ? n / 100 : n;
        }) || [],
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34,197,94,0.06)',
        fill: true, tension: 0.3, pointRadius: 3,
      },
    ],
  };

  const lineOpts = {
    responsive: true,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { color: '#9ca3af', font: { size: 12 } } },
      tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: $${ctx.parsed.y.toLocaleString('en-CA', { minimumFractionDigits: 2 })}` } },
    },
    scales: {
      x: { ticks: { ...TICK, maxTicksLimit: 14 }, grid: GRID },
      y: { ticks: { ...TICK, callback: v => '$' + v.toLocaleString() }, grid: GRID },
    },
  };

  const monthBarData = {
    labels: data?.byMonth.map(r => r.month) || [],
    datasets: [
      {
        label: 'Spending',
        data: data?.byMonth.map(r => { const n = parseFloat(r.spending); return Number.isInteger(n) && n > 100 ? n / 100 : n; }) || [],
        backgroundColor: 'rgba(239,68,68,0.7)',
        borderColor: '#ef4444',
        borderWidth: 1,
        borderRadius: 4,
      },
      {
        label: 'Income',
        data: data?.byMonth.map(r => { const n = parseFloat(r.income); return Number.isInteger(n) && n > 100 ? n / 100 : n; }) || [],
        backgroundColor: 'rgba(34,197,94,0.7)',
        borderColor: '#22c55e',
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const barOpts = {
    responsive: true,
    plugins: {
      legend: { labels: { color: '#9ca3af' } },
      tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: $${ctx.parsed.y.toLocaleString('en-CA', { minimumFractionDigits: 2 })}` } },
    },
    scales: {
      x: { ticks: TICK, grid: { display: false } },
      y: { ticks: { ...TICK, callback: v => '$' + v.toLocaleString() }, grid: GRID },
    },
  };

  const donutData = {
    labels: data?.byCategory.map(c => c.category) || [],
    datasets: [{
      data: data?.byCategory.map(c => { const n = parseFloat(c.total); return Number.isInteger(n) && n > 100 ? n / 100 : n; }) || [],
      backgroundColor: (data?.byCategory || []).map((_, i) => COLORS[i % COLORS.length]),
      borderColor: '#111827',
      borderWidth: 2,
    }],
  };

  const totalSpent = data?.totals?.totalSpent || 0;
  const totalIncome = data?.totals?.totalIncome || 0;
  const net = totalIncome - totalSpent;

  return (
    <div className="space-y-5">

      {/* ── Controls ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">

        {/* Presets */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-600 mr-1">Quick:</span>
          {PRESETS.map(p => (
            <button key={p.label} onClick={() => setPreset(p)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                activePreset === p.label
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
              }`}>
              {p.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-600">Group by:</span>
            {['day', 'week', 'month'].map(g => (
              <button key={g} onClick={() => setGroupBy(g)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  groupBy === g ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}>
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Date range + filters */}
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-600 mb-1">From</label>
            <input type="date" value={filters.date_from || ''} onChange={e => updateFilter('date_from', e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">To</label>
            <input type="date" value={filters.date_to || ''} onChange={e => updateFilter('date_to', e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Account</label>
            <select value={filters.account_id || ''} onChange={e => updateFilter('account_id', e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none">
              <option value="">All accounts</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Category</label>
            <select value={filters.category || ''} onChange={e => updateFilter('category', e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:border-emerald-500 focus:outline-none">
              <option value="">All categories</option>
              {['Auto/Mechanic','Dining','Entertainment','Groceries','Housing','Ignore','Interest/Fees','Payments','Shopping','Subscriptions','Transfers','Transport/Parking','Uncategorized'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          {(filters.account_id || filters.category) && (
            <button onClick={() => setFilters(f => ({ date_from: f.date_from, date_to: f.date_to }))}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-400 hover:text-white">
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* ── Summary stats ── */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Spent', value: fmtFull(totalSpent), color: 'text-rose-400' },
            { label: 'Total Income', value: fmtFull(totalIncome), color: 'text-emerald-400' },
            { label: 'Net', value: (net >= 0 ? '+' : '') + fmtFull(net), color: net >= 0 ? 'text-emerald-400' : 'text-rose-400' },
            { label: 'Transactions', value: (data.totals?.count || 0).toLocaleString(), color: 'text-white' },
          ].map(s => (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 text-center">
              <p className="text-xs text-gray-500 mb-1">{s.label}</p>
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="text-center py-10 text-gray-600 text-sm animate-pulse">Loading trends…</div>
      )}

      {data && !loading && (
        <>
          {/* ── Spending over time ── */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-gray-300">Spending Over Time</p>
              <button onClick={() => setShowCumulative(c => !c)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${showCumulative ? 'bg-orange-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                {showCumulative ? 'Cumulative' : 'Period'} ↔
              </button>
            </div>
            <Line data={spendingChartData} options={lineOpts} />
          </div>

          {/* ── MoM bar + donut ── */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <p className="text-sm font-medium text-gray-300 mb-4">Month over Month</p>
              <Bar data={monthBarData} options={barOpts} />
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <p className="text-sm font-medium text-gray-300 mb-4">Category Breakdown</p>
              {data.byCategory.length > 0 ? (
                <div className="flex gap-4 items-start">
                  <div className="w-40 flex-shrink-0">
                    <Doughnut data={donutData} options={{
                      responsive: true, cutout: '65%',
                      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: $${ctx.parsed.toLocaleString('en-CA', { minimumFractionDigits: 2 })}` } } },
                    }} />
                  </div>
                  <div className="flex-1 space-y-1.5 pt-1">
                    {data.byCategory.map((c, i) => {
                      const total = data.byCategory.reduce((s, x) => s + parseFloat(x.total), 0);
                      const v = parseFloat(c.total);
                      const dollars = Number.isInteger(v) && v > 100 ? v / 100 : v;
                      return (
                        <div key={c.category} className="flex items-center gap-2 text-xs">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="text-gray-300 truncate flex-1">{c.category}</span>
                          <span className="text-gray-500">{((parseFloat(c.total) / total) * 100).toFixed(0)}%</span>
                          <span className="text-gray-200 font-mono">${dollars.toLocaleString('en-CA', { minimumFractionDigits: 0 })}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : <p className="text-gray-600 text-sm">No category data</p>}
            </div>
          </div>

          {/* ── Top merchants ── */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-sm font-medium text-gray-300 mb-4">Top Merchants</p>
            <div className="space-y-2">
              {data.topMerchants.map((m, i) => {
                const v = parseFloat(m.total);
                const dollars = Number.isInteger(v) && v > 100 ? v / 100 : v;
                const maxVal = parseFloat(data.topMerchants[0]?.total || 1);
                const maxDollars = Number.isInteger(maxVal) && maxVal > 100 ? maxVal / 100 : maxVal;
                const pct = (dollars / maxDollars) * 100;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-gray-700 w-4 flex-shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-gray-200 truncate">{m.merchant_name}</span>
                        <span className="text-gray-400 ml-2 flex-shrink-0">{m.count}× · <span className="text-gray-200 font-mono">${dollars.toLocaleString('en-CA', { minimumFractionDigits: 2 })}</span></span>
                      </div>
                      <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-1 rounded-full bg-blue-500/70" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
