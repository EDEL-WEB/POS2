import { useEffect, useMemo, useState } from "react";
import { authRequest } from "../api";
import { useAuth } from "../AuthProvider";

export default function Products() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchText, setSearchText] = useState("");
  const [newProduct, setNewProduct] = useState({ name: "", price: "", stock_quantity: "" });
  const [editingId, setEditingId] = useState(null);
  const [editFields, setEditFields] = useState({ price: "", stock_quantity: "" });
  const [settings, setSettings] = useState(null);

  const filteredProducts = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) {
      return products;
    }
    return products.filter((product) => product.name.toLowerCase().includes(query));
  }, [products, searchText]);

  const lowStockCount = products.filter((product) => product.stock_quantity <= 5).length;

  useEffect(() => {
    fetchProducts();
    fetchSettings();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    setError("");
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
    } catch (err) {
      // Use defaults if settings don't exist
      setSettings({ currency: "KES" });
    }
  };

  const handleAdd = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    try {
      await authRequest("/products", {
        method: "POST",
        body: JSON.stringify({
          name: newProduct.name,
          price: Number(newProduct.price),
          stock_quantity: Number(newProduct.stock_quantity),
        }),
      });
      setSuccess("Product added successfully.");
      setNewProduct({ name: "", price: "", stock_quantity: "" });
      fetchProducts();
    } catch (err) {
      setError(err.message || "Unable to add product");
    }
  };

  const startEdit = (product) => {
    setEditingId(product.id);
    setEditFields({ price: product.price, stock_quantity: product.stock_quantity });
    setSuccess("");
    setError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditFields({ price: "", stock_quantity: "" });
  };

  const saveEdit = async (productId) => {
    setError("");
    setSuccess("");
    try {
      await authRequest(`/products/${productId}`, {
        method: "PATCH",
        body: JSON.stringify({
          price: Number(editFields.price),
          stock_quantity: Number(editFields.stock_quantity),
        }),
      });
      setSuccess("Product updated successfully.");
      setEditingId(null);
      fetchProducts();
    } catch (err) {
      setError(err.message || "Unable to update product");
    }
  };

  const handleDelete = async (productId) => {
    setError("");
    setSuccess("");
    if (!window.confirm("Delete this product?")) {
      return;
    }
    try {
      await authRequest(`/products/${productId}`, { method: "DELETE" });
      setSuccess("Product deleted.");
      fetchProducts();
    } catch (err) {
      setError(err.message || "Unable to delete product");
    }
  };

  return (
    <div className="card">
      <h1 className="heading">Products</h1>
      {success && <div className="alert success">{success}</div>}
      {error && <div className="alert error">{error}</div>}
      <div className="field" style={{ maxWidth: "34rem", marginBottom: "1rem" }}>
        <label htmlFor="product_search">Search products</label>
        <input
          id="product_search"
          type="search"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Search by product name..."
        />
        <p className="small">{filteredProducts.length} matching product(s){lowStockCount > 0 ? ` · ${lowStockCount} low stock` : ""}</p>
      </div>
      {user.role === "owner" && (
        <section className="card" style={{ marginBottom: "1.5rem" }}>
          <h2>Add New Product</h2>
          <form className="grid grid-cols-2" onSubmit={handleAdd}>
            <div className="field">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                value={newProduct.name}
                onChange={(event) => setNewProduct({ ...newProduct, name: event.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="price">Price</label>
              <input
                id="price"
                type="number"
                step="0.01"
                value={newProduct.price}
                onChange={(event) => setNewProduct({ ...newProduct, price: event.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="stock_quantity">Stock Quantity</label>
              <input
                id="stock_quantity"
                type="number"
                value={newProduct.stock_quantity}
                onChange={(event) => setNewProduct({ ...newProduct, stock_quantity: event.target.value })}
                required
              />
            </div>
            <div className="actions" style={{ alignItems: "flex-end" }}>
              <button type="submit" className="primary">
                Add Product
              </button>
            </div>
          </form>
        </section>
      )}

      <div className="table-wrapper">
        {loading ? (
          <p>Loading products...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Price</th>
                <th>Stock</th>
                {user.role === "owner" && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td>
                    {editingId === product.id ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editFields.price}
                        onChange={(event) => setEditFields({ ...editFields, price: event.target.value })}
                      />
                    ) : (
                      `${settings?.currency || "KES"} ${product.price.toFixed(2)}`
                    )}
                  </td>
                  <td>
                    {editingId === product.id ? (
                      <input
                        type="number"
                        value={editFields.stock_quantity}
                        onChange={(event) => setEditFields({ ...editFields, stock_quantity: event.target.value })}
                      />
                    ) : (
                      product.stock_quantity
                    )}
                  </td>
                  {user.role === "owner" && (
                    <td className="actions">
                      {editingId === product.id ? (
                        <>
                          <button type="button" className="primary" onClick={() => saveEdit(product.id)}>
                            Save
                          </button>
                          <button type="button" className="secondary" onClick={cancelEdit}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="secondary" onClick={() => startEdit(product)}>
                            Edit
                          </button>
                          <button type="button" className="danger" onClick={() => handleDelete(product.id)}>
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
