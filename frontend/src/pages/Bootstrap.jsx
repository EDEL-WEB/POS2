import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthProvider";

export default function Bootstrap() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { bootstrap, loading } = useAuth();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      const result = await bootstrap({ name, email, password });
      setMessage(result.message || "Owner account created successfully.");
      setName("");
      setEmail("");
      setPassword("");
    } catch (err) {
      setError(err.message || "Unable to bootstrap owner account");
    }
  };

  return (
    <div className="card">
      <h1 className="heading">Bootstrap Owner</h1>
      <p className="small">Create the first owner account. This endpoint is disabled once an owner exists.</p>
      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert error">{error}</div>}
      <form onSubmit={handleSubmit} className="grid grid-cols-2">
        <div className="field">
          <label htmlFor="name">Owner Name</label>
          <input id="name" value={name} onChange={(event) => setName(event.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="email">Owner Email</label>
          <input id="email" value={email} type="email" onChange={(event) => setEmail(event.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </div>
        <div className="actions" style={{ marginTop: "1rem" }}>
          <button type="submit" className="primary" disabled={loading}>
            {loading ? "Creating..." : "Create Owner"}
          </button>
          <Link to="/login" className="secondary">
            Back to Login
          </Link>
        </div>
      </form>
    </div>
  );
}
