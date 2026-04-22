import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthProvider";

export default function Nav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const cls = ({ isActive }) => "nav-link" + (isActive ? " active" : "");

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <img src="/logo.jpeg" alt="Spark Perfumes" className="nav-logo" />
        Spark Perfumes
      </div>
      <div className="navbar-links">
        <NavLink className={cls} to="/dashboard">Dashboard</NavLink>
        <NavLink className={cls} to="/products">Products</NavLink>
        <NavLink className={cls} to="/sales">Sales</NavLink>
        <NavLink className={cls} to="/receipts">Receipts</NavLink>
        <NavLink className={cls} to="/reports">Reports</NavLink>
        {user?.role === "owner" && (
          <>
            <NavLink className={cls} to="/inventory">Inventory</NavLink>
            <NavLink className={cls} to="/reconciliation">Reconciliation</NavLink>
            <NavLink className={cls} to="/users">Users</NavLink>
          </>
        )}
        <NavLink className={cls} to="/profile">Profile</NavLink>
        <button className="btn btn-outline btn-sm" onClick={handleLogout}>Logout</button>
      </div>
    </nav>
  );
}
