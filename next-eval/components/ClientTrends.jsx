'use client';

import { useEffect, useState } from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import AppShell from '@/components/AppShell';
import { fmt, fmtShort } from '@/components/format';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler);

const COLORS = ['#0058bc','#006e28','#bc000a','#f97316','#8b5cf6','#14b8a6','#64748b','#eab308'];
const PRESETS = [
  { label: 'Last 30d', days: 30 },
  { label: 'Last 60d', days: 60 },
  { label: 'Last 90d', days: 90 },
  { label: 'This year', year: true },
  { label: 'All time', all: true },
];

function getPresetDates(p) {
  const to = new Date();
  let from = new Date();
  if (p.days) from.setDate(from.getDate() - p.days);
  else if (p.year) from = new Date(to.getFullYear(), 0, 1);
  else from = new Date('2020-01-01');
  return { date_from: from.toISOString().slice(0, 10), date_to: to.toISOString().slice(0, 10) };
}

const gridColor = '#e3e2e7';
const tickColor = '#717786';
const tickFont = { size: 11 };
const axisCfg = { ticks: { color: tickColor, font: tickFont }, grid: { color: gridColor } };
const moneyTick = (v) => '$' + v.toLocaleString();
const moneyLabel = (ctx) => ` ${ctx.dataset.label}: $${ctx.parsed.y?.toLocaleString('en-CA', { minimumFractionDigits: 2 }) ?? ''}`;

function dollars(n) { const v = parseFloat(n)||0; return Number.isInteger(v) && Math.abs(v) > 100 ? v/100 : v; }

