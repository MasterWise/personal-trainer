import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getAuthToken, setAuthToken } from "../main.jsx";

const AuthContext = createContext(null);

const API_BASE = "/api/pt";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const isAuthenticated = !!user;

  const fetchMe = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return null;
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        return data.user || data;
      }
    } catch { /* ignore */ }
    return null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const statusRes = await fetch(`${API_BASE}/auth/status`);
        if (statusRes.ok) {
          const status = await statusRes.json();
          if (status.needsSetup) {
            if (!cancelled) {
              setNeedsSetup(true);
              setIsLoading(false);
            }
            return;
          }
        }

        const me = await fetchMe();
        if (!cancelled) {
          setUser(me);
          setNeedsSetup(false);
        }
      } catch {
        /* offline or server error */
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, [fetchMe]);

  const login = useCallback(async (name, password) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Falha no login");
    }
    const data = await res.json();
    setAuthToken(data.token);
    const me = await fetchMe();
    setUser(me);
    setNeedsSetup(false);
    return me;
  }, [fetchMe]);

  const signup = useCallback(async (name, password) => {
    const res = await fetch(`${API_BASE}/auth/setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Falha no cadastro");
    }
    const data = await res.json();
    setAuthToken(data.token);
    const me = await fetchMe();
    setUser(me);
    setNeedsSetup(false);
    return me;
  }, [fetchMe]);

  const logout = useCallback(async () => {
    try {
      const token = getAuthToken();
      if (token) {
        await fetch(`${API_BASE}/auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
        });
      }
    } catch { /* ignore */ }
    setAuthToken(null);
    setUser(null);
    setNeedsSetup(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, needsSetup, isAuthenticated, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
