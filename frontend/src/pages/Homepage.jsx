import { useEffect, useState } from "react";
import { authRequest } from "../api";
import { useAuth } from "../AuthProvider";

export default function Homepage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState(null);
  const [cart, setCart] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [dailyReport, productsData, recentSalesData, lowStockData, settingsData] = await Promise.all([
        authRequest("/reports/daily", { method: "GET" }),
        authRequest("/products", { method: "GET" }),
        authRequest("/sales?limit=5", { method: "GET" }),
        authRequest("/products/low-stock", { method: "GET" }),
        authRequest("/settings", { method: "GET" }).catch(() => ({ currency: "KES" })),
      ]);

      setStats(dailyReport);
      setProducts(productsData);
      setRecentSales(recentSalesData.slice(0, 5));
      setLowStockProducts(lowStockData);
      setSettings(settingsData);
    } catch (err) {
      setError(err.message || "Unable to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product) => {
    setCart(current => {
      const existing = current.find(item => item.id === product.id);
      if (existing) {
        return current.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...current, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId) => {
    setCart(current => current.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(productId);
    } else {
      setCart(current =>
        current.map(item =>
          item.id === productId ? { ...item, quantity } : item
        )
      );
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const formatCurrency = (amount) => {
    return `${settings?.currency || "KES"} ${amount?.toFixed(2) || "0.00"}`;
  };

  const getCurrentTime = () => {
    return new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  };

  if (loading) {
    return (
      <div className="homepage-container">
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="homepage-container">
      {/* Welcome Header */}
      <div className="homepage-header">
        <div className="header-left">
          <h1>Welcome back, {user?.name}! 👋</h1>
          <p>Here's what's happening with your {settings?.business_name || "perfume store"} today.</p>
        </div>
        <div className="header-right">
          <p className="current-time">{getCurrentTime()}</p>
        </div>
      </div>

      {error && <div className="alert error" style={{ marginBottom: "1rem" }}>{error}</div>}

      {/* Quick Stats Cards */}
      <div className="homepage-stats">
        <div className="stat-item">
          <div className="stat-icon">💰</div>
          <div className="stat-info">
            <h3>TODAY'S SALES</h3>
            <p className="stat-number">{formatCurrency(stats?.total_revenue)}</p>
            <small>↑ 8.5% vs yesterday</small>
          </div>
        </div>
        <div className="stat-item">
          <div className="stat-icon">📦</div>
          <div className="stat-info">
            <h3>STOCK ITEMS</h3>
            <p className="stat-number">{products?.length || 0}</p>
            <small>{lowStockProducts?.length || 0} Low Stock</small>
          </div>
        </div>
        <div className="stat-item">
          <div className="stat-icon">🧾</div>
          <div className="stat-info">
            <h3>ORDERS</h3>
            <p className="stat-number">{stats?.total_sales || 0}</p>
            <small>⏳ Pending: {recentSales.filter(s => s.status === 'pending').length}</small>
          </div>
        </div>
        <div className="stat-item">
          <div className="stat-icon">👥</div>
          <div className="stat-info">
            <h3>CUSTOMERS</h3>
            <p className="stat-number">{recentSales.length}</p>
            <small>↑ 3 New</small>
          </div>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="quick-actions">
        <a href="/sales" className="action-btn">
          <div className="action-icon">🛒</div>
          <div className="action-text">
            <h4>New Sale</h4>
            <p>Start a transaction</p>
          </div>
        </a>
        <div className="action-btn" style={{ cursor: "pointer" }}>
          <div className="action-icon">📦</div>
          <div className="action-text">
            <h4>Add Product</h4>
            <p>Update inventory</p>
          </div>
        </div>
        <a href="/reports" className="action-btn">
          <div className="action-icon">📊</div>
          <div className="action-text">
            <h4>View Reports</h4>
            <p>Sales & Analytics</p>
          </div>
        </a>
      </div>

      <div className="homepage-main">
        {/* Products Section */}
        <div className="products-section">
          <div className="section-header">
            <h2>Popular Products</h2>
            <a href="/products" className="view-all">View All Products →</a>
          </div>

          {products.length > 0 ? (
            <div className="product-grid">
              {products.slice(0, 6).map(product => (
                <div key={product.id} className="product-card">
                  <div className="product-image">
                    <div className="product-placeholder">🧴</div>
                  </div>
                  <h3>{product.name}</h3>
                  <p className="product-price">{formatCurrency(product.price)}</p>
                  <p className={`stock-status ${product.stock_quantity <= 5 ? 'low' : 'in-stock'}`}>
                    {product.stock_quantity <= 5 ? '⚠️ Low Stock' : '✓ In Stock'} ({product.stock_quantity})
                  </p>
                  <button 
                    className="add-cart-btn"
                    onClick={() => addToCart(product)}
                  >
                    🛒 Add to Cart
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-data">No products available</p>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="homepage-sidebar">
          {/* Cart */}
          <div className="cart-widget">
            <div className="widget-header">
              <h3>Cart ({cart.length})</h3>
              {cart.length > 0 && (
                <button onClick={() => setCart([])} className="clear-btn">Clear All</button>
              )}
            </div>

            {cart.length > 0 ? (
              <>
                <div className="cart-items">
                  {cart.map(item => (
                    <div key={item.id} className="cart-item">
                      <div className="item-info">
                        <strong>{item.name}</strong>
                        <small>{formatCurrency(item.price)}</small>
                      </div>
                      <div className="item-controls">
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)}>−</button>
                        <span>{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
                      </div>
                      <div className="item-price">
                        {formatCurrency(item.price * item.quantity)}
                      </div>
                      <button 
                        className="remove-btn"
                        onClick={() => removeFromCart(item.id)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <div className="cart-summary">
                  <div className="summary-row">
                    <span>Subtotal</span>
                    <span>{formatCurrency(cartTotal)}</span>
                  </div>
                  <div className="summary-row">
                    <span>Discount</span>
                    <span>0.00</span>
                  </div>
                  <div className="summary-total">
                    <span>Total</span>
                    <span className="total-amount">{formatCurrency(cartTotal)}</span>
                  </div>
                  <a href="/sales" className="checkout-btn">🔒 Proceed to Checkout</a>
                </div>
              </>
            ) : (
              <p className="empty-cart">Your cart is empty</p>
            )}
          </div>

          {/* Low Stock Alerts */}
          <div className="alerts-widget">
            <div className="widget-header">
              <h3>📍 Low Stock Alerts</h3>
              <a href="#" className="view-all-small">View All</a>
            </div>
            {lowStockProducts.length > 0 ? (
              <div className="alerts-list">
                {lowStockProducts.slice(0, 3).map(product => (
                  <div key={product.id} className="alert-item">
                    <div className="alert-info">
                      <p className="alert-name">• {product.name}</p>
                      <small className="stock-left">{product.stock_quantity} left</small>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-alerts">All stock levels are healthy</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}