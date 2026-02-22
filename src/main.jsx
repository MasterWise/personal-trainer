import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/index.css";
import { ThemeProvider } from "./contexts/ThemeContext.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { DocsProvider } from "./contexts/DocsContext.jsx";
import { ToastProvider } from "./contexts/ToastContext.jsx";
import App from "./App.jsx";

const TOKEN_KEY = "pt-auth-token";
const API_BASE = "/api/pt";

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function authHeaders() {
  const headers = { "Content-Type": "application/json" };
  const token = getAuthToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

window.storage = {
  get: async (key) => {
    const token = getAuthToken();
    if (token) {
      try {
        const res = await fetch(`${API_BASE}/documents/${key}`, { headers: authHeaders() });
        if (res.ok) {
          const data = await res.json();
          return { value: data.content };
        }
      } catch { /* fallback */ }
    }
    const val = localStorage.getItem(`pt-data-${key}`);
    return { value: val };
  },
  set: async (key, value) => {
    localStorage.setItem(`pt-data-${key}`, value);
    const token = getAuthToken();
    if (token) {
      try {
        await fetch(`${API_BASE}/documents/${key}`, {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify({ content: value }),
        });
      } catch { /* localStorage only */ }
    }
  },
  delete: async (key) => {
    localStorage.removeItem(`pt-data-${key}`);
  },
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <DocsProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </DocsProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
