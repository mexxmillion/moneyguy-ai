import { useEffect, useState } from 'react';

// Safe formatter — handles both cents (int > 100) and dollar values
const fmt = (val) => {
  try {
    const num = parseFloat(val) || 0;
    // Heuristic: if value looks like it's already in dollars (has decimal or small), use as-is
    // Otherwise divide by 100
    const dollars = Number.isInteger(num) && Math.abs(num) > 100 ? num / 100 : num;
    return dollars.toLocaleString('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2 });
  } catch {
    return '$0.00';
  }
};

export default function TransactionSummary({ filters }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (filters && typeof filters === 'object') {
      Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') params.set(k, v); });
    }
    fetch(`/api/transactions/summary?${params}`)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [JSON.stringify(filters)]);

  if (loading) return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 text-xs text-gray-500 text-center">
      Calculating…
    </div>
  );

  if (error) return (
    <div className="bg-rose-900/20 border border-rose-800/40 rounded-xl px-5 py-3 text-xs text-rose-400">
      Stats error: {error}
    </div>
  );

  if (!data) return null;

  const stats = [
    { label: 'Count',    value: (data.count || 0).toLocaleString(),  color: 'text-white' },
    { label: 'Total',    value: fmt(data.sum),                        color: 'text-rose-400' },
    { label: 'Average',  value: fmt(data.avg),                        color: 'text-amber-400' },
    { label: 'Min',      value: fmt(data.min),                        color: 'text-emerald-400' },
    { label: 'Max',      value: fmt(data.max),                        color: 'text-rose-300' },
    { label: 'Credits',  value: fmt(data.totalCredits),               color: 'text-sky-400' },
  ];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-y sm:divide-y-0 divide-gray-800">
        {stats.map(s => (
          <div key={s.label} className="px-4 py-3 text-center">
            <p className="text-xs text-gray-500 mb-0.5">{s.label}</p>
            <p className={`text-sm font-semibold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>
      {(data.biggest || data.topMerchant) && (
        <div className="px-4 py-2 border-t border-gray-800 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-400">
          {data.biggest && (
            <span>
              💸 Biggest: <span className="text-white font-medium">{data.biggest.merchant_name}</span>{' '}
              <span className="text-rose-400">{fmt(data.biggest.amount)}</span>{' '}
              <span className="text-gray-600">· {data.biggest.transaction_date}</span>
            </span>
          )}
          {data.topMerchant && (
            <span>
              🔁 Most frequent: <span className="text-white font-medium">{data.topMerchant.merchant_name}</span>{' '}
              <span className="text-gray-400">{data.topMerchant.visits}×</span>{' '}
              <span className="text-amber-400">{fmt(data.topMerchant.total)}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
