import { useEffect, useState, useMemo } from "react";
import { get_, post, patch, del_ } from "../api";
import { useAuth } from "../AuthProvider";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const fmt = (n) => parseFloat(n).toLocaleString("en-KE", { minimumFractionDigits: 2 });

function stockStatus(qty) {
  if (qty === 0) return { label: "Out of Stock", cls: "stock-out" };
  if (qty <= 5)  return { label: "Low Stock",    cls: "stock-low" };
  return              { label: "In Stock",       cls: "stock-ok" };
}

export default function Products() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";

  const [products, setProducts]   = useState([]);
  const [topProducts, setTop]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");

  // filters
  const [search, setSearch]       = useState("");
  const [stockFilter, setStockFilter] = useState("all"); // all | ok | low | out
  const [minPrice, setMinPrice]   = useState("");
  const [maxPrice, setMaxPrice]   = useState("");
  const [viewMode, setViewMode]   = useState("table"); // table | grid

  // modals
  const [modal, setModal]         = useState(null); // null | "add" | product
  const [detailProduct, setDetail] = useState(null);
  const [form, setForm]           = useState({ name: "", price: "", stock_quantity: "" });
  const [adjProduct, setAdjProduct] = useState(null);
  const [adjValue, setAdjValue]   = useState("");
  const [saving, setSaving]       = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [prods, top] = await Promise.all([
        get_("/products"),
        get_("/reports/top-products?limit=5"),
      ]);
      setProducts(prods);
      setTop(top);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // ── Derived stats ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = products.length;
    const lowStock = products.filter(p => p.stock_quantity > 0 && p.stock_quantity <= 5).length;
    const outOfStock = products.filter(p => p.stock_quantity === 0).length;
    const stockValue = products.reduce((s, p) => s + p.price * p.stock_quantity, 0);
    const bestSeller = topProducts[0]?.name ?? "—";
    return { total, lowStock, outOfStock, stockValue, bestSeller };
  }, [products, topProducts]);

  // ── Filtered list ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return products.filter(p => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (minPrice !== "" && p.price < parseFloat(minPrice)) return false;
      if (maxPrice !== "" && p.price > parseFloat(maxPrice)) return false;
      if (stockFilter === "ok"  && !(p.stock_quantity > 5)) return false;
      if (stockFilter === "low" && !(p.stock_quantity > 0 && p.stock_quantity <= 5)) return false;
      if (stockFilter === "out" && p.stock_quantity !== 0) return false;
      return true;
    });
  }, [products, search, minPrice, maxPrice, stockFilter]);

  // ── CRUD ───────────────────────────────────────────────────────────────
  const openAdd  = () => { setForm({ name: "", price: "", stock_quantity: "" }); setModal("add"); };
  const openEdit = (p) => { setForm({ name: p.name, price: p.price, stock_quantity: p.stock_quantity }); setModal(p); };

  const save = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (modal === "add") {
        await post("/products", { name: form.name, price: parseFloat(form.price), stock_quantity: parseInt(form.stock_quantity) });
      } else {
        await patch(`/products/${modal.id}`, { price: parseFloat(form.price), stock_quantity: parseInt(form.stock_quantity) });
      }
      setModal(null); load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const remove = async (p) => {
    if (!confirm(`Delete "${p.name}"?`)) return;
    try { await del_(`/products/${p.id}`); load(); }
    catch (e) { setError(e.message); }
  };

  const saveAdj = async (e) => {
    e.preventDefault();
    try {
      await patch(`/products/${adjProduct.id}/stock`, { adjustment: parseInt(adjValue) });
      setAdjProduct(null); setAdjValue(""); load();
    } catch (e) { setError(e.message); }
  };

  // ── Alerts ────────────────────────────────────────────────────────────
  const alerts = [];
  if (stats.outOfStock > 0) alerts.push({ type: "error", msg: `❌ ${stats.outOfStock} product${stats.outOfStock > 1 ? "s" : ""} out of stock` });
  if (stats.lowStock > 0)   alerts.push({ type: "warn",  msg: `⚠️ ${stats.lowStock} product${stats.lowStock > 1 ? "s" : ""} running low` });
  if (stats.bestSeller !== "—") alerts.push({ type: "info", msg: `🔥 Best seller: ${stats.bestSeller}` });

  return (
    <div className="products-page">
      {/* Header */}
      <div className="page-header">
        <h1>Products</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className={`btn btn-outline btn-sm ${viewMode === "table" ? "active-view" : ""}`} onClick={() => setViewMode("table")}>☰ Table</button>
          <button className={`btn btn-outline btn-sm ${viewMode === "grid" ? "active-view" : ""}`} onClick={() => setViewMode("grid")}>⊞ Grid</button>
          {isOwner && <button className="btn btn-primary" onClick={openAdd}>+ Add Product</button>}
        </div>
      </div>

      {/* Alerts */}
      {alerts.map((a, i) => (
        <div key={i} className={`alert ${a.type === "error" ? "alert-error" : a.type === "warn" ? "alert-warn" : "alert-info"}`}>{a.msg}</div>
      ))}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Stats cards */}
      <div className="stat-grid" style={{ marginBottom: "1.5rem" }}>
        <div className="stat-card"><div className="stat-label">Total Products</div><div className="stat-value">{stats.total}</div></div>
        <div className="stat-card"><div className="stat-label">Low Stock</div><div className="stat-value" style={{ color: stats.lowStock > 0 ? "#f57f17" : "inherit" }}>{stats.lowStock}</div></div>
        <div className="stat-card"><div className="stat-label">Out of Stock</div><div className="stat-value" style={{ color: stats.outOfStock > 0 ? "#c62828" : "inherit" }}>{stats.outOfStock}</div></div>
        <div className="stat-card"><div className="stat-label">Stock Value (KES)</div><div className="stat-value">{fmt(stats.stockValue)}</div></div>
        <div className="stat-card"><div className="stat-label">🔥 Best Seller</div><div className="stat-value" style={{ fontSize: "1rem" }}>{stats.bestSeller}</div></div>
      </div>

      {/* Top products chart */}
      {topProducts.length > 0 && (
        <div className="chart-card" style={{ marginBottom: "1.5rem" }}>
          <div className="chart-title">Top Selling Products (Units)</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={topProducts} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={140} />
              <Tooltip formatter={(v, n) => n === "total_revenue" ? `KES ${fmt(v)}` : v} />
              <Bar dataKey="total_quantity" fill="#C8A45C" name="Units Sold" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filters */}
      <div className="prod-filters">
        <input className="search-input" style={{ margin: 0, flex: 1 }} placeholder="Search by name…" value={search} onChange={e => setSearch(e.target.value)} />
        <select value={stockFilter} onChange={e => setStockFilter(e.target.value)}>
          <option value="all">All Stock</option>
          <option value="ok">In Stock</option>
          <option value="low">Low Stock</option>
          <option value="out">Out of Stock</option>
        </select>
        <input type="number" placeholder="Min price" value={minPrice} onChange={e => setMinPrice(e.target.value)} style={{ width: "110px" }} />
        <input type="number" placeholder="Max price" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} style={{ width: "110px" }} />
        <span className="muted" style={{ whiteSpace: "nowrap" }}>{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table view */}
      {loading ? <div className="loading">Loading…</div> : viewMode === "table" ? (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th><th>Price (KES)</th><th>Stock</th><th>Status</th><th>Stock Value</th>
              {isOwner && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const s = stockStatus(p.stock_quantity);
              return (
                <tr key={p.id}>
                  <td>
                    <button className="prod-name-btn" onClick={() => setDetail(p)}>{p.name}</button>
                  </td>
                  <td className="price-cell">KES {fmt(p.price)}</td>
                  <td>{p.stock_quantity}</td>
                  <td><span className={`stock-badge ${s.cls}`}>{s.label}</span></td>
                  <td>KES {fmt(p.price * p.stock_quantity)}</td>
                  {isOwner && (
                    <td className="actions">
                      <button className="btn btn-outline btn-sm" onClick={() => openEdit(p)}>✏️ Edit</button>
                      <button className="btn btn-outline btn-sm" onClick={() => { setAdjProduct(p); setAdjValue(""); }}>📦 Stock</button>
                      <button className="btn btn-danger btn-sm" onClick={() => remove(p)}>🗑</button>
                    </td>
                  )}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={isOwner ? 6 : 5} style={{ textAlign: "center", color: "var(--muted)", padding: "2rem" }}>No products match your filters.</td></tr>
            )}
          </tbody>
        </table>
      ) : (
        /* Grid view */
        <div className="prod-grid">
          {filtered.map(p => {
            const s = stockStatus(p.stock_quantity);
            return (
              <div key={p.id} className="prod-card" onClick={() => setDetail(p)}>
                <div className="prod-card-icon">🧴</div>
                <div className="prod-card-name">{p.name}</div>
                <div className="prod-card-price">KES {fmt(p.price)}</div>
                <span className={`stock-badge ${s.cls}`}>{s.label} ({p.stock_quantity})</span>
                {isOwner && (
                  <div className="prod-card-actions" onClick={e => e.stopPropagation()}>
                    <button className="btn btn-outline btn-sm" onClick={() => openEdit(p)}>✏️</button>
                    <button className="btn btn-outline btn-sm" onClick={() => { setAdjProduct(p); setAdjValue(""); }}>📦</button>
                    <button className="btn btn-danger btn-sm" onClick={() => remove(p)}>🗑</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{modal === "add" ? "Add Product" : `Edit: ${modal.name}`}</h2>
            <form onSubmit={save} className="form">
              {modal === "add" && (
                <><label>Name</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></>
              )}
              <label>Price (KES)</label>
              <input type="number" step="0.01" min="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required />
              <label>Stock Quantity</label>
              <input type="number" min="0" value={form.stock_quantity} onChange={e => setForm(f => ({ ...f, stock_quantity: e.target.value }))} required />
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
                <button className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock adjustment modal */}
      {adjProduct && (
        <div className="modal-overlay" onClick={() => setAdjProduct(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>📦 Adjust Stock — {adjProduct.name}</h2>
            <p className="muted" style={{ marginBottom: "1rem" }}>Current: <strong>{adjProduct.stock_quantity}</strong> units. Use +10 to add, -3 to remove.</p>
            <form onSubmit={saveAdj} className="form">
              <label>Adjustment</label>
              <input type="number" value={adjValue} onChange={e => setAdjValue(e.target.value)} placeholder="e.g. +10 or -3" required />
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setAdjProduct(null)}>Cancel</button>
                <button className="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product detail side panel */}
      {detailProduct && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
              <h2>🧴 {detailProduct.name}</h2>
              <button className="btn btn-outline btn-sm" onClick={() => setDetail(null)}>✕ Close</button>
            </div>
            <div className="detail-grid">
              <div className="detail-row"><span>Price</span><strong>KES {fmt(detailProduct.price)}</strong></div>
              <div className="detail-row"><span>Stock</span><strong>{detailProduct.stock_quantity} units</strong></div>
              <div className="detail-row"><span>Status</span><span className={`stock-badge ${stockStatus(detailProduct.stock_quantity).cls}`}>{stockStatus(detailProduct.stock_quantity).label}</span></div>
              <div className="detail-row"><span>Stock Value</span><strong>KES {fmt(detailProduct.price * detailProduct.stock_quantity)}</strong></div>
            </div>
            {(() => {
              const tp = topProducts.find(t => t.name === detailProduct.name);
              return tp ? (
                <div style={{ marginTop: "1.25rem" }}>
                  <div className="chart-title">Sales Performance</div>
                  <div className="detail-grid" style={{ marginTop: "0.5rem" }}>
                    <div className="detail-row"><span>Total Units Sold</span><strong>{tp.total_quantity}</strong></div>
                    <div className="detail-row"><span>Total Revenue</span><strong>KES {fmt(tp.total_revenue)}</strong></div>
                  </div>
                </div>
              ) : <p className="muted" style={{ marginTop: "1rem" }}>No sales data yet for this product.</p>;
            })()}
            {isOwner && (
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.5rem" }}>
                <button className="btn btn-outline" onClick={() => { setDetail(null); openEdit(detailProduct); }}>✏️ Edit</button>
                <button className="btn btn-outline" onClick={() => { setDetail(null); setAdjProduct(detailProduct); setAdjValue(""); }}>📦 Adjust Stock</button>
                <button className="btn btn-danger" onClick={() => { setDetail(null); remove(detailProduct); }}>🗑 Delete</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
