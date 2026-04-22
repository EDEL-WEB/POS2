import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { get_, post } from "../api";
import { useToast } from "../ToastProvider";

const fmt = (n) => parseFloat(n).toLocaleString("en-KE", { minimumFractionDigits: 2 });

export default function Receipts() {
  const toast = useToast();
  const [sales, setSales]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [date, setDate]       = useState("");
  const [search, setSearch]   = useState("");
  const [method, setMethod]   = useState("all");
  const [refunding, setRefunding] = useState(null);
  const [refundReason, setRefundReason] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      let q = "?status=completed";
      if (date) q += `&date=${date}`;
      if (method !== "all") q += `&payment_method=${method}`;
      setSales(await get_(`/sales${q}`));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [date, method]);

  const filtered = sales.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      String(s.id).includes(q) ||
      (s.cashier_name || "").toLowerCase().includes(q) ||
      (s.customer_ref || "").toLowerCase().includes(q)
    );
  });

  const handleRefund = async (e) => {
    e.preventDefault();
    try {
      await post(`/sales/${refunding.id}/refund`, { reason: refundReason });
      toast("Sale refunded and stock restored.", "success");
      setRefunding(null); setRefundReason("");
      load();
    } catch (e) { toast(e.message, "error"); }
  };

  // Summary stats
  const totalRevenue = sales.reduce((s, x) => s + parseFloat(x.total_amount), 0);
  const cashTotal    = sales.filter(s => s.payment_method === "cash").reduce((s, x) => s + parseFloat(x.total_amount), 0);
  const mpesaTotal   = sales.filter(s => s.payment_method === "mpesa").reduce((s, x) => s + parseFloat(x.total_amount), 0);

  return (
    <div className="page-padded">
      <div className="page-header">
        <h1>Receipts</h1>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="date-input" />
          {date && <button className="btn btn-outline btn-sm" onClick={() => setDate("")}>Clear date</button>}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Summary cards */}
      {!loading && (
        <div className="stat-grid" style={{ marginBottom: "1.25rem" }}>
          <div className="stat-card"><div className="stat-label">Receipts Found</div><div className="stat-value">{sales.length}</div></div>
          <div className="stat-card"><div className="stat-label">Total Revenue</div><div className="stat-value">KES {fmt(totalRevenue)}</div></div>
          <div className="stat-card"><div className="stat-label">Cash</div><div className="stat-value">KES {fmt(cashTotal)}</div></div>
          <div className="stat-card"><div className="stat-label">M-Pesa</div><div className="stat-value">KES {fmt(mpesaTotal)}</div></div>
        </div>
      )}

      {/* Filters */}
      <div className="prod-filters" style={{ marginBottom: "1rem" }}>
        <input
          className="search-input" style={{ margin: 0, flex: 1 }}
          placeholder="Search by sale #, cashier, or customer…"
          value={search} onChange={e => setSearch(e.target.value)}
        />
        <select value={method} onChange={e => setMethod(e.target.value)}>
          <option value="all">All Methods</option>
          <option value="cash">Cash</option>
          <option value="mpesa">M-Pesa</option>
        </select>
        <span className="muted">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {loading ? <div className="loading">Loading…</div> : filtered.length === 0 ? (
        <p className="muted">No receipts found.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Cashier</th><th>Customer</th><th>Items</th>
              <th>Total (KES)</th><th>Method</th><th>Date & Time</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id}>
                <td>{s.cashier_name}</td>
                <td>{s.customer_ref || <span className="muted">—</span>}</td>
                <td>{s.items?.length ?? 0}</td>
                <td><strong>KES {fmt(parseFloat(s.total_amount))}</strong></td>
                <td><span className={`badge badge-${s.payment_method}`}>{s.payment_method}</span></td>
                <td>{new Date(s.timestamp).toLocaleString("en-KE")}</td>
                <td className="actions">
                  <Link to={`/receipts/${s.id}`} className="btn btn-outline btn-sm">🧾 View</Link>
                  <button className="btn btn-danger btn-sm" onClick={() => { setRefunding(s); setRefundReason(""); }}>↩ Refund</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Refund modal */}
      {refunding && (
        <div className="modal-overlay" onClick={() => setRefunding(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>↩ Refund Sale #{refunding.id}</h2>
            <p className="muted" style={{ marginBottom: "1rem" }}>
              Amount: <strong>KES {fmt(parseFloat(refunding.total_amount))}</strong> · Stock will be restored.
            </p>
            <form onSubmit={handleRefund} className="form">
              <label>Reason (optional)</label>
              <input value={refundReason} onChange={e => setRefundReason(e.target.value)} placeholder="e.g. Customer returned item" />
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setRefunding(null)}>Cancel</button>
                <button className="btn btn-danger">Confirm Refund</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
