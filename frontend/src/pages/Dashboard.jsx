import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { get_ } from "../api";
import { useAuth } from "../AuthProvider";
import { productImageUrl } from "../imageUtils";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const fmt = (n) => (n ?? 0).toLocaleString("en-KE", { minimumFractionDigits: 2 });
const COLORS = ["#C8A45C", "#1565c0", "#2e7d32", "#c62828", "#7b1fa2"];

// Read time directly from EAT ISO string — avoids browser timezone re-conversion
const eatTime = (ts) => ts ? ts.split("T")[1].slice(0, 8) : "";
const eatDateTime = (ts) => {
  if (!ts) return "";
  const [d, t] = ts.split("T");
  const [y, m, day] = d.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${parseInt(day)} ${months[parseInt(m)-1]} ${y}, ${t.slice(0,8)}`;
};

function SkeletonCard() {
  return <div className="stat-card skeleton" />;
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [daily, setDaily] = useState(null);
  const [weekly, setWeekly] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [cashflow, setCashflow] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [cashierStats, setCashierStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateRange, setDateRange] = useState("today");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [d, w, top, cf, sales, ls] = await Promise.all([
        get_(`/reports/daily?date=${today}`),
        get_(`/reports/weekly?date=${today}`),
        get_("/reports/top-products?limit=5"),
        get_("/reports/cashflow?days=7"),
        get_("/sales?status=completed&limit=8"),
        get_("/products?low_stock=true&threshold=5"),
      ]);
      setDaily(d);
      setWeekly(w);
      setTopProducts(top);

      // Build 7-day cashflow array for line chart
      const cfArr = Object.entries(cf.daily_totals).map(([date, v]) => ({
        date: date.slice(5), // MM-DD
        cash: v.cash,
        mpesa: v.mpesa,
        total: v.cash + v.mpesa,
      }));
      setCashflow(cfArr);
      setRecentSales(sales);
      setLowStock(ls);

      // Cashier leaderboard from recent sales
      const byC = {};
      sales.forEach(s => {
        const n = s.cashier_name || "Unknown";
        if (!byC[n]) byC[n] = { name: n, sales: 0, revenue: 0 };
        byC[n].sales++;
        byC[n].revenue += parseFloat(s.total_amount);
      });
      setCashierStats(Object.values(byC).sort((a, b) => b.revenue - a.revenue));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Payment breakdown for pie chart
  const pieData = daily ? [
    { name: "Cash", value: daily.breakdown?.cash?.total ?? 0 },
    { name: "M-Pesa", value: daily.breakdown?.mpesa?.total ?? 0 },
  ].filter(d => d.value > 0) : [];

  // Insight cards
  const insights = [];
  if (daily && weekly) {
    const dailyAvg = weekly.total_revenue / 7;
    const diff = daily.total_revenue - dailyAvg;
    if (diff > 0) insights.push(`📈 Revenue is KES ${fmt(diff)} above the 7-day daily average`);
    else if (diff < 0) insights.push(`📉 Revenue is KES ${fmt(Math.abs(diff))} below the 7-day daily average`);
  }
  if (topProducts[0]) insights.push(`🏆 Best seller today: ${topProducts[0].name}`);
  if (lowStock.length > 0) insights.push(`⚠️ ${lowStock.length} product${lowStock.length > 1 ? "s" : ""} running low on stock`);
  if (daily?.breakdown?.mpesa?.count > daily?.breakdown?.cash?.count) {
    insights.push("💳 M-Pesa is the dominant payment method today");
  }

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dash-header">
        <div>
          <h1>Welcome back, {user?.name} 👋</h1>
          <p className="muted">
            {new Date().toLocaleDateString("en-KE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="dash-header-actions">
          <Link to="/sales" className="btn btn-primary">+ New Sale</Link>
          <Link to="/products" className="btn btn-outline">+ Product</Link>
          <Link to="/receipts" className="btn btn-outline">🧾 Receipts</Link>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* KPI Cards */}
      <div className="stat-grid">
        {loading ? (
          Array(5).fill(0).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <div className="stat-card stat-card-highlight">
              <div className="stat-label">Today's Revenue</div>
              <div className="stat-value">KES {fmt(daily?.total_revenue)}</div>
              <div className="stat-sub">Week total: KES {fmt(weekly?.total_revenue)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Completed Sales</div>
              <div className="stat-value">{daily?.total_sales ?? 0}</div>
              <div className="stat-sub">This week: {weekly?.total_sales ?? 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Items Sold</div>
              <div className="stat-value">{daily?.items_sold ?? 0}</div>
              <div className="stat-sub">This week: {weekly?.items_sold ?? 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Cash Today</div>
              <div className="stat-value">KES {fmt(daily?.breakdown?.cash?.total)}</div>
              <div className="stat-sub">{daily?.breakdown?.cash?.count ?? 0} transactions</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">M-Pesa Today</div>
              <div className="stat-value">KES {fmt(daily?.breakdown?.mpesa?.total)}</div>
              <div className="stat-sub">{daily?.breakdown?.mpesa?.count ?? 0} transactions</div>
            </div>
          </>
        )}
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="insights-bar">
          {insights.map((ins, i) => (
            <div key={i} className="insight-chip">{ins}</div>
          ))}
        </div>
      )}

      {/* Charts row */}
      <div className="dash-charts">
        {/* Revenue trend */}
        <div className="chart-card">
          <div className="chart-title">Revenue — Last 7 Days</div>
          {cashflow.length === 0 ? (
            <p className="muted" style={{ padding: "2rem", textAlign: "center" }}>No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={cashflow}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => `KES ${fmt(v)}`} />
                <Legend />
                <Line type="monotone" dataKey="cash" stroke="#2e7d32" strokeWidth={2} dot={false} name="Cash" />
                <Line type="monotone" dataKey="mpesa" stroke="#1565c0" strokeWidth={2} dot={false} name="M-Pesa" />
                <Line type="monotone" dataKey="total" stroke={COLORS[0]} strokeWidth={2} dot={false} name="Total" strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Payment breakdown pie */}
        <div className="chart-card chart-card-sm">
          <div className="chart-title">Payment Split (Today)</div>
          {pieData.length === 0 ? (
            <p className="muted" style={{ padding: "2rem", textAlign: "center" }}>No sales yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={(v) => `KES ${fmt(v)}`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top products bar */}
        <div className="chart-card">
          <div className="chart-title">Top Products (All Time)</div>
          {topProducts.length > 0 && (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topProducts} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${v}`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                <Tooltip formatter={(v, n) => n === "total_revenue" ? `KES ${fmt(v)}` : v} />
                <Bar dataKey="total_quantity" fill={COLORS[0]} name="Units Sold" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {topProducts.length === 0 && <p className="muted" style={{ padding: "2rem", textAlign: "center" }}>No data yet</p>}
        </div>
      </div>

      {/* Bottom row: recent sales + low stock + cashier leaderboard */}
      <div className="dash-bottom">
        {/* Recent sales */}
        <div className="dash-panel">
          <div className="section-header">
            <h2>Recent Sales</h2>
            <Link to="/receipts" className="btn btn-outline btn-sm">View All</Link>
          </div>
          {recentSales.length === 0 ? (
            <p className="muted">No completed sales yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Cashier</th><th>Total</th><th>Method</th><th>Time</th><th></th></tr>
              </thead>
              <tbody>
                {recentSales.map(s => (
                  <tr key={s.id}>
                    <td>{s.cashier_name}</td>
                    <td>KES {fmt(parseFloat(s.total_amount))}</td>
                    <td><span className={`badge badge-${s.payment_method}`}>{s.payment_method}</span></td>
                    <td>{eatTime(s.timestamp)}</td>
                    <td><Link to={`/receipts/${s.id}`} className="btn btn-outline btn-sm">Receipt</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Right column */}
        <div className="dash-side">
          {/* Low stock alerts */}
          <div className="dash-panel">
            <div className="section-header">
              <h2>⚠️ Low Stock</h2>
              <Link to="/inventory" className="btn btn-outline btn-sm">Manage</Link>
            </div>
            {lowStock.length === 0 ? (
              <p className="muted">All stock levels healthy ✅</p>
            ) : (
              <div className="alert-list">
                {lowStock.map(p => (
                  <div key={p.id} className={`stock-alert ${p.stock_quantity === 0 ? "out" : "low"}`}>
                    <img src={productImageUrl(p)} alt={p.name} className="stock-alert-img" loading="lazy" />
                    <span>{p.name}</span>
                    <span className={`badge ${p.stock_quantity === 0 ? "badge-cancelled" : "badge-warning"}`}>
                      {p.stock_quantity === 0 ? "Out of stock" : `${p.stock_quantity} left`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cashier leaderboard */}
          {cashierStats.length > 0 && (
            <div className="dash-panel">
              <div className="section-header"><h2>🔥 Cashier Performance</h2></div>
              <div className="leaderboard">
                {cashierStats.map((c, i) => (
                  <div key={c.name} className="leaderboard-row">
                    <span className="lb-rank">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}</span>
                    <span className="lb-name">{c.name}</span>
                    <span className="lb-sales">{c.sales} sales</span>
                    <span className="lb-rev">KES {fmt(c.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="dash-panel">
            <div className="section-header"><h2>Quick Actions</h2></div>
            <div className="quick-actions">
              <Link to="/sales" className="qa-btn">💰 New Sale</Link>
              <Link to="/products" className="qa-btn">➕ Add Product</Link>
              <Link to="/inventory" className="qa-btn">📦 Stock</Link>
              <Link to="/reports" className="qa-btn">📊 Reports</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
