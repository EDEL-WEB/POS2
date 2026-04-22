import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../AuthProvider";
import PasswordInput from "../components/PasswordInput";

export default function Register() {
  const { register, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handle = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    try {
      await register(form);
      setSuccess("Registered! Await owner approval before logging in.");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <img src="/logo.jpeg" alt="Spark Perfumes" className="auth-logo" />
        <h1 className="auth-title">Spark Perfumes</h1>
        <h2>Cashier Registration</h2>
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
        <form onSubmit={handle} className="form">
          <label>Name</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <label>Email</label>
          <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          <label>Password</label>
          <PasswordInput value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 8 chars, upper, lower, number, special" required />
          <button className="btn btn-primary" disabled={loading}>{loading ? "Registering…" : "Register"}</button>
        </form>
        <p className="auth-footer"><Link to="/login">Back to login</Link></p>
      </div>
    </div>
  );
}
