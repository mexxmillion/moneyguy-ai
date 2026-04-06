import { useEffect, useState } from 'react';

const fmt = (cents) =>
  (Math.abs(cents || 0) / 100).toLocaleString('en-CA', {
    style: 'currency', currency: 'CAD', minimumFractionDigits: 2,
  });

export default function TransactionSummary({ filters }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setData(null);
    const params = new URLSearchParams(filters);
    for (const [k, v] of [...params.entries()]) if (!v) params.delete(k);
    fetch(`/api/transactions/summary?${params}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [JSON.stringify(filters)]);

  if (loading) return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-3 text-xs text-gray-500">
      Calculating…
    </div>
  );

  if (!data) return null;

  const stats = [
    { label: 'Count',      value: data.count.toLocaleString(),         color: 'text-white' },
    { label: 'Sum',        value: fmt(data.sum),                        color: 'text-rose-400' },
    { label: 'Average',    value: fmt(data.avg),                        color: 'text-amber-400' },
    { label: 'Min',        value: fmt(data.min),                        color: 'text-emerald-400' },
    { label: 'Max',        value: fmt(data.max),                        color: 'text-rose-300' },
    { label: 'Credits',    value: fmt(data.totalCredits),               color: 'text-sky-400' },
  ];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Stats row */}
      <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-gray-800">
        {stats.map(s => (
          <div key={s.label} className="px-4 py-3 text-center">
            <p className="text-xs text-gray-500 mb-0.5">{s.label}</p>
            <p className={`text-sm font-semibold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Insights row */}
      {(data.biggest || data.topMerchant) && (
        <div className="px-4 py-2 border-t border-gray-800 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-400">
          {data.biggest && (
            <span>
              💸 Biggest:{' '}
              <span className="text-white font-medium">{data.biggest.merchant_name}</span>{' '}
              <span className="text-rose-400">{fmt(data.biggest.amount)}</span>{' '}
              <span className="text-gray-600">· {data.biggest.transaction_date}</span>
            </span>
          )}
          {data.topMerchant && (
            <span>
              🔁 Most frequent:{' '}
              <span className="text-white font-medium">{data.topMerchant.merchant_name}</span>{' '}
              <span className="text-gray-400">{data.topMerchant.visits}×</span>{' '}
              <span className="text-amber-400">{fmt(data.topMerchant.total)}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
