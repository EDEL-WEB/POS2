import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { get_, post } from "../api";
import { useToast } from "../ToastProvider";
import { productImageUrl } from "../imageUtils";

const fmt = (n) => parseFloat(n).toLocaleString("en-KE", { minimumFractionDigits: 2 });

export default function Sales() {
  const navigate = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState("new"); // new | history

  // New sale state
  const [products, setProducts]     = useState([]);
  const [cart, setCart]             = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [phone, setPhone]           = useState("");
  const [customerRef, setCustomerRef] = useState("");
  const [saleError, setSaleError]   = useState("");
  const [saleLoading, setSaleLoading] = useState(false);
  const [search, setSearch]         = useState("");

  // History state
  const [history, setHistory]       = useState([]);
  const [histLoading, setHistLoading] = useState(false);
  const [histError, setHistError]   = useState("");
  const [histDate, setHistDate]     = useState("");
  const [histMethod, setHistMethod] = useState("all");
  const [histStatus, setHistStatus] = useState("all");
  const [detailSale, setDetailSale] = useState(null);

  useEffect(() => {
    get_("/products").then(setProducts).catch(e => setSaleError(e.message));
  }, []);

  useEffect(() => {
    if (tab !== "history") return;
    setHistLoading(true); setHistError("");
    let q = "?";
    if (histStatus !== "all") q += `status=${histStatus}&`;
    if (histDate) q += `date=${histDate}&`;
    if (histMethod !== "all") q += `payment_method=${histMethod}&`;
    get_(`/sales${q}`)
      .then(setHistory)
      .catch(e => setHistError(e.message))
      .finally(() => setHistLoading(false));
  }, [tab, histDate, histMethod, histStatus]);

  // Cart logic
  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) && p.stock_quantity > 0
  );

  const addToCart = (product) => {
    setCart(c => {
      const ex = c.find(i => i.id === product.id);
      if (ex) {
        if (ex.qty >= product.stock_quantity) return c;
        return c.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...c, { ...product, qty: 1 }];
    });
  };

  const updateQty = (id, qty) => {
    if (qty <= 0) setCart(c => c.filter(i => i.id !== id));
    else setCart(c => c.map(i => i.id === id ? { ...i, qty } : i));
  };

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

  const checkout = async () => {
    if (cart.length === 0) return setSaleError("Cart is empty");
    setSaleError(""); setSaleLoading(true);
    try {
      const sale = await post("/sales", {
        payment_method: paymentMethod,
        customer_ref: customerRef || undefined,
        items: cart.map(i => ({ product_id: i.id, quantity: i.qty })),
      });
      if (paymentMethod === "cash") {
        await post("/payments/cash", { sale_id: sale.id });
        toast(`Sale #${sale.id} completed — KES ${fmt(sale.total_amount)}`, "success");
        navigate(`/receipts/${sale.id}`);
      } else {
        if (!phone) { setSaleLoading(false); return setSaleError("Phone number required for M-Pesa"); }
        await post("/payments/mpesa", { sale_id: sale.id, phone_number: phone });
        toast(`STK Push sent to ${phone}`, "info");
        navigate(`/receipts/${sale.id}`);
      }
    } catch (e) {
      setSaleError(e.message);
    } finally {
      setSaleLoading(false);
    }
  };

  return (
    <div>
      {/* Tab switcher */}
      <div className="report-tabs" style={{ padding: "0 1.5rem" }}>
        <button className={`report-tab ${tab === "new" ? "active" : ""}`} onClick={() => setTab("new")}>💰 New Sale</button>
        <button className={`report-tab ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>📋 Sales History</button>
      </div>

      {/* ── New Sale ── */}
      {tab === "new" && (
        <div className="sales-layout">
          <div className="sales-products">
            <input className="search-input" placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)} />
            <div className="product-grid">
              {filtered.map(p => (
                <div key={p.id} className="product-tile" onClick={() => addToCart(p)}>
                  <img src={productImageUrl(p)} alt={p.name} className="product-tile-img" loading="lazy" />
                  <div className="product-tile-name">{p.name}</div>
                  <div className="product-tile-price">KES {fmt(p.price)}</div>
                  <div className="product-tile-stock">Stock: {p.stock_quantity}</div>
                </div>
              ))}
              {filtered.length === 0 && <p className="muted">No products available.</p>}
            </div>
          </div>

          <div className="sales-cart">
            <h2>Cart {cart.length > 0 && <span className="muted" style={{ fontSize: "0.85rem" }}>({cart.length} item{cart.length > 1 ? "s" : ""})</span>}</h2>
            {saleError && <div className="alert alert-error">{saleError}</div>}

            {cart.length === 0 ? (
              <p className="muted">Click a product to add it.</p>
            ) : (
              <div className="cart-items">
                {cart.map(i => (
                  <div key={i.id} className="cart-item">
                    <div className="cart-item-name">{i.name}</div>
                    <div className="cart-item-controls">
                      <button onClick={() => updateQty(i.id, i.qty - 1)}>−</button>
                      <span>{i.qty}</span>
                      <button onClick={() => updateQty(i.id, i.qty + 1)}>+</button>
                    </div>
                    <div className="cart-item-subtotal">KES {fmt(i.price * i.qty)}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="cart-total">
              <span>Total</span>
              <strong>KES {fmt(total)}</strong>
            </div>

            <div className="form" style={{ marginTop: "1rem" }}>
              <label>Customer Ref (optional)</label>
              <input value={customerRef} onChange={e => setCustomerRef(e.target.value)} placeholder="Name or phone" />
              <label>Payment Method</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                <option value="cash">Cash</option>
                <option value="mpesa">M-Pesa</option>
              </select>
              {paymentMethod === "mpesa" && (
                <>
                  <label>Customer Phone</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="07XXXXXXXX" />
                </>
              )}
              <button className="btn btn-primary" onClick={checkout} disabled={saleLoading || cart.length === 0}>
                {saleLoading ? "Processing…" : "✅ Complete Sale"}
              </button>
              {cart.length > 0 && (
                <button className="btn btn-outline" onClick={() => setCart([])}>🗑 Clear Cart</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Sales History ── */}
      {tab === "history" && (
        <div className="page-padded">
          <div className="prod-filters" style={{ marginBottom: "1rem" }}>
            <input type="date" value={histDate} onChange={e => setHistDate(e.target.value)} className="date-input" />
            {histDate && <button className="btn btn-outline btn-sm" onClick={() => setHistDate("")}>Clear</button>}
            <select value={histStatus} onChange={e => setHistStatus(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select value={histMethod} onChange={e => setHistMethod(e.target.value)}>
              <option value="all">All Methods</option>
              <option value="cash">Cash</option>
              <option value="mpesa">M-Pesa</option>
            </select>
            <span className="muted">{history.length} result{history.length !== 1 ? "s" : ""}</span>
          </div>

          {histError && <div className="alert alert-error">{histError}</div>}
          {histLoading ? <div className="loading">Loading…</div> : history.length === 0 ? (
            <p className="muted">No sales found.</p>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Cashier</th><th>Customer</th><th>Items</th><th>Total (KES)</th><th>Method</th><th>Status</th><th>Time</th><th></th></tr>
              </thead>
              <tbody>
                {history.map(s => (
                  <tr key={s.id}>
                    <td>{s.cashier_name}</td>
                    <td>{s.customer_ref || <span className="muted">—</span>}</td>
                    <td>{s.items?.length ?? 0}</td>
                    <td>KES {fmt(parseFloat(s.total_amount))}</td>
                    <td><span className={`badge badge-${s.payment_method}`}>{s.payment_method}</span></td>
                    <td><span className={`badge badge-${s.status}`}>{s.status}</span></td>
                    <td>{new Date(s.timestamp).toLocaleString("en-KE")}</td>
                    <td className="actions">
                      <button className="btn btn-outline btn-sm" onClick={() => setDetailSale(s)}>Details</button>
                      {s.status === "completed" && <Link to={`/receipts/${s.id}`} className="btn btn-outline btn-sm">🧾</Link>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Sale detail modal */}
      {detailSale && (
        <div className="modal-overlay" onClick={() => setDetailSale(null)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
              <h2>Sale #{detailSale.id}</h2>
              <button className="btn btn-outline btn-sm" onClick={() => setDetailSale(null)}>✕</button>
            </div>
            <div className="detail-grid" style={{ marginBottom: "1rem" }}>
              <div className="detail-row"><span>Cashier</span><strong>{detailSale.cashier_name}</strong></div>
              <div className="detail-row"><span>Customer</span><strong>{detailSale.customer_ref || "—"}</strong></div>
              <div className="detail-row"><span>Method</span><span className={`badge badge-${detailSale.payment_method}`}>{detailSale.payment_method}</span></div>
              <div className="detail-row"><span>Status</span><span className={`badge badge-${detailSale.status}`}>{detailSale.status}</span></div>
              <div className="detail-row"><span>Time</span><strong>{new Date(detailSale.timestamp).toLocaleString("en-KE")}</strong></div>
            </div>
            <table className="table">
              <thead><tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Subtotal</th></tr></thead>
              <tbody>
                {detailSale.items?.map(item => (
                  <tr key={item.id}>
                    <td>{item.product_name}</td>
                    <td>{item.quantity}</td>
                    <td>KES {fmt(item.price)}</td>
                    <td>KES {fmt(item.subtotal)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3}><strong>Total</strong></td>
                  <td><strong>KES {fmt(parseFloat(detailSale.total_amount))}</strong></td>
                </tr>
              </tbody>
            </table>
            {detailSale.status === "completed" && (
              <div style={{ marginTop: "1rem" }}>
                <Link to={`/receipts/${detailSale.id}`} className="btn btn-primary">🧾 View Receipt</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
