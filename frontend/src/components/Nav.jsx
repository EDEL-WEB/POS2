import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthProvider";
import { useTheme } from "../ThemeProvider";
import logo from "../pages/logo.jpeg";

const activeClass = "nav-link active";
const baseClass = "nav-link";

export default function Nav() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <nav className="nav-bar">
      <div className="nav-brand">
        <img src={logo} alt="Spark Perfumes" className="nav-logo" />
        <span>SPARK PERFUMES</span>
      </div>
      <div className="nav-links">
        {user ? (
          <>
            <NavLink className={({ isActive }) => (isActive ? activeClass : baseClass)} to="/dashboard">
              Dashboard
            </NavLink>
            <NavLink className={({ isActive }) => (isActive ? activeClass : baseClass)} to="/products">
              Products
            </NavLink>
            <NavLink className={({ isActive }) => (isActive ? activeClass : baseClass)} to="/sales">
              Sales
            </NavLink>
            <div className="nav-dropdown">
              <button type="button" className={baseClass}>
                Reports
              </button>
              <div className="dropdown-menu">
                <NavLink className={({ isActive }) => (isActive ? activeClass : baseClass)} to="/reports/daily">
                  Daily
                </NavLink>
                <NavLink className={({ isActive }) => (isActive ? activeClass : baseClass)} to="/reports/weekly">
                  Weekly
                </NavLink>
                <NavLink className={({ isActive }) => (isActive ? activeClass : baseClass)} to="/reports/monthly">
                  Monthly
                </NavLink>
                <NavLink className={({ isActive }) => (isActive ? activeClass : baseClass)} to="/reports/cashflow">
                  Cashflow
                </NavLink>
                <NavLink className={({ isActive }) => (isActive ? activeClass : baseClass)} to="/reports/top-products">
                  Top Products
                </NavLink>
              </div>
            </div>
            {user.role === "owner" && (
              <NavLink className={({ isActive }) => (isActive ? activeClass : baseClass)} to="/inventory">
                Inventory
              </NavLink>
            )}
            {user.role === "owner" && (
              <NavLink className={({ isActive }) => (isActive ? activeClass : baseClass)} to="/settings">
                Settings
              </NavLink>
            )}
            {user.role === "owner" && (
              <NavLink className={({ isActive }) => (isActive ? activeClass : baseClass)} to="/users">
                Cashiers
              </NavLink>
            )}
            <NavLink className={({ isActive }) => (isActive ? activeClass : baseClass)} to="/profile">
              Profile
            </NavLink>
            <button type="button" className="nav-button" onClick={toggleTheme}>
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <button type="button" className="nav-button" onClick={handleLogout}>
              Logout
            </button>
          </>
        ) : (
          <>
            <NavLink className={({ isActive }) => (isActive ? activeClass : baseClass)} to="/login">
              Login
            </NavLink>
            <NavLink className={({ isActive }) => (isActive ? activeClass : baseClass)} to="/register">
              Register
            </NavLink>
            <NavLink className={({ isActive }) => (isActive ? activeClass : baseClass)} to="/bootstrap">
              Bootstrap
            </NavLink>
          </>
        )}
      </div>
    </nav>
  );
}
