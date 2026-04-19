import { useEffect, useState } from "react";
import { authRequest } from "../api";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({ name: "", email: "", password: "" });
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await authRequest("/auth/users", { method: "GET" });
      setUsers(data || []);
    } catch (err) {
      setError(err.message || "Unable to load cashiers");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCashier = async () => {
    if (!formData.name || !formData.email || !formData.password) {
      setError("All fields are required");
      return;
    }
    setError("");
    try {
      const result = await authRequest("/auth/users", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      setMessage(result.message || "Cashier created successfully");
      setFormData({ name: "", email: "", password: "" });
      setShowCreateModal(false);
      fetchUsers();
    } catch (err) {
      setError(err.message || "Unable to create cashier");
    }
  };

  const handleEditCashier = async () => {
    if (!selectedUser) return;
    if (!formData.name || !formData.email) {
      setError("Name and email are required");
      return;
    }
    setError("");
    try {
      const result = await authRequest(`/auth/users/${selectedUser.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: formData.name, email: formData.email }),
      });
      setMessage(result.message || "Cashier updated successfully");
      setShowEditModal(false);
      setSelectedUser(null);
      setFormData({ name: "", email: "", password: "" });
      fetchUsers();
    } catch (err) {
      setError(err.message || "Unable to update cashier");
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser || !formData.password) {
      setError("Password is required");
      return;
    }
    setError("");
    try {
      const result = await authRequest(`/auth/users/${selectedUser.id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ password: formData.password }),
      });
      setMessage(result.message || "Password reset successfully");
      setShowResetModal(false);
      setSelectedUser(null);
      setFormData({ name: "", email: "", password: "" });
      fetchUsers();
    } catch (err) {
      setError(err.message || "Unable to reset password");
    }
  };

  const handleDeleteCashier = async (userId) => {
    setError("");
    try {
      const result = await authRequest(`/auth/users/${userId}`, { method: "DELETE" });
      setMessage(result.message || "Cashier deleted successfully");
      setConfirmDelete(null);
      fetchUsers();
    } catch (err) {
      setError(err.message || "Unable to delete cashier");
    }
  };

  const updateStatus = async (userId, status) => {
    setError("");
    setMessage("");
    try {
      const result = await authRequest(`/auth/users/${userId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setMessage(result.message || "Status updated");
      fetchUsers();
    } catch (err) {
      setError(err.message || "Unable to update cashier status");
    }
  };

  const openCreateModal = () => {
    setFormData({ name: "", email: "", password: "" });
    setError("");
    setShowCreateModal(true);
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setFormData({ name: user.name, email: user.email, password: "" });
    setError("");
    setShowEditModal(true);
  };

  const openResetModal = (user) => {
    setSelectedUser(user);
    setFormData({ name: "", email: "", password: "" });
    setError("");
    setShowResetModal(true);
  };

  return (
    <div className="card">
      <h1 className="heading">Cashier Management</h1>
      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert error">{error}</div>}

      <div style={{ marginBottom: "1.5rem" }}>
        <button type="button" className="primary" onClick={openCreateModal}>
          ➕ Add New Cashier
        </button>
      </div>

      {loading ? (
        <p>Loading cashiers…</p>
      ) : users.length === 0 ? (
        <p className="small">No cashiers yet. Click "Add New Cashier" to create one.</p>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>
                    <span style={{
                      padding: "0.25rem 0.5rem",
                      borderRadius: "4px",
                      fontSize: "0.85rem",
                      backgroundColor: user.status === "active" ? "#d4edda" : "#f8d7da",
                      color: user.status === "active" ? "#155724" : "#721c24",
                    }}>
                      {user.status}
                    </span>
                  </td>
                  <td>{new Date(user.created_at).toLocaleDateString()}</td>
                  <td className="actions" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="primary"
                      onClick={() => openEditModal(user)}
                      style={{ fontSize: "0.85rem", padding: "0.35rem 0.7rem" }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="primary"
                      onClick={() => openResetModal(user)}
                      style={{ fontSize: "0.85rem", padding: "0.35rem 0.7rem" }}
                    >
                      Reset Pass
                    </button>
                    {user.status === "active" && (
                      <button
                        type="button"
                        className="danger"
                        onClick={() => updateStatus(user.id, "inactive")}
                        style={{ fontSize: "0.85rem", padding: "0.35rem 0.7rem" }}
                      >
                        Deactivate
                      </button>
                    )}
                    {user.status === "inactive" && (
                      <button
                        type="button"
                        className="primary"
                        onClick={() => updateStatus(user.id, "active")}
                        style={{ fontSize: "0.85rem", padding: "0.35rem 0.7rem" }}
                      >
                        Activate
                      </button>
                    )}
                    {confirmDelete === user.id ? (
                      <>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => handleDeleteCashier(user.id)}
                          style={{ fontSize: "0.75rem", padding: "0.3rem 0.5rem" }}
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => setConfirmDelete(null)}
                          style={{ fontSize: "0.75rem", padding: "0.3rem 0.5rem" }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="danger"
                        onClick={() => setConfirmDelete(user.id)}
                        style={{ fontSize: "0.85rem", padding: "0.35rem 0.7rem" }}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: "white",
            padding: "2rem",
            borderRadius: "8px",
            maxWidth: "500px",
            width: "90%",
          }}>
            <h2>Add New Cashier</h2>
            <div className="field">
              <label htmlFor="create_name">Name</label>
              <input
                id="create_name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Full name"
              />
            </div>
            <div className="field">
              <label htmlFor="create_email">Email</label>
              <input
                id="create_email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Email address"
              />
            </div>
            <div className="field">
              <label htmlFor="create_password">Password</label>
              <input
                id="create_password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Strong password (8+ chars, uppercase, lowercase, number, special char)"
              />
            </div>
            <div className="actions" style={{ marginTop: "1.5rem" }}>
              <button type="button" className="primary" onClick={handleCreateCashier}>
                Create Cashier
              </button>
              <button type="button" className="secondary" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: "white",
            padding: "2rem",
            borderRadius: "8px",
            maxWidth: "500px",
            width: "90%",
          }}>
            <h2>Edit Cashier</h2>
            <div className="field">
              <label htmlFor="edit_name">Name</label>
              <input
                id="edit_name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="edit_email">Email</label>
              <input
                id="edit_email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="actions" style={{ marginTop: "1.5rem" }}>
              <button type="button" className="primary" onClick={handleEditCashier}>
                Save Changes
              </button>
              <button type="button" className="secondary" onClick={() => setShowEditModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: "white",
            padding: "2rem",
            borderRadius: "8px",
            maxWidth: "500px",
            width: "90%",
          }}>
            <h2>Reset Password for {selectedUser?.name}</h2>
            <p className="small">Set a new password for this cashier.</p>
            <div className="field">
              <label htmlFor="reset_password">New Password</label>
              <input
                id="reset_password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Strong password"
              />
            </div>
            <div className="actions" style={{ marginTop: "1.5rem" }}>
              <button type="button" className="primary" onClick={handleResetPassword}>
                Reset Password
              </button>
              <button type="button" className="secondary" onClick={() => setShowResetModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
