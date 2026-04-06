const CATEGORY_COLORS = {
  'Groceries': 'bg-green-500/20 text-green-400 border-green-500/30',
  'Dining': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  'Transport/Parking': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Subscriptions': 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  'Shopping': 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  'Entertainment': 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  'Auto/Mechanic': 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  'Interest/Fees': 'bg-red-500/20 text-red-400 border-red-500/30',
  'Payments': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'Uncategorized': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

export default function CategoryBadge({ category }) {
  const cls = CATEGORY_COLORS[category] || CATEGORY_COLORS['Uncategorized'];
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded border ${cls}`}>
      {category || 'Uncategorized'}
    </span>
  );
}

export { CATEGORY_COLORS };
