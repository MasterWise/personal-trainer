import React from "react";
import { useInstallPrompt } from "../../hooks/useInstallPrompt.js";

const cardBaseStyle = {
  width: "100%",
  maxWidth: "320px",
  padding: "14px 16px",
  borderRadius: "14px",
  border: "1px solid var(--pt-color-border)",
  background: "var(--pt-color-surface)",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  boxShadow: "0 2px 10px rgba(184,120,80,0.08)",
};

const iconCircleStyle = {
  width: "32px",
  height: "32px",
  borderRadius: "50%",
  background: "linear-gradient(135deg, var(--pt-color-primary-light, #D9A687), var(--pt-color-primary, #B87850))",
  color: "#FFF",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "16px",
  flexShrink: 0,
};

const headerRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
};

const titleStyle = {
  fontFamily: "var(--pt-font-body, sans-serif)",
  fontSize: "14px",
  fontWeight: 700,
  color: "var(--pt-color-text, #2C1810)",
  margin: 0,
};

const textStyle = {
  fontFamily: "var(--pt-font-body, sans-serif)",
  fontSize: "12.5px",
  lineHeight: 1.5,
  color: "var(--pt-color-text-muted, #6E5A4B)",
  margin: 0,
};

const actionsRowStyle = {
  display: "flex",
  gap: "8px",
  marginTop: "4px",
};

const primaryBtnStyle = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "none",
  background: "var(--pt-color-primary, #B87850)",
  color: "#FFF",
  fontFamily: "var(--pt-font-body, sans-serif)",
  fontWeight: 600,
  fontSize: "13px",
  cursor: "pointer",
};

const ghostBtnStyle = {
  padding: "8px 12px",
  borderRadius: "10px",
  border: "1px solid var(--pt-color-border, #E8DCC8)",
  background: "transparent",
  color: "var(--pt-color-text-muted, #6E5A4B)",
  fontFamily: "var(--pt-font-body, sans-serif)",
  fontWeight: 600,
  fontSize: "13px",
  cursor: "pointer",
};

/**
 * Card discreto que oferece instalar a PWA. Não renderiza se:
 *   - já está em standalone (PWA instalada);
 *   - usuário dismissou nas últimas 7 dias;
 *   - browser não suporta install prompt e não é iOS.
 *
 * Em Android/Chrome: botão "Instalar app" → chama `prompt()` nativo.
 * Em iOS Safari: mostra instrução visual (Compartilhar → Adicionar).
 */
export default function InstallButton({ style = null, variant = "card" }) {
  const { canPrompt, isIos, isStandalone, prompt, dismiss } = useInstallPrompt();

  if (isStandalone) return null;
  if (!canPrompt && !isIos) return null;

  const containerStyle = { ...cardBaseStyle, ...(style || {}) };

  const handleInstall = async () => {
    const result = await prompt();
    if (result?.outcome !== "accepted") {
      // dismiss não accept: respeitar por 7 dias para não cansar usuário.
      dismiss();
    }
  };

  if (canPrompt) {
    return (
      <div style={containerStyle} role="region" aria-label="Instalar aplicativo">
        <div style={headerRowStyle}>
          <div style={iconCircleStyle} aria-hidden>📱</div>
          <h3 style={titleStyle}>Instalar como app</h3>
        </div>
        <p style={textStyle}>
          Adicione o PT Coach à sua tela inicial para abrir em modo tela cheia, mais rápido.
        </p>
        <div style={actionsRowStyle}>
          <button type="button" style={primaryBtnStyle} onClick={handleInstall}>
            Instalar app
          </button>
          <button type="button" style={ghostBtnStyle} onClick={dismiss}>
            Agora não
          </button>
        </div>
      </div>
    );
  }

  // iOS: instrução manual
  return (
    <div style={containerStyle} role="region" aria-label="Instruções de instalação iOS">
      <div style={headerRowStyle}>
        <div style={iconCircleStyle} aria-hidden>📲</div>
        <h3 style={titleStyle}>Instalar no iPhone</h3>
      </div>
      <p style={textStyle}>
        Toque em <strong>Compartilhar</strong> ⬆️ na barra do Safari, depois em{" "}
        <strong>Adicionar à Tela de Início</strong>.
      </p>
      <div style={actionsRowStyle}>
        <button type="button" style={ghostBtnStyle} onClick={dismiss}>
          Entendi
        </button>
      </div>
    </div>
  );
}
