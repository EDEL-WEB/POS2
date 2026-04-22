import { Navigate } from "react-router-dom";
import { useAuth } from "../AuthProvider";

export default function ProtectedRoute({ children, ownerOnly = false }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (ownerOnly && user.role !== "owner") return <Navigate to="/dashboard" replace />;
  return children;
}
