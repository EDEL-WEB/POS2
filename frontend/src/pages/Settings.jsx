import { useEffect, useState } from "react";
import { authRequest } from "../api";

export default function Settings() {
  const [settings, setSettings] = useState({
    business_name: "",
    business_address: "",
    tax_rate: 0,
    currency: "KES",
    receipt_footer: "",
    low_stock_threshold: 5,
    enable_mpesa: true,
    enable_cash: true,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await authRequest("/settings", { method: "GET" });
      setSettings(data);
    } catch (err) {
      // If settings don't exist yet, use defaults
      if (err.message.includes("404")) {
        setMessage("Using default settings. Save to create.");
      } else {
        setError(err.message || "Unable to load settings");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const data = await authRequest("/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      setSettings(data);
      setMessage("Settings saved successfully!");
    } catch (err) {
      setError(err.message || "Unable to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return <div className="card"><p>Loading settings...</p></div>;
  }

  return (
    <div className="card">
      <h1 className="heading">System Settings</h1>
      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert error">{error}</div>}

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2>Business Information</h2>
        <div className="field">
          <label htmlFor="business_name">Business Name</label>
          <input
            id="business_name"
            type="text"
            value={settings.business_name}
            onChange={(e) => handleInputChange("business_name", e.target.value)}
            placeholder="Your Business Name"
          />
        </div>
        <div className="field">
          <label htmlFor="business_address">Business Address</label>
          <textarea
            id="business_address"
            value={settings.business_address}
            onChange={(e) => handleInputChange("business_address", e.target.value)}
            placeholder="Business address"
            rows={3}
          />
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2>Financial Settings</h2>
        <div className="field">
          <label htmlFor="tax_rate">Tax Rate (%)</label>
          <input
            id="tax_rate"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={settings.tax_rate}
            onChange={(e) => handleInputChange("tax_rate", parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className="field">
          <label htmlFor="currency">Currency</label>
          <select
            id="currency"
            value={settings.currency}
            onChange={(e) => handleInputChange("currency", e.target.value)}
          >
            <option value="KES">KES (Kenyan Shilling)</option>
            <option value="USD">USD (US Dollar)</option>
            <option value="EUR">EUR (Euro)</option>
            <option value="GBP">GBP (British Pound)</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2>Receipt Settings</h2>
        <div className="field">
          <label htmlFor="receipt_footer">Receipt Footer Text</label>
          <textarea
            id="receipt_footer"
            value={settings.receipt_footer}
            onChange={(e) => handleInputChange("receipt_footer", e.target.value)}
            placeholder="Thank you for your business!"
            rows={2}
          />
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2>Inventory Settings</h2>
        <div className="field">
          <label htmlFor="low_stock_threshold">Low Stock Threshold</label>
          <input
            id="low_stock_threshold"
            type="number"
            min="0"
            value={settings.low_stock_threshold}
            onChange={(e) => handleInputChange("low_stock_threshold", parseInt(e.target.value) || 0)}
          />
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2>Payment Methods</h2>
        <div className="field">
          <label>
            <input
              type="checkbox"
              checked={settings.enable_cash}
              onChange={(e) => handleInputChange("enable_cash", e.target.checked)}
            />
            Enable Cash Payments
          </label>
        </div>
        <div className="field">
          <label>
            <input
              type="checkbox"
              checked={settings.enable_mpesa}
              onChange={(e) => handleInputChange("enable_mpesa", e.target.checked)}
            />
            Enable M-Pesa Payments
          </label>
        </div>
      </div>

      <div className="actions">
        <button
          type="button"
          className="primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}