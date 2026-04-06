import { Bar, Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  ArcElement, Title, Tooltip, Legend, Filler,
);

export const COLORS = [
  '#22c55e', '#f97316', '#3b82f6', '#8b5cf6', '#ec4899',
  '#14b8a6', '#64748b', '#ef4444', '#10b981', '#eab308',
];

const fmtTooltip = (ctx) => {
  const val = ctx.parsed.y ?? ctx.parsed;
  return ' $' + (typeof val === 'number' ? val : val).toLocaleString('en-CA', { minimumFractionDigits: 2 });
};

export function SpendingDonut({ data, centerLabel }) {
  if (!data || data.length === 0) return <p className="text-gray-500 text-sm text-center py-8">No data</p>;

  const total = data.reduce((s, d) => s + d.total, 0);

  const chartData = {
    labels: data.map(d => d.category || 'Unknown'),
    datasets: [{
      data: data.map(d => d.total / 100),
      backgroundColor: data.map((_, i) => COLORS[i % COLORS.length]),
      borderColor: '#111827',
      borderWidth: 3,
      hoverOffset: 6,
    }],
  };

  return (
    <div className="relative">
      <Doughnut data={chartData} options={{
        responsive: true,
        cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.label}: $${ctx.parsed.toLocaleString('en-CA', { minimumFractionDigits: 2 })} (${((ctx.parsed / (total / 100)) * 100).toFixed(1)}%)`,
            },
          },
        },
      }} />
      {centerLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-xs text-gray-500">{centerLabel.label}</p>
          <p className="text-lg font-bold text-white">{centerLabel.value}</p>
        </div>
      )}
    </div>
  );
}

export function SpendingByCategory({ data }) {
  if (!data || data.length === 0) return <p className="text-gray-500 text-sm">No data</p>;

  const chartData = {
    labels: data.map(d => d.category || 'Unknown'),
    datasets: [{
      data: data.map(d => d.total / 100),
      backgroundColor: data.map((_, i) => COLORS[i % COLORS.length] + '90'),
      borderColor: data.map((_, i) => COLORS[i % COLORS.length]),
      borderWidth: 1,
      borderRadius: 4,
    }],
  };

  return (
    <Bar data={chartData} options={{
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: fmtTooltip } } },
      scales: {
        x: { ticks: { color: '#6b7280', font: { size: 11 } }, grid: { display: false } },
        y: { ticks: { color: '#6b7280', callback: v => '$' + v }, grid: { color: '#1f2937' } },
      },
    }} />
  );
}

export function DailySpendingChart({ data }) {
  if (!data || data.length === 0) return <p className="text-gray-500 text-sm">No data</p>;

  const chartData = {
    labels: data.map(d => d.transaction_date.slice(5)), // MM-DD
    datasets: [{
      label: 'Daily Spending',
      data: data.map(d => d.total / 100),
      borderColor: '#22c55e',
      backgroundColor: 'rgba(34,197,94,0.08)',
      fill: true,
      tension: 0.4,
      pointRadius: 2,
      pointBackgroundColor: '#22c55e',
      pointHoverRadius: 5,
    }],
  };

  return (
    <Line data={chartData} options={{
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: fmtTooltip } } },
      scales: {
        x: { ticks: { color: '#6b7280', maxTicksLimit: 12, font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: '#6b7280', callback: v => '$' + v }, grid: { color: '#1f2937' } },
      },
    }} />
  );
}
