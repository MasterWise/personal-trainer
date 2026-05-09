const TOKEN_KEY = "pt-auth-token";

export const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api/pt").replace(/\/$/, "");

let authTokenProvider = null;

export function setAuthTokenProvider(provider) {
  authTokenProvider = typeof provider === "function" ? provider : null;
}

export function getStoredAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredAuthToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function getAuthToken() {
  if (authTokenProvider) {
    const providedToken = await authTokenProvider().catch(() => null);
    if (providedToken) return providedToken;
  }
  return getStoredAuthToken();
}

async function buildHeaders() {
  const headers = {
    "Content-Type": "application/json",
    // Skip ngrok interstitial page that returns 403 on API calls
    "ngrok-skip-browser-warning": "true",
  };
  const token = await getAuthToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (localStorage.getItem("debugAI") === "true") headers["x-debug-log"] = "true";
  return headers;
}

function makeApiError(method, endpoint, res, data) {
  const err = new Error(data?.error || `${method} ${endpoint}: ${res.status}`);
  err.statusCode = res.status;
  err.code = data?.code;
  err.payload = data;
  return err;
}

export async function get(endpoint) {
  const res = await fetch(`${API_BASE}${endpoint}`, { headers: await buildHeaders() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw makeApiError("GET", endpoint, res, data);
  }
  return res.json();
}

export async function post(endpoint, body) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: await buildHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw makeApiError("POST", endpoint, res, data);
  }
  return res.json();
}

export async function put(endpoint, body) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "PUT",
    headers: await buildHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw makeApiError("PUT", endpoint, res, data);
  }
  return res.json();
}

export async function del(endpoint) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "DELETE",
    headers: await buildHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw makeApiError("DELETE", endpoint, res, data);
  }
  return res.json();
}
