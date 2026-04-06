import { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const fmt = (cents) => '$' + (Math.abs(cents || 0) / 100).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const DOW_COLORS = ['#6b7280','#3b82f6','#3b82f6','#3b82f6','#3b82f6','#22c55e','#f97316'];

export default function TransactionSummary({ filters }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams(filters);
    for (const [k, v] of params.entries()) if (!v) params.delete(k);
    fetch(`/api/transactions/summary?${params}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filters]);

  if (loading) return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-3 text-xs text-gray-500 animate-pulse">
      Calculating...
    </div>
  );

  if (!data || data.count === 0) return null;

  const dowChart = {
    labels: data.byDow.map(d => d.label),
    datasets: [{
      data: data.byDow.map(d => d.total / 100),
      backgroundColor: DOW_COLORS,
      borderRadius: 4,
    }],
  };

  const monthChart = data.byMonth.length > 1 ? {
    labels: data.byMonth.map(d => d.month),
    datasets: [{
      data: data.byMonth.map(d => d.total / 100),
      backgroundColor: '#3b82f680',
      borderColor: '#3b82f6',
      borderWidth: 1,
      borderRadius: 4,
    }],
  } : null;

  const chartOpts = {
    responsive: true,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => '$' + ctx.parsed.y.toFixed(2) } } },
    scales: {
      x: { ticks: { color: '#6b7280', font: { size: 10 } }, grid: { display: false } },
      y: { ticks: { color: '#6b7280', font: { size: 10 }, callback: v => '$' + v }, grid: { color: '#1f2937' } },
    },
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Core stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-gray-800">
        <Stat label="Transactions" value={data.count.toLocaleString()} />
        <Stat label="Total Spent" value={fmt(data.sum)} color="text-red-400" />
        <Stat label="Average" value={fmt(data.avg)} color="text-amber-400" />
        <Stat label="Min" value={fmt(data.min)} color="text-emerald-400" />
        <Stat label="Max" value={fmt(data.max)} color="text-rose-400" />
        <Stat label="Credits" value={fmt(data.totalCredits)} color="text-sky-400" />
      </div>

      {/* Biggest + top merchant */}
      <div className="px-4 py-2 border-t border-gray-800 flex flex-wrap gap-4 text-xs text-gray-400">
        {data.biggest && (
          <span>
            💸 Biggest: <span className="text-white font-medium">{data.biggest.merchant_name}</span>{' '}
            <span className="text-rose-400">{fmt(data.biggest.amount)}</span>{' '}
            <span className="text-gray-600">({data.biggest.transaction_date})</span>
          </span>
        )}
        {data.topMerchant && (
          <span>
            🔁 Most frequent: <span className="text-white font-medium">{data.topMerchant.merchant_name}</span>{' '}
            <span className="text-gray-400">{data.topMerchant.visits}x</span>{' '}
            <span className="text-amber-400">{fmt(data.topMerchant.total)}</span>
          </span>
        )}
        <button
          onClick={() => setExpanded(e => !e)}
          className="ml-auto text-gray-500 hover:text-gray-300 transition-colors"
        >
          {expanded ? '▲ Hide charts' : '▼ Show charts'}
        </button>
      </div>

      {/* Expanded charts */}
      {expanded && (
        <div className="border-t border-gray-800 p-4 grid md:grid-cols-2 gap-6">
          <div>
            <p className="text-xs text-gray-500 mb-3">Spend by day of week</p>
            <Bar data={dowChart} options={chartOpts} />
          </div>
          {monthChart ? (
            <div>
              <p className="text-xs text-gray-500 mb-3">Monthly trend</p>
              <Bar data={monthChart} options={chartOpts} />
            </div>
          ) : (
            <div>
              <p className="text-xs text-gray-500 mb-3">Category breakdown</p>
              <div className="space-y-1.5 mt-2">
                {data.byCategory.slice(0, 8).map(c => (
                  <div key={c.category} className="flex items-center gap-2 text-xs">
                    <div className="flex-1 text-gray-300 truncate">{c.category}</div>
                    <div className="text-gray-500">{c.count}x</div>
                    <div className="text-gray-200 font-mono w-20 text-right">{fmt(c.total)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color = 'text-white' }) {
  return (
    <div className="px-4 py-3 text-center">
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`text-sm font-semibold ${color}`}>{value}</p>
    </div>
  );
}
