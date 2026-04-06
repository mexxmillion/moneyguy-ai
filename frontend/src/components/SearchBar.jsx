export default function SearchBar({ filters, onChange, categories }) {
  const update = (key, value) => onChange({ ...filters, [key]: value });

  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Search</label>
        <input
          type="text"
          value={filters.search || ''}
          onChange={e => update('search', e.target.value)}
          placeholder="Search description..."
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white w-48 focus:border-emerald-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Merchant</label>
        <input
          type="text"
          value={filters.merchant || ''}
          onChange={e => update('merchant', e.target.value)}
          placeholder="Merchant name..."
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white w-40 focus:border-emerald-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Category</label>
        <select
          value={filters.category || ''}
          onChange={e => update('category', e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
        >
          <option value="">All</option>
          {(categories || []).map(c => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">From</label>
        <input
          type="date"
          value={filters.date_from || ''}
          onChange={e => update('date_from', e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">To</label>
        <input
          type="date"
          value={filters.date_to || ''}
          onChange={e => update('date_to', e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Min $</label>
        <input
          type="number"
          value={filters.amount_min || ''}
          onChange={e => update('amount_min', e.target.value)}
          placeholder="0"
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white w-20 focus:border-emerald-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Max $</label>
        <input
          type="number"
          value={filters.amount_max || ''}
          onChange={e => update('amount_max', e.target.value)}
          placeholder="999"
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white w-20 focus:border-emerald-500 focus:outline-none"
        />
      </div>
    </div>
  );
}
