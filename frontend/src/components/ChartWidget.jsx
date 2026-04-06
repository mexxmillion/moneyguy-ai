import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  Title, Tooltip, Legend, Filler,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const COLORS = [
  '#22c55e', '#f97316', '#3b82f6', '#8b5cf6', '#ec4899',
  '#14b8a6', '#64748b', '#ef4444', '#10b981', '#6b7280',
];

export function SpendingByCategory({ data }) {
  if (!data || data.length === 0) return <p className="text-gray-500 text-sm">No data</p>;

  const chartData = {
    labels: data.map(d => d.category || 'Unknown'),
    datasets: [{
      label: 'Spending ($)',
      data: data.map(d => d.total / 100),
      backgroundColor: data.map((_, i) => COLORS[i % COLORS.length] + '80'),
      borderColor: data.map((_, i) => COLORS[i % COLORS.length]),
      borderWidth: 1,
    }],
  };

  return (
    <Bar data={chartData} options={{
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#9ca3af' }, grid: { color: '#1f2937' } },
        y: { ticks: { color: '#9ca3af', callback: v => '$' + v }, grid: { color: '#1f2937' } },
      },
    }} />
  );
}

export function DailySpendingChart({ data }) {
  if (!data || data.length === 0) return <p className="text-gray-500 text-sm">No data</p>;

  const chartData = {
    labels: data.map(d => d.transaction_date),
    datasets: [{
      label: 'Daily Spending ($)',
      data: data.map(d => d.total / 100),
      borderColor: '#22c55e',
      backgroundColor: '#22c55e20',
      fill: true,
      tension: 0.3,
      pointRadius: 3,
      pointBackgroundColor: '#22c55e',
    }],
  };

  return (
    <Line data={chartData} options={{
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#9ca3af', maxTicksLimit: 15 }, grid: { color: '#1f2937' } },
        y: { ticks: { color: '#9ca3af', callback: v => '$' + v }, grid: { color: '#1f2937' } },
      },
    }} />
  );
}
