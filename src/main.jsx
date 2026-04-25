import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/index.css";
import { ThemeProvider } from "./contexts/ThemeContext.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { DocsProvider } from "./contexts/DocsContext.jsx";
import { ToastProvider } from "./contexts/ToastContext.jsx";
import { get, put, getAuthToken } from "./services/api.js";
import App from "./App.jsx";

window.storage = {
  get: async (key) => {
    const token = await getAuthToken();
    if (token) {
      try {
        const data = await get(`/documents/${key}`);
        return { value: data.content };
      } catch { /* fallback */ }
    }
    const val = localStorage.getItem(`pt-data-${key}`);
    return { value: val };
  },
  set: async (key, value) => {
    localStorage.setItem(`pt-data-${key}`, value);
    const token = await getAuthToken();
    if (token) {
      try {
        await put(`/documents/${key}`, { content: value });
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
