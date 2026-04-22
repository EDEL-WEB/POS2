import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../AuthProvider";

export default function Bootstrap() {
  const { bootstrap, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");

  const handle = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await bootstrap(form);
      navigate("/login");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <img src="/logo.jpeg" alt="Spark Perfumes" className="auth-logo" />
        <h1 className="auth-title">Spark Perfumes</h1>
        <h2>Create Owner Account</h2>
        <p style={{ color: "var(--muted)", marginBottom: "1rem", fontSize: "0.9rem" }}>
          First-time setup only. Returns 403 if an owner already exists.
        </p>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handle} className="form">
          <label>Name</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <label>Email</label>
          <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          <label>Password</label>
          <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
          <button className="btn btn-primary" disabled={loading}>{loading ? "Creating…" : "Create Owner"}</button>
        </form>
        <p className="auth-footer"><Link to="/login">Back to login</Link></p>
      </div>
    </div>
  );
}
