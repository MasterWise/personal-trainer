import { getAuthToken } from "../main.jsx";

export const API_BASE = "/api/pt";

function buildHeaders() {
  const headers = { "Content-Type": "application/json" };
  const token = getAuthToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (localStorage.getItem("debugAI") === "true") headers["x-debug-log"] = "true";
  return headers;
}

export async function get(endpoint) {
  const res = await fetch(`${API_BASE}${endpoint}`, { headers: buildHeaders() });
  if (!res.ok) throw new Error(`GET ${endpoint}: ${res.status}`);
  return res.json();
}

export async function post(endpoint, body) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `POST ${endpoint}: ${res.status}`);
  }
  return res.json();
}

export async function put(endpoint, body) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "PUT",
    headers: buildHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${endpoint}: ${res.status}`);
  return res.json();
}

export async function del(endpoint) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "DELETE",
    headers: buildHeaders(),
  });
  if (!res.ok) throw new Error(`DELETE ${endpoint}: ${res.status}`);
  return res.json();
}
