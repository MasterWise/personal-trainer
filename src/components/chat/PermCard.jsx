import { useTheme } from "../../contexts/ThemeContext.jsx";

export default function PermCard({ prompt, onYes, onNo }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const title = String(prompt?.title || "Confirmação necessária");
  const message = String(prompt?.message || "Posso aplicar esta alteração?");
  const approveLabel = String(prompt?.approveLabel || "✓ Sim, atualizar");
  const rejectLabel = String(prompt?.rejectLabel || "Não");
  const details = Array.isArray(prompt?.details) ? prompt.details.filter((line) => typeof line === "string" && line.trim()) : [];

  return (
    <div style={{ background: c.primaryBg, border: `1.5px solid ${c.primary}`, borderRadius: "14px", padding: "13px 15px", margin: "8px 0" }}>
      <div style={{ display: "flex", gap: "9px", marginBottom: "11px", alignItems: "flex-start" }}>
        <span style={{ fontSize: "18px", flexShrink: 0 }}>🔔</span>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontFamily: theme.font, color: c.text, fontSize: "13.5px", lineHeight: "1.3", fontWeight: 700, marginBottom: "4px" }}>{title}</p>
          <p style={{ fontFamily: theme.font, color: c.text, fontSize: "13.5px", lineHeight: "1.6" }}>{message}</p>
          {details.length > 0 && (
            <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "5px" }}>
              {details.map((line, index) => (
                <p key={`${line}-${index}`} style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "12.5px", lineHeight: "1.45" }}>
                  • {line}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        <button onClick={onYes} style={{ flex: 1, padding: "9px", background: c.primary, color: "#FFF", border: "none", borderRadius: "10px", fontFamily: theme.font, fontSize: "14px", fontWeight: "600", cursor: "pointer" }}>
          {approveLabel}
        </button>
        <button onClick={onNo} style={{ padding: "9px 16px", background: "transparent", color: c.textMuted, border: `1px solid ${c.border}`, borderRadius: "10px", fontFamily: theme.font, fontSize: "14px", cursor: "pointer" }}>
          {rejectLabel}
        </button>
      </div>
    </div>
  );
}
