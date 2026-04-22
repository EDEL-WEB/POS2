import { useState } from "react";
import { useAuth } from "../AuthProvider";
import { authApi } from "../api";
import PasswordInput from "../components/PasswordInput";

export default function Profile() {
  const { user } = useAuth();
  const [form, setForm] = useState({ current_password: "", new_password: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
    try {
      await authApi("/auth/change-password", { method: "POST", body: JSON.stringify(form) });
      setSuccess("Password updated successfully.");
      setForm({ current_password: "", new_password: "" });
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ maxWidth: "480px" }}>
      <h1>My Profile</h1>
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <p><strong>Name:</strong> {user?.name}</p>
        <p><strong>Email:</strong> {user?.email}</p>
        <p><strong>Role:</strong> <span className={`badge badge-${user?.role}`}>{user?.role}</span></p>
        <p><strong>Status:</strong> <span className={`badge badge-${user?.status}`}>{user?.status}</span></p>
      </div>

      <h2>Change Password</h2>
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}
      <form onSubmit={handle} className="form">
        <label>Current Password</label>
        <PasswordInput value={form.current_password} onChange={e => setForm(f => ({ ...f, current_password: e.target.value }))} autoComplete="current-password" required />
        <label>New Password</label>
        <PasswordInput value={form.new_password} onChange={e => setForm(f => ({ ...f, new_password: e.target.value }))} autoComplete="new-password" required />
        <button className="btn btn-primary" disabled={loading}>{loading ? "Saving…" : "Update Password"}</button>
      </form>
    </div>
  );
}
