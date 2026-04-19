const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000";

function getStoredValue(key) {
  return typeof window !== "undefined" ? localStorage.getItem(key) : null;
}

function saveStoredValue(key, value) {
  if (typeof window !== "undefined") {
    localStorage.setItem(key, value);
  }
}

function removeStoredValue(key) {
  if (typeof window !== "undefined") {
    localStorage.removeItem(key);
  }
}

export function getStoredUser() {
  const user = getStoredValue("pos2_user");
  return user ? JSON.parse(user) : null;
}

export function saveAuthData({ access_token, refresh_token, user }) {
  saveStoredValue("pos2_access_token", access_token);
  saveStoredValue("pos2_refresh_token", refresh_token);
  saveStoredValue("pos2_user", JSON.stringify(user));
}

export function clearAuthData() {
  removeStoredValue("pos2_access_token");
  removeStoredValue("pos2_refresh_token");
  removeStoredValue("pos2_user");
}

function getAuthHeaders() {
  const token = getStoredValue("pos2_access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function request(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  let response;
  try {
    response = await fetch(url, options);
  } catch (err) {
    throw new Error(
      `Network error: unable to reach backend at ${API_BASE_URL}. ` +
        "Check that the backend is running and that CORS is enabled."
    );
  }

  const data = await parseJson(response);
  if (!response.ok) {
    const message = data?.error || response.statusText || "Request failed";
    const error = new Error(message);
    error.status = response.status;
    error.payload = data;
    throw error;
  }
  return data;
}

export async function post(path, body) {
  return request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function patch(path, body) {
  return request(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function del(path) {
  return request(path, {
    method: "DELETE",
  });
}

export async function authRequest(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...getAuthHeaders(), ...options.headers };
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  } catch (err) {
    throw new Error(
      `Network error: unable to reach backend at ${API_BASE_URL}. ` +
        "Check that the backend is running and that CORS is enabled."
    );
  }

  const data = await parseJson(response);
  if (response.ok) {
    return data;
  }

  if (response.status === 401) {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      return authRequest(path, options);
    }
  }

  const message = data?.error || response.statusText || "Request failed";
  const error = new Error(message);
  error.status = response.status;
  error.payload = data;
  throw error;
}

export async function attemptRefresh() {
  const refreshToken = getStoredValue("pos2_refresh_token");
  if (!refreshToken) {
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${refreshToken}`,
        "Content-Type": "application/json",
      },
    });
    const data = await parseJson(response);
    if (!response.ok) {
      clearAuthData();
      return false;
    }
    saveAuthData(data);
    return true;
  } catch {
    clearAuthData();
    return false;
  }
}

export async function loginUser(credentials) {
  return post("/auth/login", credentials);
}

export async function registerUser(payload) {
  return post("/auth/register", payload);
}

export async function bootstrapOwner(payload) {
  return post("/auth/bootstrap", payload);
}

export async function logoutUser() {
  try {
    await authRequest("/auth/logout", { method: "POST" });
  } catch {
    // ignore logout failures
  }
  clearAuthData();
}
