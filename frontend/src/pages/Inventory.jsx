import { useEffect, useState } from "react";
import { authRequest } from "../api";

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [inventoryValue, setInventoryValue] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [adjustment, setAdjustment] = useState(0);
  const [reason, setReason] = useState("");
  const [importData, setImportData] = useState("");
  const [threshold, setThreshold] = useState(5);

  useEffect(() => {
    fetchInventoryData();
  }, []);

  const fetchInventoryData = async () => {
    setLoading(true);
    setError("");
    try {
      const [productsRes, lowStockRes, valueRes] = await Promise.all([
        authRequest("/products", { method: "GET" }),
        authRequest(`/products/low-stock?threshold=${threshold}`, { method: "GET" }),
        authRequest("/inventory/value", { method: "GET" }),
      ]);
      setProducts(productsRes);
      setLowStock(lowStockRes);
      setInventoryValue(valueRes);
    } catch (err) {
      setError(err.message || "Unable to load inventory data");
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustStock = async (productId) => {
    if (!adjustment) return;
    try {
      const data = await authRequest(`/products/${productId}/stock`, {
        method: "PATCH",
        body: JSON.stringify({ adjustment: parseInt(adjustment), reason }),
      });
      setProducts(products.map(p => p.id === productId ? data.product : p));
      setShowAdjustModal(false);
      setAdjustment(0);
      setReason("");
      setSelectedProduct(null);
      await fetchInventoryData(); // Refresh low stock and value
    } catch (err) {
      setError(err.message || "Unable to adjust stock");
    }
  };

  const handleBulkImport = async () => {
    try {
      let productsData;
      try {
        productsData = JSON.parse(importData);
      } catch {
        setError("Invalid JSON format");
        return;
      }
      const result = await authRequest("/products/bulk-import", {
        method: "POST",
        body: JSON.stringify({ products: productsData }),
      });
      setShowImportModal(false);
      setImportData("");
      if (result.imported > 0) {
        await fetchInventoryData();
      }
      alert(`Imported ${result.imported} products. Errors: ${result.errors.length}`);
    } catch (err) {
      setError(err.message || "Unable to import products");
    }
  };

  const handleThresholdChange = async (newThreshold) => {
    setThreshold(newThreshold);
    try {
      const data = await authRequest(`/products/low-stock?threshold=${newThreshold}`, { method: "GET" });
      setLowStock(data);
    } catch (err) {
      setError(err.message || "Unable to update low stock");
    }
  };

  return (
    <div className="card">
      <h1 className="heading">Inventory Management</h1>

      {error && <div className="alert error">{error}</div>}

      <div className="stat-grid" style={{ marginBottom: "1rem" }}>
        <div className="stat-card">
          <h3>Total Products</h3>
          <p>{inventoryValue?.total_products ?? 0}</p>
        </div>
        <div className="stat-card">
          <h3>Inventory Value</h3>
          <p>KES {inventoryValue?.total_value?.toFixed(2) ?? "0.00"}</p>
        </div>
        <div className="stat-card">
          <h3>Low Stock Items</h3>
          <p>{lowStock.length}</p>
        </div>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <button className="primary" onClick={() => setShowImportModal(true)}>Bulk Import</button>
      </div>

      {loading ? (
        <p>Loading inventory…</p>
      ) : (
        <>
          <div className="card" style={{ marginBottom: "1rem" }}>
            <h2>All Products</h2>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td>{product.name}</td>
                      <td>KES {product.price.toFixed(2)}</td>
                      <td>{product.stock_quantity}</td>
                      <td>
                        <button
                          onClick={() => {
                            setSelectedProduct(product);
                            setShowAdjustModal(true);
                          }}
                        >
                          Adjust Stock
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h2>
              Low Stock Products
              <div className="field" style={{ display: "inline-block", marginLeft: "1rem", maxWidth: "10rem" }}>
                <label htmlFor="threshold">Threshold:</label>
                <input
                  id="threshold"
                  type="number"
                  min="0"
                  value={threshold}
                  onChange={(e) => handleThresholdChange(parseInt(e.target.value))}
                />
              </div>
            </h2>
            {lowStock.length ? (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Price</th>
                      <th>Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStock.map((product) => (
                      <tr key={product.id}>
                        <td>{product.name}</td>
                        <td>KES {product.price.toFixed(2)}</td>
                        <td>{product.stock_quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="small">No products below threshold.</p>
            )}
          </div>
        </>
      )}

      {showAdjustModal && selectedProduct && (
        <div className="modal-overlay" onClick={() => setShowAdjustModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Adjust Stock: {selectedProduct.name}</h2>
            <div className="field">
              <label htmlFor="adjustment">Adjustment (positive to add, negative to subtract)</label>
              <input
                id="adjustment"
                type="number"
                value={adjustment}
                onChange={(e) => setAdjustment(e.target.value)}
                placeholder="e.g., 10 or -5"
              />
            </div>
            <div className="field">
              <label htmlFor="reason">Reason (optional)</label>
              <input
                id="reason"
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Restock, Damaged goods"
              />
            </div>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button onClick={() => setShowAdjustModal(false)}>Cancel</button>
              <button className="primary" onClick={() => handleAdjustStock(selectedProduct.id)}>Adjust</button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Bulk Import Products</h2>
            <p>Enter JSON array of products:</p>
            <textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              placeholder='[{"name": "Product 1", "price": 10.00, "stock_quantity": 100}, ...]'
              rows={10}
              style={{ width: "100%", fontFamily: "monospace" }}
            />
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1rem" }}>
              <button onClick={() => setShowImportModal(false)}>Cancel</button>
              <button className="primary" onClick={handleBulkImport}>Import</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}