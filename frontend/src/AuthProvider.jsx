import { createContext, useContext, useState, useEffect } from "react";
import { getStoredUser, saveAuthData, clearAuthData, loginUser, registerUser, bootstrapOwner, api } from "./api";

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser);
  const [loading, setLoading] = useState(false);

  const login = async (creds) => {
    setLoading(true);
    try {
      const data = await loginUser(creds);
      saveAuthData(data);
      setUser(data.user);
      return data;
    } finally {
      setLoading(false);
    }
  };

  const register = async (payload) => {
    setLoading(true);
    try { return await registerUser(payload); }
    finally { setLoading(false); }
  };

  const bootstrap = async (payload) => {
    setLoading(true);
    try { return await bootstrapOwner(payload); }
    finally { setLoading(false); }
  };

  const logout = async () => {
    try { await api("/auth/logout", { method: "POST" }); } catch {}
    clearAuthData();
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, login, register, bootstrap, logout, loading }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};