export default function ClientTrends() {
  const [filters, setFilters] = useState(() => getPresetDates({ all: true }));
  const [groupBy, setGroupBy] = useState('month');
  const [accounts, setAccounts] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activePreset, setActivePreset] = useState('All time');
  const [cumulative, setCumulative] = useState(false);

  useEffect(() => { fetch('/api/accounts').then(r=>r.json()).then(d=>setAccounts(d.groups?.flatMap(g=>g.accounts)||[])); }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ group_by: groupBy });
    Object.entries(filters).forEach(([k,v]) => { if (v) params.set(k,v); });
    fetch(`/api/transactions/trends?${params}`).then(r=>r.json()).then(d=>{setData(d);setLoading(false);}).catch(()=>setLoading(false));
  }, [JSON.stringify(filters), groupBy]);

  const setPreset = (p) => {
    setActivePreset(p.label);
    setFilters(f=>({...f,...getPresetDates(p)}));
    if (p.days && p.days<=30) setGroupBy('day');
    else if (p.days && p.days<=90) setGroupBy('week');
    else setGroupBy('month');
  };

  const totals = data?.totals || {};
  const net = (totals.totalIncome||0) - (totals.totalSpent||0);

  const timeData = {
    labels: data?.overTime.map(r=>r.period) || [],
    datasets: cumulative ? [{
      label:'Cumulative Spend', data: data?.cumulativeData.map(r=>dollars(r.cumulative))||[], borderColor:'#bc000a', backgroundColor:'rgba(188,0,10,0.07)', fill:true, tension:0.3, pointRadius:2,
    }] : [
      { label:'Spending', data:data?.overTime.map(r=>dollars(r.spending))||[], borderColor:'#bc000a', backgroundColor:'rgba(188,0,10,0.07)', fill:true, tension:0.3, pointRadius:3 },
      { label:'Credits', data:data?.overTime.map(r=>dollars(r.income))||[], borderColor:'#006e28', backgroundColor:'rgba(0,110,40,0.06)', fill:true, tension:0.3, pointRadius:3 },
    ],
  };

  const momData = {
    labels: data?.byMonth.map(r=>r.month)||[],
    datasets: [
      { label:'Spending', data:data?.byMonth.map(r=>dollars(r.spending))||[], backgroundColor:'rgba(188,0,10,0.7)', borderColor:'#bc000a', borderWidth:1, borderRadius:6 },
      { label:'Income', data:data?.byMonth.map(r=>dollars(r.income))||[], backgroundColor:'rgba(0,110,40,0.7)', borderColor:'#006e28', borderWidth:1, borderRadius:6 },
    ],
  };

  const donutData = {
    labels: data?.byCategory.map(c=>c.category)||[],
    datasets:[{ data:data?.byCategory.map(c=>dollars(c.total))||[], backgroundColor:COLORS, borderColor:'#faf9fe', borderWidth:2 }],
  };

  const lineOpts = { responsive:true, interaction:{mode:'index',intersect:false}, plugins:{ legend:{labels:{color:tickColor}}, tooltip:{callbacks:{label:moneyLabel}} }, scales:{ x:{...axisCfg,ticks:{...axisCfg.ticks,maxTicksLimit:12}}, y:{...axisCfg,ticks:{...axisCfg.ticks,callback:moneyTick}} } };
  const barOpts = { responsive:true, plugins:{ legend:{labels:{color:tickColor}}, tooltip:{callbacks:{label:moneyLabel}} }, scales:{ x:{ticks:{color:tickColor,font:tickFont},grid:{display:false}}, y:{...axisCfg,ticks:{...axisCfg.ticks,callback:moneyTick}} } };

  return (
    <AppShell title="Trends & Insights" subtitle="A forensic view of your financial trajectory.">
      {/* Controls */}
      <div className="surface-card rounded-[1.75rem] p-5 mb-6 space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          {PRESETS.map(p=>(
            <button key={p.label} onClick={()=>setPreset(p)} className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${activePreset===p.label ? 'bg-[var(--primary)] text-white' : 'bg-[var(--surface-soft)] text-[var(--muted)] hover:text-[var(--text)]'}`}>{p.label}</button>
          ))}
          <div className="ml-auto flex items-center gap-1">
            {['day','week','month'].map(g=>(
              <button key={g} onClick={()=>setGroupBy(g)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${groupBy===g ? 'bg-[var(--primary)] text-white' : 'bg-[var(--surface-soft)] text-[var(--muted)]'}`}>{g}</button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          {['date_from','date_to'].map(k=>(
            <div key={k}>
              <label className="block text-xs text-[var(--muted)] mb-1">{k==='date_from'?'From':'To'}</label>
              <input type="date" value={filters[k]||''} onChange={e=>setFilters(f=>({...f,[k]:e.target.value}))}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm" />
            </div>
          ))}
          <div>
            <label className="block text-xs text-[var(--muted)] mb-1">Account</label>
            <select value={filters.account_id||''} onChange={e=>setFilters(f=>({...f,account_id:e.target.value}))}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm">
              <option value="">All accounts</option>
              {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Summary */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label:'Total Spent', value:fmt(totals.totalSpent), color:'text-[var(--tertiary)]' },
            { label:'Total Credits', value:fmt(totals.totalIncome), color:'text-[var(--secondary)]' },
            { label:'Net', value:(net>=0?'+':'')+fmt(net), color:net>=0?'text-[var(--secondary)]':'text-[var(--tertiary)]' },
            { label:'Transactions', value:(totals.count||0).toLocaleString(), color:'' },
          ].map(s=>(
            <div key={s.label} className="surface-card rounded-[1.5rem] p-5 text-center">
              <div className="text-xs text-[var(--muted)] mb-1">{s.label}</div>
              <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {loading && <div className="py-10 text-center text-sm text-[var(--muted)] animate-pulse">Loading trends…</div>}

      {data && !loading && (
        <>
          <div className="surface-card rounded-[1.75rem] p-6 mb-6">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-xl font-bold">Spending Over Time</h3>
              <button onClick={()=>setCumulative(c=>!c)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${cumulative?'bg-[var(--tertiary)] text-white':'bg-[var(--surface-soft)] text-[var(--muted)]'}`}>
                {cumulative ? 'Cumulative' : 'Period'} ↔
              </button>
            </div>
            <Line data={timeData} options={lineOpts} />
          </div>

          <div className="grid gap-6 md:grid-cols-2 mb-6">
            <div className="surface-card rounded-[1.75rem] p-6">
              <h3 className="text-xl font-bold mb-5">Month over Month</h3>
              <Bar data={momData} options={barOpts} />
            </div>
            <div className="surface-card rounded-[1.75rem] p-6">
              <h3 className="text-xl font-bold mb-5">Category Breakdown</h3>
              {data.byCategory.length > 0 ? (
                <div className="flex gap-4">
                  <div className="w-40 flex-shrink-0">
                    <Doughnut data={donutData} options={{ responsive:true, cutout:'65%', plugins:{ legend:{display:false}, tooltip:{callbacks:{label:ctx=>` ${ctx.label}: $${ctx.parsed.toLocaleString('en-CA',{minimumFractionDigits:2})}`}} } }} />
                  </div>
                  <div className="flex-1 space-y-1.5 pt-1">
                    {data.byCategory.map((c,i)=>{
                      const total = data.byCategory.reduce((s,x)=>s+parseFloat(x.total),0);
                      return (
                        <div key={c.category} className="flex items-center gap-2 text-xs">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{background:COLORS[i%COLORS.length]}} />
                          <span className="truncate flex-1 text-[var(--muted)]">{c.category}</span>
                          <span className="text-[var(--muted)]">{((parseFloat(c.total)/total)*100).toFixed(0)}%</span>
                          <span className="font-mono font-semibold">{fmtShort(c.total)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : <p className="text-[var(--muted)] text-sm">No data</p>}
            </div>
          </div>

          <div className="surface-card rounded-[1.75rem] p-6">
            <h3 className="text-xl font-bold mb-5">Top Merchants</h3>
            <div className="space-y-3">
              {data.topMerchants.map((m,i)=>{
                const d = dollars(m.total);
                const maxD = dollars(data.topMerchants[0]?.total||1);
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-[var(--muted)] w-4">{i+1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-semibold truncate">{m.merchant_name}</span>
                        <span className="text-[var(--muted)] flex-shrink-0 ml-2">{m.count}× · <strong>${d.toLocaleString('en-CA',{minimumFractionDigits:2})}</strong></span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--surface-soft)] overflow-hidden">
                        <div className="h-1.5 rounded-full bg-[var(--primary)]" style={{width:`${(d/maxD)*100}%`}} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
