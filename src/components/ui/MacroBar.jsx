import { useTheme } from "../../contexts/ThemeContext.jsx";

export default function MacroBar({ label, value, meta, color }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const pct = meta > 0 ? Math.min(100, Math.round((value / meta) * 100)) : 0;

  return (
    <div style={{ marginBottom: "10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
        <span style={{ fontFamily: theme.font, color: c.textSecondary, fontSize: "12px", fontWeight: "600" }}>{label}</span>
        <span style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "12px" }}>
          {value}<span style={{ fontSize: "11px" }}>/{meta}</span>
        </span>
      </div>
      <div style={{ height: "8px", background: `${color}22`, borderRadius: "4px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "4px", transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}
