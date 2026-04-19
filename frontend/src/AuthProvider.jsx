import { createContext, useContext, useEffect, useState } from "react";
import { getStoredUser, saveAuthData, clearAuthData, loginUser, registerUser, bootstrapOwner, logoutUser } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  const login = async (credentials) => {
    setLoading(true);
    try {
      const data = await loginUser(credentials);
      saveAuthData(data);
      setUser(data.user);
      return data;
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (payload) => {
    setLoading(true);
    try {
      return await registerUser(payload);
    } finally {
      setLoading(false);
    }
  };

  const bootstrap = async (payload) => {
    setLoading(true);
    try {
      return await bootstrapOwner(payload);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await logoutUser();
    } finally {
      clearAuthData();
      setUser(null);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, register, bootstrap, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
