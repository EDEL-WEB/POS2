import { useEffect, useState, useMemo } from "react";
import { get_ } from "../api";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";

const fmt = (n) => (n ?? 0).toLocaleString("en-KE", { minimumFractionDigits: 2 });
const COLORS = ["#C8A45C", "#1565c0", "#2e7d32", "#c62828", "#7b1fa2", "#e65100"];

// ── Tab: Overview ────────────────────────────────────────────────────────────
function OverviewTab({ date, setDate, preset, setPreset }) {
  const [daily, setDaily]     = useState(null);
  const [weekly, setWeekly]   = useState(null);
  const [monthly, setMonthly] = useState(null);
  const [cashflow, setCashflow] = useState([]);
  const [sales, setSales]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    setLoading(true); setError("");
    Promise.all([
      get_(`/reports/daily?date=${date}`),
      get_(`/reports/weekly?date=${date}`),
      get_(`/reports/monthly?date=${date}`),
      get_("/reports/cashflow?days=30"),
      get_(`/sales?status=completed&date=${date}`),
    ])
      .then(([d, w, m, cf, s]) => {
        setDaily(d); setWeekly(w); setMonthly(m);
        setCashflow(
          Object.entries(cf.daily_totals).map(([dt, v]) => ({
            date: dt.slice(5),
            cash: v.cash, mpesa: v.mpesa, total: v.cash + v.mpesa,
          }))
        );
        setSales(s);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [date]);

  // Cashier leaderboard from sales
  const cashierStats = useMemo(() => {
    const map = {};
    sales.forEach(s => {
      const n = s.cashier_name || "Unknown";
      if (!map[n]) map[n] = { name: n, sales: 0, revenue: 0 };
      map[n].sales++;
      map[n].revenue += parseFloat(s.total_amount);
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [sales]);

  // Insights
  const insights = useMemo(() => {
    if (!daily || !weekly) return [];
    const out = [];
    const avg = weekly.total_revenue / 7;
    const diff = daily.total_revenue - avg;
    if (diff > 0) out.push(`📈 Revenue is KES ${fmt(diff)} above the 7-day daily average`);
    else if (diff < 0) out.push(`📉 Revenue is KES ${fmt(Math.abs(diff))} below the 7-day daily average`);
    const aov = daily.total_sales > 0 ? daily.total_revenue / daily.total_sales : 0;
    if (aov > 0) out.push(`🧾 Average order value today: KES ${fmt(aov)}`);
    const cashPct = daily.total_revenue > 0 ? (daily.breakdown?.cash?.total / daily.total_revenue * 100).toFixed(0) : 0;
    const mpesaPct = daily.total_revenue > 0 ? (daily.breakdown?.mpesa?.total / daily.total_revenue * 100).toFixed(0) : 0;
    if (cashPct > mpesaPct) out.push(`💵 Cash dominates today at ${cashPct}% of revenue`);
    else if (mpesaPct > 0) out.push(`📱 M-Pesa dominates today at ${mpesaPct}% of revenue`);
    if (cashierStats[0]) out.push(`🏆 Top cashier: ${cashierStats[0].name} — KES ${fmt(cashierStats[0].revenue)}`);
    return out;
  }, [daily, weekly, cashierStats]);

  const pieData = daily ? [
    { name: "Cash",   value: daily.breakdown?.cash?.total  ?? 0 },
    { name: "M-Pesa", value: daily.breakdown?.mpesa?.total ?? 0 },
  ].filter(d => d.value > 0) : [];

  const aov = daily?.total_sales > 0 ? daily.total_revenue / daily.total_sales : 0;

  if (loading) return <div className="loading">Loading…</div>;
  if (error)   return <div className="alert alert-error">{error}</div>;

  return (
    <div>
      {/* Date presets */}
      <div className="report-presets">
        {[
          { label: "Today",     val: "today" },
          { label: "Yesterday", val: "yesterday" },
          { label: "This Week", val: "week" },
          { label: "This Month",val: "month" },
        ].map(p => (
          <button
            key={p.val}
            className={`btn btn-sm ${preset === p.val ? "btn-primary" : "btn-outline"}`}
            onClick={() => {
              setPreset(p.val);
              const d = new Date();
              if (p.val === "today")     setDate(d.toISOString().slice(0, 10));
              if (p.val === "yesterday") { d.setDate(d.getDate() - 1); setDate(d.toISOString().slice(0, 10)); }
              if (p.val === "week")      { d.setDate(d.getDate() - d.getDay() + 1); setDate(d.toISOString().slice(0, 10)); }
              if (p.val === "month")     setDate(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10));
            }}
          >{p.label}</button>
        ))}
        <input type="date" value={date} className="date-input" onChange={e => { setDate(e.target.value); setPreset("custom"); }} />
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="insights-bar" style={{ marginBottom: "1.25rem" }}>
          {insights.map((ins, i) => <div key={i} className="insight-chip">{ins}</div>)}
        </div>
      )}

      {/* KPI cards */}
      <div className="stat-grid" style={{ marginBottom: "1.5rem" }}>
        <div className="stat-card stat-card-highlight">
          <div className="stat-label">Daily Revenue</div>
          <div className="stat-value">KES {fmt(daily?.total_revenue)}</div>
          <div className="stat-sub">Month: KES {fmt(monthly?.total_revenue)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Transactions</div>
          <div className="stat-value">{daily?.total_sales ?? 0}</div>
          <div className="stat-sub">Week: {weekly?.total_sales ?? 0} · Month: {monthly?.total_sales ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Items Sold</div>
          <div className="stat-value">{daily?.items_sold ?? 0}</div>
          <div className="stat-sub">Week: {weekly?.items_sold ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Order Value</div>
          <div className="stat-value">KES {fmt(aov)}</div>
          <div className="stat-sub">Revenue ÷ transactions</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Cash</div>
          <div className="stat-value">KES {fmt(daily?.breakdown?.cash?.total)}</div>
          <div className="stat-sub">{daily?.breakdown?.cash?.count ?? 0} transactions</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">M-Pesa</div>
          <div className="stat-value">KES {fmt(daily?.breakdown?.mpesa?.total)}</div>
          <div className="stat-sub">{daily?.breakdown?.mpesa?.count ?? 0} transactions</div>
        </div>
      </div>

      {/* Charts row */}
      <div className="report-charts">
        {/* Revenue trend */}
        <div className="chart-card" style={{ gridColumn: "span 2" }}>
          <div className="chart-title">Revenue Trend — Last 30 Days</div>
          {cashflow.length === 0 ? <p className="muted" style={{ padding: "2rem", textAlign: "center" }}>No data</p> : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={cashflow}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => `KES ${fmt(v)}`} />
                <Legend />
                <Line type="monotone" dataKey="cash"  stroke="#2e7d32" strokeWidth={2} dot={false} name="Cash" />
                <Line type="monotone" dataKey="mpesa" stroke="#1565c0" strokeWidth={2} dot={false} name="M-Pesa" />
                <Line type="monotone" dataKey="total" stroke="#C8A45C" strokeWidth={2} dot={false} name="Total" strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Payment split pie */}
        <div className="chart-card">
          <div className="chart-title">Payment Split (Selected Day)</div>
          {pieData.length === 0 ? <p className="muted" style={{ padding: "2rem", textAlign: "center" }}>No sales</p> : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={v => `KES ${fmt(v)}`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Cashier performance */}
      {cashierStats.length > 0 && (
        <div className="chart-card" style={{ marginTop: "1rem" }}>
          <div className="chart-title">Cashier Performance (Selected Day)</div>
          <table className="table" style={{ marginTop: "0.5rem" }}>
            <thead><tr><th>Rank</th><th>Cashier</th><th>Sales</th><th>Revenue (KES)</th><th>Avg Order (KES)</th></tr></thead>
            <tbody>
              {cashierStats.map((c, i) => (
                <tr key={c.name}>
                  <td>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}</td>
                  <td><strong>{c.name}</strong></td>
                  <td>{c.sales}</td>
                  <td>{fmt(c.revenue)}</td>
                  <td>{fmt(c.revenue / c.sales)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Tab: Products ────────────────────────────────────────────────────────────
function ProductsTab() {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [limit, setLimit]     = useState(10);

  useEffect(() => {
    setLoading(true);
    get_(`/reports/top-products?limit=${limit}`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [limit]);

  const maxQty = data[0]?.total_quantity ?? 1;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div className="insights-bar" style={{ margin: 0 }}>
          {data[0] && <div className="insight-chip">🏆 Best seller: {data[0].name} — {data[0].total_quantity} units</div>}
          {data.length > 0 && <div className="insight-chip">💰 Top revenue: {data.sort((a,b)=>b.total_revenue-a.total_revenue)[0]?.name}</div>}
        </div>
        <select value={limit} onChange={e => setLimit(Number(e.target.value))} style={{ width: "auto", padding: "0.4rem 0.75rem" }}>
          <option value={5}>Top 5</option>
          <option value={10}>Top 10</option>
          <option value={20}>Top 20</option>
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading ? <div className="loading">Loading…</div> : (
        <>
          <div className="chart-card" style={{ marginBottom: "1rem" }}>
            <div className="chart-title">Units Sold per Product</div>
            <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36)}>
              <BarChart data={data} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={150} />
                <Tooltip formatter={(v, n) => n === "total_revenue" ? `KES ${fmt(v)}` : v} />
                <Legend />
                <Bar dataKey="total_quantity" fill="#C8A45C" name="Units Sold" radius={[0, 4, 4, 0]} />
                <Bar dataKey="total_revenue"  fill="#1565c0" name="Revenue (KES)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <table className="table">
            <thead>
              <tr><th>Rank</th><th>Product</th><th>Units Sold</th><th>Revenue (KES)</th><th>Share</th></tr>
            </thead>
            <tbody>
              {data.map((r, i) => (
                <tr key={r.name}>
                  <td>{i + 1}</td>
                  <td><strong>{r.name}</strong></td>
                  <td>{r.total_quantity}</td>
                  <td>{fmt(r.total_revenue)}</td>
                  <td>
                    <div className="share-bar">
                      <div className="share-fill" style={{ width: `${(r.total_quantity / maxQty * 100).toFixed(0)}%` }} />
                      <span>{(r.total_quantity / maxQty * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

// ── Tab: Cashflow ────────────────────────────────────────────────────────────
function CashflowTab() {
  const [days, setDays]       = useState(30);
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    setLoading(true);
    get_(`/reports/cashflow?days=${days}`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [days]);

  const rows = data ? Object.entries(data.daily_totals).map(([d, v]) => ({
    date: d, cash: v.cash, mpesa: v.mpesa, total: v.cash + v.mpesa,
  })) : [];

  const totalCash  = rows.reduce((s, r) => s + r.cash, 0);
  const totalMpesa = rows.reduce((s, r) => s + r.mpesa, 0);
  const totalRev   = totalCash + totalMpesa;
  const peakDay    = rows.reduce((best, r) => r.total > (best?.total ?? 0) ? r : best, null);

  return (
    <div>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", alignItems: "center" }}>
        {[7, 14, 30, 60, 90].map(d => (
          <button key={d} className={`btn btn-sm ${days === d ? "btn-primary" : "btn-outline"}`} onClick={() => setDays(d)}>
            {d}d
          </button>
        ))}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {!loading && rows.length > 0 && (
        <>
          <div className="insights-bar" style={{ marginBottom: "1rem" }}>
            <div className="insight-chip">💰 Total revenue: KES {fmt(totalRev)}</div>
            <div className="insight-chip">💵 Cash: KES {fmt(totalCash)} ({totalRev > 0 ? (totalCash/totalRev*100).toFixed(0) : 0}%)</div>
            <div className="insight-chip">📱 M-Pesa: KES {fmt(totalMpesa)} ({totalRev > 0 ? (totalMpesa/totalRev*100).toFixed(0) : 0}%)</div>
            {peakDay && <div className="insight-chip">🔥 Peak day: {peakDay.date} — KES {fmt(peakDay.total)}</div>}
          </div>

          <div className="chart-card" style={{ marginBottom: "1rem" }}>
            <div className="chart-title">Daily Revenue — Last {days} Days</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={Math.floor(rows.length / 10)} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => `KES ${fmt(v)}`} />
                <Legend />
                <Bar dataKey="cash"  stackId="a" fill="#2e7d32" name="Cash" />
                <Bar dataKey="mpesa" stackId="a" fill="#1565c0" name="M-Pesa" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <table className="table">
            <thead><tr><th>Date</th><th>Cash (KES)</th><th>M-Pesa (KES)</th><th>Total (KES)</th></tr></thead>
            <tbody>
              {[...rows].reverse().map(r => (
                <tr key={r.date} className={r.date === peakDay?.date ? "peak-row" : ""}>
                  <td>{r.date}</td>
                  <td>{fmt(r.cash)}</td>
                  <td>{fmt(r.mpesa)}</td>
                  <td><strong>{fmt(r.total)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {loading && <div className="loading">Loading…</div>}
      {!loading && rows.length === 0 && <p className="muted">No data for this period.</p>}
    </div>
  );
}

// ── Main Reports page ────────────────────────────────────────────────────────
export default function Reports() {
  const [tab, setTab]     = useState("overview");
  const [date, setDate]   = useState(new Date().toISOString().slice(0, 10));
  const [preset, setPreset] = useState("today");

  const tabs = [
    { id: "overview",  label: "📊 Overview" },
    { id: "products",  label: "📦 Products" },
    { id: "cashflow",  label: "💳 Cashflow" },
  ];

  return (
    <div className="reports-page">
      <div className="page-header"><h1>Reports</h1></div>

      <div className="report-tabs">
        {tabs.map(t => (
          <button key={t.id} className={`report-tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="report-body">
        {tab === "overview" && <OverviewTab date={date} setDate={setDate} preset={preset} setPreset={setPreset} />}
        {tab === "products" && <ProductsTab />}
        {tab === "cashflow" && <CashflowTab />}
      </div>
    </div>
  );
}
