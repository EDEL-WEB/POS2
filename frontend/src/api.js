const BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000";

const get = (key) => localStorage.getItem(key);
const set = (key, val) => localStorage.setItem(key, val);
const del = (key) => localStorage.removeItem(key);

export const getStoredUser = () => {
  const u = get("pos_user");
  return u ? JSON.parse(u) : null;
};

export const saveAuthData = ({ access_token, refresh_token, user }) => {
  set("pos_access", access_token);
  set("pos_refresh", refresh_token);
  set("pos_user", JSON.stringify(user));
};

export const clearAuthData = () => {
  del("pos_access");
  del("pos_refresh");
  del("pos_user");
};

async function parseJson(res) {
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

async function attemptRefresh() {
  const token = get("pos_refresh");
  if (!token) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    const data = await parseJson(res);
    if (!res.ok) { clearAuthData(); return false; }
    saveAuthData(data);
    return true;
  } catch {
    clearAuthData();
    return false;
  }
}

export async function api(path, options = {}) {
  const token = get("pos_access");
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  let res;
  try {
    res = await fetch(`${BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error("Cannot reach server. Is the backend running?");
  }

  const data = await parseJson(res);

  if (res.status === 401) {
    const refreshed = await attemptRefresh();
    if (refreshed) return api(path, options);
  }

  if (!res.ok) {
    const err = new Error(data?.error || res.statusText || "Request failed");
    err.status = res.status;
    throw err;
  }
  return data;
}

export const get_ = (path) => api(path, { method: "GET" });
export const post = (path, body) => api(path, { method: "POST", body: JSON.stringify(body) });
export const patch = (path, body) => api(path, { method: "PATCH", body: JSON.stringify(body) });
export const del_ = (path) => api(path, { method: "DELETE" });
export const put = (path, body) => api(path, { method: "PUT", body: JSON.stringify(body) });

// Auth helpers (no token needed)
export const loginUser = (body) =>
  fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(async (res) => {
    const data = await parseJson(res);
    if (!res.ok) { const e = new Error(data?.error || "Login failed"); e.status = res.status; e.payload = data; throw e; }
    return data;
  });

export const registerUser = (body) =>
  fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(async (res) => {
    const data = await parseJson(res);
    if (!res.ok) { const e = new Error(data?.error || "Registration failed"); e.status = res.status; throw e; }
    return data;
  });

export const bootstrapOwner = (body) =>
  fetch(`${BASE}/auth/bootstrap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(async (res) => {
    const data = await parseJson(res);
    if (!res.ok) { const e = new Error(data?.error || "Bootstrap failed"); e.status = res.status; throw e; }
    return data;
  });
