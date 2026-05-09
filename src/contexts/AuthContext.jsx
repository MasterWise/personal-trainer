import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  API_BASE,
  get,
  post,
  setAuthTokenProvider,
  setStoredAuthToken,
} from "../services/api.js";
import {
  getFirebaseIdToken,
  hasFirebaseConfig,
  loginWithFirebaseEmail,
  loginWithFirebaseGoogle,
  logoutFirebase,
  mapFirebaseUser,
  onFirebaseAuthChanged,
  registerWithFirebaseEmail,
} from "../services/firebaseAuthClient.js";

const AuthContext = createContext(null);

function isEmailAddress(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

async function readError(res, fallback) {
  const data = await res.json().catch(() => ({}));
  return data.error || fallback;
}

function requireBackendUser(backendUser) {
  if (!backendUser) {
    throw new Error("Perfil do app nao encontrado. Use um convite ou fale com um administrador.");
  }
  return backendUser;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const isAuthenticated = !!user;
  const isFirebaseEnabled = hasFirebaseConfig;

  const fetchMe = useCallback(async () => {
    try {
      const data = await get("/auth/me");
      return data.user || data;
    } catch { /* ignore */ }
    return null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    setAuthTokenProvider(hasFirebaseConfig ? () => getFirebaseIdToken() : null);

    async function loadLocalSession({ allowSetupScreen = true } = {}) {
      try {
        const statusRes = await fetch(`${API_BASE}/auth/status`);
        if (statusRes.ok) {
          const status = await statusRes.json();
          if (status.needsSetup && allowSetupScreen) {
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

    async function init() {
      if (!hasFirebaseConfig) {
        await loadLocalSession();
        return;
      }

      let unsubscribe = null;
      try {
        unsubscribe = await onFirebaseAuthChanged(async (firebaseUser) => {
          if (cancelled) return;
          if (!firebaseUser) {
            await loadLocalSession();
            return;
          }

          const backendUser = await fetchMe();
          if (!cancelled) {
            setUser(backendUser ? mapFirebaseUser(firebaseUser, backendUser) : null);
            setNeedsSetup(false);
            setIsLoading(false);
          }
        });
      } catch {
        setAuthTokenProvider(null);
        await loadLocalSession();
      }

      return unsubscribe;
    }

    let unsubscribePromise = init();
    return () => {
      cancelled = true;
      Promise.resolve(unsubscribePromise).then((unsubscribe) => {
        if (typeof unsubscribe === "function") unsubscribe();
      });
    };
  }, [fetchMe]);

  const login = useCallback(async (name, password) => {
    const identifier = String(name || "").trim();

    if (hasFirebaseConfig && isEmailAddress(identifier)) {
      let firebaseUser = null;
      try {
        firebaseUser = await loginWithFirebaseEmail(identifier, password);
      } catch {
        // Fallback local para manter compatibilidade durante a transicao.
      }

      if (firebaseUser) {
        setStoredAuthToken(null);
        const backendUser = await fetchMe();
        if (!backendUser) {
          await logoutFirebase().catch(() => {});
          throw new Error("Perfil do app nao encontrado. Use um convite ou fale com um administrador.");
        }
        const nextUser = mapFirebaseUser(firebaseUser, backendUser);
        setUser(nextUser);
        setNeedsSetup(false);
        return nextUser;
      }
    }

    const data = await post("/auth/login", { name: identifier, password });
    setStoredAuthToken(data.token);
    const me = await fetchMe();
    setUser(me);
    setNeedsSetup(false);
    return me;
  }, [fetchMe]);

  const signup = useCallback(async (name, password, secret) => {
    const identifier = String(name || "").trim();

    if (hasFirebaseConfig) {
      if (!isEmailAddress(identifier)) {
        throw new Error("No modo Firebase, o primeiro cadastro deve usar um e-mail valido.");
      }

      const firebaseUser = await registerWithFirebaseEmail(identifier, password);
      setStoredAuthToken(null);
      try {
        await post("/auth/setup", { secret });
        await getFirebaseIdToken(true).catch(() => null);
        const backendUser = requireBackendUser(await fetchMe());
        const nextUser = mapFirebaseUser(firebaseUser, backendUser);
        setUser(nextUser);
        setNeedsSetup(false);
        return nextUser;
      } catch (error) {
        await logoutFirebase().catch(() => {});
        throw error;
      }
    }

    const res = await fetch(`${API_BASE}/auth/setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: identifier, password, secret }),
    });
    if (!res.ok) {
      throw new Error(await readError(res, "Falha no cadastro"));
    }
    const data = await res.json();
    setStoredAuthToken(data.token);
    const me = await fetchMe();
    setUser(me);
    setNeedsSetup(false);
    return me;
  }, [fetchMe]);

  const register = useCallback(async (name, password, invite) => {
    const identifier = String(name || "").trim();

    if (hasFirebaseConfig && isEmailAddress(identifier)) {
      const firebaseUser = await registerWithFirebaseEmail(identifier, password);
      setStoredAuthToken(null);
      let backendUser = null;
      try {
        await post("/auth/register", { name: identifier, password, invite });
        backendUser = await fetchMe();
      } catch {
        backendUser = await fetchMe();
        if (!backendUser) {
          await logoutFirebase().catch(() => {});
          throw new Error("Conta Firebase criada, mas o perfil do app nao foi ativado pelo backend");
        }
      }
      const nextUser = mapFirebaseUser(firebaseUser, backendUser);
      setUser(nextUser);
      setNeedsSetup(false);
      return nextUser;
    }

    const data = await post("/auth/register", { name: identifier, password, invite });
    setStoredAuthToken(data.token);
    const me = await fetchMe();
    setUser(me);
    setNeedsSetup(false);
    return me;
  }, [fetchMe]);

  const loginWithGoogle = useCallback(async () => {
    const firebaseUser = await loginWithFirebaseGoogle();
    setStoredAuthToken(null);
    let backendUser = await fetchMe();
    let autoRegisterError = null;
    if (!backendUser) {
      try {
        const data = await post("/auth/auto-register", {});
        backendUser = data?.user || null;
      } catch (e) {
        autoRegisterError = e;
      }
    }
    if (!backendUser) {
      await logoutFirebase().catch(() => {});
      const code = autoRegisterError?.code;
      const status = autoRegisterError?.statusCode;
      let userMessage;
      if (code === "WHITELIST_MISS" || code === "MISSING_EMAIL" || status === 403) {
        userMessage = "Seu e-mail nao esta autorizado. Peca acesso a um administrador.";
      } else if (status === 401) {
        userMessage = "Sua sessao expirou. Faca login novamente.";
      } else if (typeof status === "number" && status >= 500) {
        userMessage = "Erro temporario no servidor. Tente novamente em instantes.";
      } else {
        userMessage = "Nao foi possivel entrar. Tente novamente.";
      }
      throw new Error(userMessage);
    }
    const nextUser = mapFirebaseUser(firebaseUser, backendUser);
    setUser(nextUser);
    setNeedsSetup(false);
    return nextUser;
  }, [fetchMe]);

  const registerWithGoogle = useCallback(async (invite) => {
    if (!invite) throw new Error("Codigo de convite obrigatorio");
    const firebaseUser = await loginWithFirebaseGoogle();
    setStoredAuthToken(null);
    let backendUser = null;
    try {
      await post("/auth/register", { invite });
      backendUser = await fetchMe();
    } catch (error) {
      backendUser = await fetchMe();
      if (!backendUser) {
        await logoutFirebase().catch(() => {});
        throw new Error(error?.message || "Falha ao registrar com Google");
      }
    }
    const nextUser = mapFirebaseUser(firebaseUser, backendUser);
    setUser(nextUser);
    setNeedsSetup(false);
    return nextUser;
  }, [fetchMe]);

  const logout = useCallback(async () => {
    await post("/auth/logout", {}).catch(() => {});
    try {
      if (hasFirebaseConfig) await logoutFirebase();
    } catch { /* ignore */ }
    setStoredAuthToken(null);
    setUser(null);
    setNeedsSetup(false);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      needsSetup,
      isAuthenticated,
      isFirebaseEnabled,
      login,
      loginWithGoogle,
      registerWithGoogle,
      signup,
      register,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
