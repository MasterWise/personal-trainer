import React, { useEffect, useState } from "react";

const wrapperStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  zIndex: 10000,
  display: "flex",
  justifyContent: "center",
  padding: "10px 12px",
  pointerEvents: "none",
};

const cardStyle = {
  pointerEvents: "auto",
  display: "flex",
  alignItems: "center",
  gap: "12px",
  maxWidth: "520px",
  width: "100%",
  padding: "10px 14px",
  borderRadius: "14px",
  background: "var(--pt-color-surface, #FFF)",
  border: "1px solid var(--pt-color-border, #E8DCC8)",
  boxShadow: "0 6px 24px rgba(184,120,80,0.18)",
  fontFamily: "var(--pt-font-body, sans-serif)",
};

const textStyle = {
  flex: 1,
  fontSize: "13.5px",
  color: "var(--pt-color-text, #2C1810)",
  lineHeight: 1.4,
};

const primaryBtnStyle = {
  padding: "7px 12px",
  borderRadius: "10px",
  border: "none",
  background: "var(--pt-color-primary, #B87850)",
  color: "#FFF",
  fontWeight: 600,
  fontSize: "13px",
  cursor: "pointer",
  flexShrink: 0,
};

const ghostBtnStyle = {
  padding: "7px 10px",
  borderRadius: "10px",
  border: "none",
  background: "transparent",
  color: "var(--pt-color-text-muted, #6E5A4B)",
  fontWeight: 600,
  fontSize: "13px",
  cursor: "pointer",
  flexShrink: 0,
};

/**
 * Banner exibido quando o service worker novo ativa (evento `pt:sw-updated`
 * disparado no window pelo listener em index.html). Oferece recarregar a
 * página para garantir que o bundle JS/CSS é o mais novo.
 *
 * O SW v5 já fez `clients.claim()` antes de emitir SW_UPDATED, então a
 * próxima navegação serve o novo bundle. O reload é a forma mais simples
 * de garantir consistência entre app shell e bundle ativo.
 */
export default function UpdateBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function handle() {
      setVisible(true);
    }
    window.addEventListener("pt:sw-updated", handle);
    return () => window.removeEventListener("pt:sw-updated", handle);
  }, []);

  if (!visible) return null;

  const handleReload = async () => {
    try {
      // Força o SW "waiting" (se houver) a virar active imediatamente, então
      // recarrega para garantir bundle limpo.
      const reg = await navigator.serviceWorker?.getRegistration?.();
      reg?.waiting?.postMessage({ type: "SKIP_WAITING" });
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  return (
    <div style={wrapperStyle} role="status" aria-live="polite">
      <div style={cardStyle}>
        <span style={textStyle}>
          ✨ Nova versão disponível. Recarregue para atualizar.
        </span>
        <button type="button" style={primaryBtnStyle} onClick={handleReload}>
          Atualizar
        </button>
        <button type="button" style={ghostBtnStyle} onClick={() => setVisible(false)} aria-label="Dispensar">
          ✕
        </button>
      </div>
    </div>
  );
}
