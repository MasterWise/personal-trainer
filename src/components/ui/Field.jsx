import { useTheme } from "../../contexts/ThemeContext.jsx";

export default function Field({ label, value, onChange, type = "text", hint, multiline }) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <div style={{ marginBottom: "14px" }}>
      <label style={{ display: "block", fontFamily: theme.font, color: c.textSecondary, fontSize: "11.5px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>
        {label}
      </label>
      {hint && <p style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "11px", marginBottom: "5px", lineHeight: "1.4" }}>{hint}</p>}
      {multiline
        ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={3}
            style={{ width: "100%", padding: "9px 12px", background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: "10px", fontFamily: theme.font, fontSize: "13.5px", color: c.text, outline: "none", resize: "vertical", lineHeight: "1.5" }} />
        : <input type={type} value={value} onChange={e => onChange(e.target.value)}
            style={{ width: "100%", padding: "9px 12px", background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: "10px", fontFamily: theme.font, fontSize: "13.5px", color: c.text, outline: "none" }} />
      }
    </div>
  );
}
