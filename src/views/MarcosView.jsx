import { useTheme } from "../contexts/ThemeContext.jsx";
import { TYPE_COLORS } from "../data/constants.js";

export default function MarcosView({ marcos }) {
  const { theme } = useTheme();
  const c = theme.colors;
  let arr = [];
  try { arr = JSON.parse(marcos || "[]"); } catch { /* ignore */ }

  return (
    <div style={{ overflowY: "auto", height: "100%", background: c.bg }}>
      <div style={{ padding: "14px 15px 28px" }}>
        <p style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "13px", marginBottom: "14px" }}>
          Conquistas e momentos da sua jornada.
          <br /><span style={{ fontSize: "11px" }}>💡 O coach registra marcos automaticamente nas conversas.</span>
        </p>

        {arr.length === 0 && (
          <div style={{ textAlign: "center", marginTop: "40px" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>🌱</div>
            <p style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "14px" }}>Ainda sem marcos. Sua jornada está apenas começando!</p>
          </div>
        )}

        <div style={{ position: "relative" }}>
          {arr.length > 0 && <div style={{ position: "absolute", left: "19px", top: "20px", bottom: "0", width: "2px", background: `linear-gradient(to bottom,${c.primary},${c.primary}10)` }} />}
          {[...arr].reverse().map(m => (
            <div key={m.id} style={{ display: "flex", gap: "13px", marginBottom: "14px" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: `linear-gradient(135deg,${c.primaryLight},${c.primary})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0, zIndex: 1, position: "relative", boxShadow: `0 2px 8px ${c.primary}30` }}>
                {m.emoji || "🏆"}
              </div>
              <div style={{ flex: 1, background: c.surface, borderRadius: "14px", padding: "12px 14px", boxShadow: "0 1px 5px rgba(0,0,0,0.05)", border: `1px solid ${c.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "4px" }}>
                  <span style={{ fontFamily: theme.headingFont, color: c.text, fontSize: "14px", fontWeight: "700" }}>{m.title}</span>
                  <span style={{ padding: "2px 8px", borderRadius: "8px", fontSize: "10px", background: `${TYPE_COLORS[m.type] || c.primary}20`, color: TYPE_COLORS[m.type] || c.primary, fontFamily: theme.font, fontWeight: "600", whiteSpace: "nowrap", flexShrink: 0 }}>{m.type}</span>
                </div>
                <div style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "11px", marginBottom: "6px" }}>{m.date}</div>
                {m.context && <p style={{ fontFamily: theme.font, color: c.textSecondary, fontSize: "13px", lineHeight: "1.6", marginBottom: "4px" }}>{m.context}</p>}
                {m.significado && <p style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "12px", fontStyle: "italic", lineHeight: "1.5" }}>✨ {m.significado}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
