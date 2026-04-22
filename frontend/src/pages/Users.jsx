import { useEffect, useState } from "react";
import { get_, authApi } from "../api";
import { useToast } from "../ToastProvider";
import PasswordInput from "../components/PasswordInput";

const fmt = (n) => parseFloat(n).toLocaleString("en-KE", { minimumFractionDigits: 2 });

export default function Users() {
  const toast = useToast();
  const [users, setUsers]     = useState([]);
  const [sales, setSales]     = useState([]);
  const [filter, setFilter]   = useState("active");
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [u, s] = await Promise.all([
        authApi(`/auth/users?status=${filter}`),
        get_("/sales?status=completed"),
      ]);
      setUsers(u);
      setSales(s);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filter]);

  const setStatus = async (id, status, name) => {
    try {
      await authApi(`/auth/users/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      toast(`${name} ${status === "active" ? "approved" : "deactivated"}`, "success");
      load();
    } catch (e) { toast(e.message, "error"); }
  };

  // Build cashier performance from sales
  const perfMap = {};
  sales.forEach(s => {
    const n = s.cashier_name || "Unknown";
    if (!perfMap[n]) perfMap[n] = { sales: 0, revenue: 0 };
    perfMap[n].sales++;
    perfMap[n].revenue += parseFloat(s.total_amount);
  });

  const totalPending  = users.filter(u => u.status === "pending").length;
  const totalActive   = users.filter(u => u.status === "active").length;
  const totalInactive = users.filter(u => u.status === "inactive").length;

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm]       = useState({ name: "", email: "", password: "" });
  const [adding, setAdding]   = useState(false);

  const addCashier = async (e) => {
    e.preventDefault(); setAdding(true);
    try {
      await authApi("/auth/register", { method: "POST", body: JSON.stringify(form) });
      // auto-approve
      const all = await authApi(`/auth/users?status=pending`);
      const created = all.find(u => u.email === form.email);
      if (created) await authApi(`/auth/users/${created.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "active" }) });
      toast(`Cashier ${form.name} added and activated`, "success");
      setShowAdd(false); setForm({ name: "", email: "", password: "" }); load();
    } catch (e) { toast(e.message, "error"); }
    finally { setAdding(false); }
  };

  return (
    <div className="page-padded">
      <div className="page-header">
        <h1>Cashier Management</h1>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Cashier</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Stats */}
      {!loading && (
        <div className="stat-grid" style={{ marginBottom: "1.5rem" }}>
          <div className="stat-card"><div className="stat-label">Active Cashiers</div><div className="stat-value">{totalActive}</div></div>
          <div className="stat-card"><div className="stat-label">Pending Approval</div><div className="stat-value" style={{ color: totalPending > 0 ? "#f57f17" : "inherit" }}>{totalPending}</div></div>
          <div className="stat-card"><div className="stat-label">Inactive</div><div className="stat-value">{totalInactive}</div></div>
          <div className="stat-card"><div className="stat-label">Total Transactions</div><div className="stat-value">{sales.length}</div></div>
        </div>
      )}

      {/* Cashier performance leaderboard */}
      {Object.keys(perfMap).length > 0 && (
        <div className="chart-card" style={{ marginBottom: "1.5rem" }}>
          <div className="chart-title">Cashier Performance (All Time)</div>
          <table className="table" style={{ marginTop: "0.5rem" }}>
            <thead><tr><th>Rank</th><th>Cashier</th><th>Sales</th><th>Revenue (KES)</th><th>Avg Order (KES)</th></tr></thead>
            <tbody>
              {Object.entries(perfMap)
                .sort((a, b) => b[1].revenue - a[1].revenue)
                .map(([name, p], i) => (
                  <tr key={name}>
                    <td>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}</td>
                    <td><strong>{name}</strong></td>
                    <td>{p.sales}</td>
                    <td>{fmt(p.revenue)}</td>
                    <td>{fmt(p.revenue / p.sales)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Filter tabs */}
      <div className="report-tabs" style={{ marginBottom: "1rem" }}>
        {["pending", "active", "inactive"].map(s => (
          <button key={s} className={`report-tab ${filter === s ? "active" : ""}`} onClick={() => setFilter(s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Add cashier modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Add Cashier</h2>
            <form onSubmit={addCashier} className="form">
              <label>Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              <label>Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
              <label>Password</label>
              <PasswordInput value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 8 chars, upper, lower, number, special" required />
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowAdd(false)}>Cancel</button>
                <button className="btn btn-primary" disabled={adding}>{adding ? "Adding…" : "Add Cashier"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? <div className="loading">Loading…</div> : users.length === 0 ? (
        <p className="muted">No {filter} cashiers.</p>
      ) : (
        <table className="table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Status</th><th>Joined</th><th>All-time Sales</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {users.map(u => {
              const perf = perfMap[u.name];
              return (
                <tr key={u.id}>
                  <td><strong>{u.name}</strong></td>
                  <td>{u.email}</td>
                  <td><span className={`badge badge-${u.status}`}>{u.status}</span></td>
                  <td>{new Date(u.created_at).toLocaleDateString("en-KE")}</td>
                  <td>{perf ? `${perf.sales} sales · KES ${fmt(perf.revenue)}` : <span className="muted">No sales yet</span>}</td>
                  <td className="actions">
                    {u.status !== "active"   && <button className="btn btn-primary btn-sm" onClick={() => setStatus(u.id, "active", u.name)}>Approve</button>}
                    {u.status === "active"   && <button className="btn btn-danger btn-sm"  onClick={() => setStatus(u.id, "inactive", u.name)}>Deactivate</button>}
                    {u.status === "inactive" && <button className="btn btn-outline btn-sm" onClick={() => setStatus(u.id, "active", u.name)}>Reactivate</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
