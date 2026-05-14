import { useEffect, useState } from "react";
import { get_ } from "../api";

const fmt = (n) => (n ?? 0).toLocaleString("en-KE", { minimumFractionDigits: 2 });

// Read time directly from EAT ISO string — avoids browser timezone re-conversion
const eatTime = (ts) => ts ? ts.split("T")[1].slice(0, 8) : "";

export default function Reconciliation() {
  const [date, setDate]         = useState(new Date().toISOString().slice(0, 10));
  const [allSales, setAllSales] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");

  useEffect(() => {
    setLoading(true); setError("");
    get_(`/sales?date=${date}`)
      .then(setAllSales)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [date]);

  // Split by status
  const completed  = allSales.filter(s => s.status === "completed");
  const pending    = allSales.filter(s => s.status === "pending");
  const cancelled  = allSales.filter(s => s.status === "cancelled");

  // Revenue collected (only completed)
  const revenueCollected = completed.reduce((s, x) => s + parseFloat(x.total_amount), 0);
  const cashCollected    = completed.filter(s => s.payment_method === "cash").reduce((s, x) => s + parseFloat(x.total_amount), 0);
  const mpesaCollected   = completed.filter(s => s.payment_method === "mpesa").reduce((s, x) => s + parseFloat(x.total_amount), 0);

  // Stock deducted value (completed + pending — cancelled already restored)
  const stockDeductedValue = [...completed, ...pending].reduce((s, x) => s + parseFloat(x.total_amount), 0);

  // Pending revenue (stock gone, cash not yet confirmed)
  const pendingRevenue = pending.reduce((s, x) => s + parseFloat(x.total_amount), 0);

  // Items breakdown per product across all statuses
  const productMap = {};
  allSales.forEach(sale => {
    sale.items?.forEach(item => {
      if (!productMap[item.product_name]) {
        productMap[item.product_name] = { name: item.product_name, unitsDeducted: 0, unitsPaid: 0, unitsPending: 0, unitsCancelled: 0, revenueCollected: 0, revenuePending: 0 };
      }
      const p = productMap[item.product_name];
      if (sale.status === "completed") {
        p.unitsDeducted += item.quantity;
        p.unitsPaid     += item.quantity;
        p.revenueCollected += item.subtotal;
      } else if (sale.status === "pending") {
        p.unitsDeducted  += item.quantity;
        p.unitsPending   += item.quantity;
        p.revenuePending += item.subtotal;
      } else if (sale.status === "cancelled") {
        p.unitsCancelled += item.quantity;
      }
    });
  });

  const productRows = Object.values(productMap).sort((a, b) => b.revenueCollected - a.revenueCollected);
  const hasDiscrepancy = pendingRevenue > 0;

  return (
    <div className="page-padded">
      <div className="page-header">
        <h1>Stock vs Revenue Reconciliation</h1>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="date-input" />
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {hasDiscrepancy && (
        <div className="alert alert-warn">
          ⚠️ KES {fmt(pendingRevenue)} worth of stock has been deducted but payment is not yet confirmed ({pending.length} pending sale{pending.length > 1 ? "s" : ""}).
        </div>
      )}

      {/* Summary cards */}
      {!loading && (
        <div className="stat-grid" style={{ marginBottom: "1.5rem" }}>
          <div className="stat-card stat-card-highlight">
            <div className="stat-label">Revenue Collected</div>
            <div className="stat-value">KES {fmt(revenueCollected)}</div>
            <div className="stat-sub">{completed.length} completed sale{completed.length !== 1 ? "s" : ""}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Stock Deducted Value</div>
            <div className="stat-value">KES {fmt(stockDeductedValue)}</div>
            <div className="stat-sub">Completed + pending</div>
          </div>
          <div className="stat-card" style={{ borderLeft: pendingRevenue > 0 ? "4px solid #f57f17" : undefined }}>
            <div className="stat-label">Pending (Unconfirmed)</div>
            <div className="stat-value" style={{ color: pendingRevenue > 0 ? "#f57f17" : "inherit" }}>KES {fmt(pendingRevenue)}</div>
            <div className="stat-sub">{pending.length} sale{pending.length !== 1 ? "s" : ""} awaiting payment</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Cash Collected</div>
            <div className="stat-value">KES {fmt(cashCollected)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">M-Pesa Collected</div>
            <div className="stat-value">KES {fmt(mpesaCollected)}</div>
          </div>
          <div className="stat-card" style={{ borderLeft: cancelled.length > 0 ? "4px solid #c62828" : undefined }}>
            <div className="stat-label">Cancelled / Refunded</div>
            <div className="stat-value">{cancelled.length}</div>
            <div className="stat-sub">Stock restored</div>
          </div>
        </div>
      )}

      {/* Gap indicator */}
      {!loading && (
        <div className="recon-gap-bar">
          <div className="recon-gap-label">
            <span>Gap (Stock Deducted − Revenue Collected)</span>
            <strong style={{ color: pendingRevenue > 0 ? "#f57f17" : "#2e7d32" }}>
              {pendingRevenue > 0 ? `⚠️ KES ${fmt(pendingRevenue)} unaccounted` : "✅ Fully reconciled"}
            </strong>
          </div>
          {stockDeductedValue > 0 && (
            <div className="recon-bar">
              <div className="recon-bar-collected" style={{ width: `${Math.min(100, revenueCollected / stockDeductedValue * 100).toFixed(1)}%` }} title={`Collected: KES ${fmt(revenueCollected)}`} />
              <div className="recon-bar-pending"   style={{ width: `${Math.min(100, pendingRevenue / stockDeductedValue * 100).toFixed(1)}%` }} title={`Pending: KES ${fmt(pendingRevenue)}`} />
            </div>
          )}
          <div className="recon-bar-legend">
            <span><span className="legend-dot collected" />Collected</span>
            <span><span className="legend-dot pending-dot" />Pending</span>
          </div>
        </div>
      )}

      {/* Per-product breakdown */}
      {!loading && productRows.length > 0 && (
        <>
          <h2 style={{ margin: "1.5rem 0 0.75rem", fontSize: "1.1rem", fontWeight: 700 }}>Product Breakdown</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Units Sold (Paid)</th>
                <th>Units Pending</th>
                <th>Units Cancelled</th>
                <th>Revenue Collected (KES)</th>
                <th>Revenue Pending (KES)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {productRows.map(p => (
                <tr key={p.name}>
                  <td><strong>{p.name}</strong></td>
                  <td>{p.unitsPaid}</td>
                  <td style={{ color: p.unitsPending > 0 ? "#f57f17" : "inherit" }}>{p.unitsPending}</td>
                  <td style={{ color: p.unitsCancelled > 0 ? "#c62828" : "inherit" }}>{p.unitsCancelled}</td>
                  <td><strong>KES {fmt(p.revenueCollected)}</strong></td>
                  <td style={{ color: p.revenuePending > 0 ? "#f57f17" : "inherit" }}>
                    {p.revenuePending > 0 ? `KES ${fmt(p.revenuePending)}` : "—"}
                  </td>
                  <td>
                    {p.revenuePending > 0
                      ? <span className="stock-badge stock-low">Pending</span>
                      : <span className="stock-badge stock-ok">Reconciled</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Pending sales detail */}
      {!loading && pending.length > 0 && (
        <>
          <h2 style={{ margin: "1.5rem 0 0.75rem", fontSize: "1.1rem", fontWeight: 700 }}>⚠️ Pending Sales (Stock Deducted, Payment Unconfirmed)</h2>
          <table className="table">
            <thead>
              <tr><th>Cashier</th><th>Customer</th><th>Items</th><th>Amount (KES)</th><th>Method</th><th>Time</th></tr>
            </thead>
            <tbody>
              {pending.map(s => (
                <tr key={s.id}>
                  <td>{s.cashier_name}</td>
                  <td>{s.customer_ref || <span className="muted">—</span>}</td>
                  <td>{s.items?.length ?? 0}</td>
                  <td><strong style={{ color: "#f57f17" }}>KES {fmt(parseFloat(s.total_amount))}</strong></td>
                  <td><span className={`badge badge-${s.payment_method}`}>{s.payment_method}</span></td>
                  <td>{eatTime(s.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {!loading && allSales.length === 0 && (
        <p className="muted">No sales found for {date}.</p>
      )}
      {loading && <div className="loading">Loading…</div>}
    </div>
  );
}
