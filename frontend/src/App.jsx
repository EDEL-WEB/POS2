import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import Nav from "./components/Nav";
import ProtectedRoute from "./components/ProtectedRoute";
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Bootstrap from "./pages/Bootstrap";
import Homepage from "./pages/Homepage";
import Products from "./pages/Products";
import Sales from "./pages/Sales";
import Reports from "./pages/Reports";
import Inventory from "./pages/Inventory";
import Settings from "./pages/Settings";
import Users from "./pages/Users";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

export default function App() {
  const { user } = useAuth();
  const publicPages = ['/', '/login', '/register', '/bootstrap'];
  const isPublicPage = publicPages.includes(window.location.pathname);

  return (
    <div className="app-shell">
      {!isPublicPage && <Nav />}
      <main className="page-content">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/bootstrap" element={<Bootstrap />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Homepage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/products"
            element={
              <ProtectedRoute>
                <Products />
              </ProtectedRoute>
            }
          />
          <Route
            path="/sales"
            element={
              <ProtectedRoute>
                <Sales />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <Reports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/daily"
            element={
              <ProtectedRoute>
                <Reports defaultReportType="daily" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/weekly"
            element={
              <ProtectedRoute>
                <Reports defaultReportType="weekly" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/monthly"
            element={
              <ProtectedRoute>
                <Reports defaultReportType="monthly" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/cashflow"
            element={
              <ProtectedRoute>
                <Reports defaultReportType="cashflow" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/top-products"
            element={
              <ProtectedRoute>
                <Reports defaultReportType="top-products" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventory"
            element={
              <ProtectedRoute>
                <Inventory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <Users />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}
