import { useTheme } from "../../contexts/ThemeContext.jsx";

export default function PermCard({ msg, onYes, onNo }) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <div style={{ background: c.primaryBg, border: `1.5px solid ${c.primary}`, borderRadius: "14px", padding: "13px 15px", margin: "8px 0" }}>
      <div style={{ display: "flex", gap: "9px", marginBottom: "11px", alignItems: "flex-start" }}>
        <span style={{ fontSize: "18px", flexShrink: 0 }}>🔔</span>
        <p style={{ fontFamily: theme.font, color: c.text, fontSize: "13.5px", lineHeight: "1.6" }}>{msg}</p>
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        <button onClick={onYes} style={{ flex: 1, padding: "9px", background: c.primary, color: "#FFF", border: "none", borderRadius: "10px", fontFamily: theme.font, fontSize: "14px", fontWeight: "600", cursor: "pointer" }}>
          ✓ Sim, atualizar
        </button>
        <button onClick={onNo} style={{ padding: "9px 16px", background: "transparent", color: c.textMuted, border: `1px solid ${c.border}`, borderRadius: "10px", fontFamily: theme.font, fontSize: "14px", cursor: "pointer" }}>
          Não
        </button>
      </div>
    </div>
  );
}
