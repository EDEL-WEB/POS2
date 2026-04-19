import { useEffect, useMemo, useState } from "react";
import { authRequest } from "../api";

export default function Sales() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [customerRef, setCustomerRef] = useState("");
  const [saleNotes, setSaleNotes] = useState("");
  const [sale, setSale] = useState(null);
  const [salesHistory, setSalesHistory] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    fetchProducts();
    fetchSettings();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const data = await authRequest("/products", { method: "GET" });
      setProducts(data);
    } catch (err) {
      setError(err.message || "Unable to load products");
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const data = await authRequest("/settings", { method: "GET" });
      setSettings(data);
      // Set default payment method based on enabled methods
      if (data.enable_cash && !data.enable_mpesa) {
        setPaymentMethod("cash");
      } else if (!data.enable_cash && data.enable_mpesa) {
        setPaymentMethod("mpesa");
      }
    } catch (err) {
      // Settings might not exist yet, use defaults
      setSettings({
        enable_cash: true,
        enable_mpesa: true,
        currency: "KES"
      });
    }
  };

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity * item.product.price, 0),
    [cart]
  );

  const addToCart = (product) => {
    setError("");
    setMessage("");
    setSale(null);
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      if (existing) {
        return current.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...current, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId, quantity) => {
    setCart((current) =>
      current
        .map((item) => (item.product.id === productId ? { ...item, quantity } : item))
        .filter((item) => item.quantity > 0)
    );
  };

  const handleCreateSale = async () => {
    setError("");
    setMessage("");
    if (!cart.length) {
      setError("Add at least one product to the cart.");
      return;
    }

    try {
      const payload = {
        items: cart.map((item) => ({ product_id: item.product.id, quantity: item.quantity })),
        payment_method: paymentMethod,
        customer_ref: customerRef || null,
        notes: saleNotes || null,
      };
      const result = await authRequest("/sales", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setSale(result);
      setMessage("Sale created. Complete payment below.");
      setCart([]);
      setCustomerRef("");
      setSaleNotes("");
    } catch (err) {
      setError(err.message || "Unable to create sale");
    }
  };

  const handleCashPayment = async () => {
    if (!sale) return;
    setError("");
    setMessage("");
    try {
      const result = await authRequest("/payments/cash", {
        method: "POST",
        body: JSON.stringify({ sale_id: sale.id }),
      });
      setSale(result.sale || sale);
      setMessage(result.message || "Cash payment completed.");
    } catch (err) {
      setError(err.message || "Unable to complete cash payment");
    }
  };

  const handleMpesaPayment = async () => {
    if (!sale) {
      setError("Create the sale first.");
      return;
    }
    setError("");
    setMessage("");
    try {
      const result = await authRequest("/payments/mpesa", {
        method: "POST",
        body: JSON.stringify({ sale_id: sale.id, phone_number: phoneNumber }),
      });
      setSale(result.payment ? { ...sale, payment: result.payment } : sale);
      setMessage(result.message || "M-Pesa payment initiated.");
    } catch (err) {
      setError(err.message || "Unable to initiate M-Pesa payment");
    }
  };

  const fetchSalesHistory = async () => {
    setLoading(true);
    try {
      const data = await authRequest("/sales", { method: "GET" });
      setSalesHistory(data);
    } catch (err) {
      setError(err.message || "Unable to load sales history");
    } finally {
      setLoading(false);
    }
  };

  const handleRefund = async () => {
    if (!selectedSale) return;
    try {
      const payload = { reason: refundReason };
      if (refundAmount) payload.refund_amount = parseFloat(refundAmount);
      const result = await authRequest(`/sales/${selectedSale.id}/refund`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setMessage(result.message);
      setShowRefundModal(false);
      setSelectedSale(null);
      setRefundAmount("");
      setRefundReason("");
      if (showHistory) await fetchSalesHistory();
    } catch (err) {
      setError(err.message || "Unable to process refund");
    }
  };

  const handleGetReceipt = async (saleId) => {
    try {
      const data = await authRequest(`/sales/${saleId}/receipt`, { method: "GET" });
      setReceipt(data);
      setShowReceiptModal(true);
    } catch (err) {
      setError(err.message || "Unable to load receipt");
    }
  };

  const filteredSales = useMemo(() => {
    return salesHistory.filter((sale) => {
      const matchesSearch = !searchTerm ||
        sale.customer_ref?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.id.toString().includes(searchTerm);
      const matchesStatus = statusFilter === "all" || sale.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [salesHistory, searchTerm, statusFilter]);

  return (
    <div className="card">
      <h1 className="heading">Sales</h1>
      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert error">{error}</div>}

      <section className="card" style={{ marginBottom: "1.5rem" }}>
        <h2>Products</h2>
        {loading ? (
          <p>Loading products...</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>{product.name}</td>
                    <td>{settings?.currency || "KES"} {product.price.toFixed(2)}</td>
                    <td>{product.stock_quantity}</td>
                    <td>
                      <button type="button" className="primary" onClick={() => addToCart(product)}>
                        Add
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card" style={{ marginBottom: "1.5rem" }}>
        <h2>Cart</h2>
        {cart.length === 0 ? (
          <p className="small">Add products to the cart to create a sale.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Unit Price</th>
                  <th>Quantity</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {cart.map((item) => (
                  <tr key={item.product.id}>
                    <td>{item.product.name}</td>
                    <td>{settings?.currency || "KES"} {item.product.price.toFixed(2)}</td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(event) => updateQuantity(item.product.id, Number(event.target.value))}
                      />
                    </td>
                    <td>{settings?.currency || "KES"} {(item.quantity * item.product.price).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="small" style={{ marginTop: "1rem" }}>
              <strong>Total: {settings?.currency || "KES"} {cartTotal.toFixed(2)}</strong>
            </p>
          </div>
        )}
        <div className="actions" style={{ marginTop: "1rem" }}>
          <div className="field" style={{ marginBottom: "1rem" }}>
            <label htmlFor="customer_ref">Customer Reference (optional)</label>
            <input
              id="customer_ref"
              type="text"
              value={customerRef}
              onChange={(e) => setCustomerRef(e.target.value)}
              placeholder="Customer name or reference"
            />
          </div>
          <div className="field" style={{ marginBottom: "1rem" }}>
            <label htmlFor="sale_notes">Notes (optional)</label>
            <textarea
              id="sale_notes"
              value={saleNotes}
              onChange={(e) => setSaleNotes(e.target.value)}
              placeholder="Additional notes for this sale"
              rows={2}
            />
          </div>
          <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
            {settings?.enable_cash && <option value="cash">Cash</option>}
            {settings?.enable_mpesa && <option value="mpesa">M-Pesa</option>}
          </select>
          <button type="button" className="primary" onClick={handleCreateSale}>
            Create Sale
          </button>
        </div>
      </section>

      {sale && (
        <section className="card">
          <h2>Sale #{sale.id}</h2>
          <p className="small">Status: {sale.status}</p>
          <p className="small">Payment method: {sale.payment_method}</p>
          <p className="small">Total: {settings?.currency || "KES"} {sale.total_amount.toFixed(2)}</p>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Price</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {sale.items?.map((item) => (
                  <tr key={item.id}>
                    <td>{item.product_name}</td>
                    <td>{item.quantity}</td>
                    <td>{settings?.currency || "KES"} {item.price.toFixed(2)}</td>
                    <td>{settings?.currency || "KES"} {item.subtotal.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sale.payment_method === "cash" && sale.status !== "completed" && (
            <button type="button" className="primary" onClick={handleCashPayment} style={{ marginTop: "1rem" }}>
              Complete Cash Payment
            </button>
          )}
          {sale.payment_method === "mpesa" && sale.status !== "completed" && (
            <div style={{ marginTop: "1rem" }}>
              <div className="field">
                <label htmlFor="phone">Customer Phone</label>
                <input
                  id="phone"
                  placeholder="07XXXXXXXX"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                />
              </div>
              <button type="button" className="primary" onClick={handleMpesaPayment} style={{ marginTop: "0.75rem" }}>
                Initiate M-Pesa Payment
              </button>
            </div>
          )}
          {sale.payment && (
            <div className="banner" style={{ marginTop: "1rem" }}>
              <p>
                Payment status: <strong>{sale.payment.status}</strong>
              </p>
              {sale.payment.mpesa_receipt_number && <p>Receipt: {sale.payment.mpesa_receipt_number}</p>}
            </div>
          )}
        </section>
      )}

      <section className="card" style={{ marginTop: "1.5rem" }}>
        <h2>
          Sales History
          <button
            type="button"
            className="primary"
            onClick={() => {
              setShowHistory(!showHistory);
              if (!showHistory && salesHistory.length === 0) fetchSalesHistory();
            }}
            style={{ marginLeft: "1rem" }}
          >
            {showHistory ? "Hide" : "Show"} History
          </button>
        </h2>

        {showHistory && (
          <>
            <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
              <div className="field" style={{ flex: "1", minWidth: "200px" }}>
                <label htmlFor="search">Search (ID or Customer Ref)</label>
                <input
                  id="search"
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search sales..."
                />
              </div>
              <div className="field" style={{ flex: "1", minWidth: "150px" }}>
                <label htmlFor="status">Status</label>
                <select id="status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {loading ? (
              <p>Loading sales history...</p>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Date</th>
                      <th>Cashier</th>
                      <th>Customer</th>
                      <th>Payment</th>
                      <th>Status</th>
                      <th>Total</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.map((histSale) => (
                      <tr key={histSale.id}>
                        <td>{histSale.id}</td>
                        <td>{new Date(histSale.timestamp).toLocaleDateString()}</td>
                        <td>{histSale.cashier_name || "Unknown"}</td>
                        <td>{histSale.customer_ref || "-"}</td>
                        <td>{histSale.payment_method}</td>
                        <td>{histSale.status}</td>
                        <td>{settings?.currency || "KES"} {histSale.total_amount.toFixed(2)}</td>
                        <td>
                          {histSale.status === "completed" && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedSale(histSale);
                                  setShowRefundModal(true);
                                }}
                                style={{ marginRight: "0.5rem" }}
                              >
                                Refund
                              </button>
                              <button onClick={() => handleGetReceipt(histSale.id)}>Receipt</button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      {showRefundModal && selectedSale && (
        <div className="modal-overlay" onClick={() => setShowRefundModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Refund Sale #{selectedSale.id}</h2>
            <p>Original total: KES {selectedSale.total_amount.toFixed(2)}</p>
            <div className="field">
              <label htmlFor="refund_amount">Refund Amount (leave empty for full refund)</label>
              <input
                id="refund_amount"
                type="number"
                step="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder="Full refund"
              />
            </div>
            <div className="field">
              <label htmlFor="refund_reason">Reason</label>
              <input
                id="refund_reason"
                type="text"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Reason for refund"
              />
            </div>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button onClick={() => setShowRefundModal(false)}>Cancel</button>
              <button className="primary" onClick={handleRefund}>Process Refund</button>
            </div>
          </div>
        </div>
      )}

      {showReceiptModal && receipt && (
        <div className="modal-overlay" onClick={() => setShowReceiptModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Receipt - Sale #{receipt.sale_id}</h2>
            <div style={{ textAlign: "left", fontFamily: "monospace" }}>
              <p><strong>Date:</strong> {new Date(receipt.timestamp).toLocaleString()}</p>
              <p><strong>Customer:</strong> {receipt.customer_ref || "N/A"}</p>
              <p><strong>Cashier:</strong> {receipt.cashier_name}</p>
              <p><strong>Payment:</strong> {receipt.payment_method}</p>
              {receipt.receipt_number && <p><strong>Receipt #:</strong> {receipt.receipt_number}</p>}
              <hr />
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>Item</th>
                    <th style={{ textAlign: "right", borderBottom: "1px solid #ccc" }}>Qty</th>
                    <th style={{ textAlign: "right", borderBottom: "1px solid #ccc" }}>Price</th>
                    <th style={{ textAlign: "right", borderBottom: "1px solid #ccc" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {receipt.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.product_name}</td>
                      <td style={{ textAlign: "right" }}>{item.quantity}</td>
                      <td style={{ textAlign: "right" }}>{settings?.currency || "KES"} {item.price.toFixed(2)}</td>
                      <td style={{ textAlign: "right" }}>{settings?.currency || "KES"} {item.subtotal.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <hr />
              <p style={{ textAlign: "right", fontSize: "1.2em" }}>
                <strong>Total: {settings?.currency || "KES"} {receipt.total_amount.toFixed(2)}</strong>
              </p>
              {receipt.notes && (
                <p><strong>Notes:</strong> {receipt.notes}</p>
              )}
            </div>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1rem" }}>
              <button onClick={() => window.print()}>Print</button>
              <button onClick={() => setShowReceiptModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
