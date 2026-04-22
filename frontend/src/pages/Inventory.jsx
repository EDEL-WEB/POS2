import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { get_, patch } from "../api";
import { useAuth } from "../AuthProvider";
import { useToast } from "../ToastProvider";

const fmt = (n) => parseFloat(n).toLocaleString("en-KE", { minimumFractionDigits: 2 });

export default function Inventory() {
  const { user } = useAuth();
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [topProducts, setTop]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [adjusting, setAdjusting] = useState(null);
  const [adj, setAdj]           = useState("");
  const [filter, setFilter]     = useState("all"); // all | low | out | fast | slow

  const load = async () => {
    setLoading(true);
    try {
      const [prods, top] = await Promise.all([
        get_("/products"),
        get_("/reports/top-products?limit=10"),
      ]);
      setProducts(prods);
      setTop(top);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const saveAdj = async (e) => {
    e.preventDefault();
    try {
      await patch(`/products/${adjusting.id}/stock`, { adjustment: parseInt(adj) });
      toast(`Stock adjusted for ${adjusting.name}`, "success");
      setAdjusting(null); setAdj("");
      load();
    } catch (e) { toast(e.message, "error"); }
  };

  // Categorize products
  const lowStock  = products.filter(p => p.stock_quantity > 0 && p.stock_quantity <= 5);
  const outStock  = products.filter(p => p.stock_quantity === 0);
  const fastMoving = products.filter(p => topProducts.some(t => t.name === p.name));
  const slowMoving = products.filter(p => !topProducts.some(t => t.name === p.name) && p.stock_quantity > 0);

  const filtered = useMemo(() => {
    if (filter === "low") return lowStock;
    if (filter === "out") return outStock;
    if (filter === "fast") return fastMoving;
    if (filter === "slow") return slowMoving;
    return products;
  }, [filter, products, lowStock, outStock, fastMoving, slowMoving]);

  const stockValue = products.reduce((s, p) => s + p.price * p.stock_quantity, 0);

  return (
    <div className="page-padded">
      <div className="page-header">
        <h1>Inventory Intelligence</h1>
        <Link to="/products" className="btn btn-outline">Manage Products</Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Alerts */}
      {!loading && (
        <>
          {outStock.length > 0 && (
            <div className="alert alert-error">❌ {outStock.length} product{outStock.length > 1 ? "s" : ""} out of stock</div>
          )}
          {lowStock.length > 0 && (
            <div className="alert alert-warn">⚠️ {lowStock.length} product{lowStock.length > 1 ? "s" : ""} running low</div>
          )}
        </>
      )}

      {/* Stats */}
      {!loading && (
        <div className="stat-grid" style={{ marginBottom: "1.5rem" }}>
          <div className="stat-card"><div className="stat-label">Total Products</div><div className="stat-value">{products.length}</div></div>
          <div className="stat-card"><div className="stat-label">Stock Value</div><div className="stat-value">KES {fmt(stockValue)}</div></div>
          <div className="stat-card"><div className="stat-label">Low Stock</div><div className="stat-value" style={{ color: lowStock.length > 0 ? "#f57f17" : "inherit" }}>{lowStock.length}</div></div>
          <div className="stat-card"><div className="stat-label">Out of Stock</div><div className="stat-value" style={{ color: outStock.length > 0 ? "#c62828" : "inherit" }}>{outStock.length}</div></div>
          <div className="stat-card"><div className="stat-label">Fast Moving</div><div className="stat-value">{fastMoving.length}</div></div>
          <div className="stat-card"><div className="stat-label">Slow Moving</div><div className="stat-value">{slowMoving.length}</div></div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="report-tabs" style={{ marginBottom: "1rem" }}>
        {[
          { id: "all",  label: `All (${products.length})` },
          { id: "low",  label: `⚠️ Low Stock (${lowStock.length})` },
          { id: "out",  label: `❌ Out (${outStock.length})` },
          { id: "fast", label: `🔥 Fast Moving (${fastMoving.length})` },
          { id: "slow", label: `🐢 Slow Moving (${slowMoving.length})` },
        ].map(t => (
          <button key={t.id} className={`report-tab ${filter === t.id ? "active" : ""}`} onClick={() => setFilter(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <div className="loading">Loading…</div> : (
        <table className="table">
          <thead>
            <tr><th>Product</th><th>Price (KES)</th><th>Stock</th><th>Status</th><th>Stock Value</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const status = p.stock_quantity === 0 ? "Out" : p.stock_quantity <= 5 ? "Low" : "OK";
              const cls = p.stock_quantity === 0 ? "stock-out" : p.stock_quantity <= 5 ? "stock-low" : "stock-ok";
              return (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong></td>
                  <td>KES {fmt(p.price)}</td>
                  <td>{p.stock_quantity}</td>
                  <td><span className={`stock-badge ${cls}`}>{status}</span></td>
                  <td>KES {fmt(p.price * p.stock_quantity)}</td>
                  <td className="actions">
                    {user?.role === "owner" && (
                      <button className="btn btn-outline btn-sm" onClick={() => { setAdjusting(p); setAdj(""); }}>📦 Adjust</button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--muted)", padding: "2rem" }}>No products in this category.</td></tr>
            )}
          </tbody>
        </table>
      )}

      {/* Adjust modal */}
      {adjusting && (
        <div className="modal-overlay" onClick={() => setAdjusting(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>📦 Adjust Stock — {adjusting.name}</h2>
            <p className="muted" style={{ marginBottom: "1rem" }}>Current: <strong>{adjusting.stock_quantity}</strong> units. Use +10 to add, -3 to remove.</p>
            <form onSubmit={saveAdj} className="form">
              <label>Adjustment</label>
              <input type="number" value={adj} onChange={e => setAdj(e.target.value)} placeholder="e.g. +10 or -3" required />
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setAdjusting(null)}>Cancel</button>
                <button className="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
