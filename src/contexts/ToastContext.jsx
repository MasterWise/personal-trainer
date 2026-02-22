import React, { createContext, useContext, useState, useCallback, useRef } from "react";

const ToastContext = createContext(null);

const MAX_TOASTS = 3;
const DISMISS_MS = 3000;

const TYPE_COLORS = {
  success: "#5A9A5A",
  error: "#C05A3A",
  info: "#B87850",
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const dismiss = useCallback((id) => {
    clearTimeout(timersRef.current[id]);
    delete timersRef.current[id];
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((message, type = "info") => {
    const id = Date.now() + Math.random();
    const toast = { id, message, type };

    setToasts((prev) => {
      const next = [...prev, toast];
      if (next.length > MAX_TOASTS) {
        const removed = next.shift();
        clearTimeout(timersRef.current[removed.id]);
        delete timersRef.current[removed.id];
      }
      return next;
    });

    timersRef.current[id] = setTimeout(() => dismiss(id), DISMISS_MS);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        style={{
          position: "fixed",
          bottom: "80px",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          zIndex: 9999,
          pointerEvents: "none",
          width: "90%",
          maxWidth: "400px",
        }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            onClick={() => dismiss(toast.id)}
            style={{
              background: TYPE_COLORS[toast.type] || TYPE_COLORS.info,
              color: "#FFFFFF",
              padding: "12px 16px",
              borderRadius: "12px",
              fontFamily: "var(--pt-font-body)",
              fontSize: "14px",
              fontWeight: 500,
              lineHeight: 1.4,
              boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
              animation: "slideUp 0.25s ease-out, fadeIn 0.2s ease-out",
              pointerEvents: "auto",
              cursor: "pointer",
            }}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
