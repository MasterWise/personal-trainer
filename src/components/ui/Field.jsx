import { useTheme } from "../../contexts/ThemeContext.jsx";

export default function Field({ label, value, onChange, type = "text", hint, multiline }) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <div style={{ marginBottom: "16px" }}>
      <label style={{ display: "block", fontFamily: theme.font, color: c.textMuted, fontSize: "10.5px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>
        {label}
      </label>
      {hint && <p style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "11.5px", marginBottom: "8px", lineHeight: "1.4", opacity: 0.8 }}>{hint}</p>}
      {multiline
        ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={3}
            style={{ width: "100%", padding: "12px 14px", background: c.bg, border: `1px solid ${c.border}`, borderRadius: "12px", fontFamily: theme.font, fontSize: "14px", color: c.text, outline: "none", resize: "vertical", lineHeight: "1.5", transition: "border 0.2s", boxShadow: `inset 0 2px 4px rgba(0,0,0,0.02)` }} />
        : <input type={type} value={value} onChange={e => onChange(e.target.value)}
            style={{ width: "100%", padding: "12px 14px", background: c.bg, border: `1px solid ${c.border}`, borderRadius: "12px", fontFamily: theme.font, fontSize: "14px", color: c.text, outline: "none", transition: "border 0.2s", boxShadow: `inset 0 2px 4px rgba(0,0,0,0.02)` }} />
      }
    </div>
  );
}
