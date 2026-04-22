import { Routes, Route, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import Nav from "./components/Nav";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Bootstrap from "./pages/Bootstrap";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Sales from "./pages/Sales";
import Receipts from "./pages/Receipts";
import ReceiptView from "./pages/ReceiptView";
import Reports from "./pages/Reports";
import Inventory from "./pages/Inventory";
import Users from "./pages/Users";
import Profile from "./pages/Profile";
import Reconciliation from "./pages/Reconciliation";
import NotFound from "./pages/NotFound";

const PUBLIC = ["/", "/login", "/register", "/bootstrap"];

export default function App() {
  const { pathname } = useLocation();
  const isPublic = PUBLIC.includes(pathname);

  return (
    <div className="app-shell">
      {!isPublic && <Nav />}
      <main className={isPublic ? "" : "page-content"}>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/bootstrap" element={<Bootstrap />} />

          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
          <Route path="/sales" element={<ProtectedRoute><Sales /></ProtectedRoute>} />
          <Route path="/receipts" element={<ProtectedRoute><Receipts /></ProtectedRoute>} />
          <Route path="/receipts/:saleId" element={<ProtectedRoute><ReceiptView /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
          <Route path="/reconciliation" element={<ProtectedRoute><Reconciliation /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}
