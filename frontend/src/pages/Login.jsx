import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../AuthProvider";

export default function Login() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  const handle = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await login(form);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <img src="/logo.jpeg" alt="Spark Perfumes" className="auth-logo" />
        <h1 className="auth-title">Spark Perfumes</h1>
        <h2>Sign In</h2>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handle} className="form">
          <label>Email</label>
          <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          <label>Password</label>
          <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
          <button className="btn btn-primary" disabled={loading}>{loading ? "Signing in…" : "Sign In"}</button>
        </form>
        <p className="auth-footer">
          No account? <Link to="/register">Register</Link> · <Link to="/bootstrap">Setup owner</Link>
        </p>
      </div>
    </div>
  );
}
