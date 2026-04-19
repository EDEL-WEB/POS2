import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthProvider";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { register, loading } = useAuth();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      const result = await register({ name, email, password });
      setMessage(result.message || "Registration successful. Await owner approval.");
      setName("");
      setEmail("");
      setPassword("");
    } catch (err) {
      setError(err.message || "Unable to register");
    }
  };

  return (
    <div className="form-container">
      <h1>Register</h1>
      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="name">Name</label>
          <input
            id="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="form-input"
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="form-input"
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="form-input"
            required
          />
        </div>
        <button type="submit" className="form-btn" disabled={loading}>
          {loading ? "Registering..." : "Register"}
        </button>
      </form>
      <p style={{ textAlign: 'center', marginTop: '1rem' }}>
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </div>
  );
}
