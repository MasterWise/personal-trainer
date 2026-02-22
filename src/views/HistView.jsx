import { useTheme } from "../contexts/ThemeContext.jsx";
import MD from "../components/ui/MD.jsx";

export default function HistView({ hist }) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <div style={{ overflowY: "auto", height: "100%", background: c.bg }}>
      <div style={{ padding: "14px 16px 28px" }}>
        <div style={{ background: c.primary, borderRadius: "18px", padding: "16px", marginBottom: "14px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: "-30px", right: "-30px", width: "130px", height: "130px", borderRadius: "50%", background: "rgba(255,255,255,0.07)" }} />
          <div style={{ fontFamily: theme.font, color: "rgba(255,255,255,0.7)", fontSize: "11px", fontWeight: "600", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.08em", position: "relative" }}>
            📈 Evolução Geral
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", position: "relative" }}>
            {[
              { l: "Peso perdido", v: "−4,9 kg", s: "65,4 → 60,5 kg" },
              { l: "Gordura −", v: "−1,7%", s: "23,1% → 21,4%" },
              { l: "Meta peso", v: "55–58 kg", s: "até 2027" },
              { l: "Meta gordura", v: "<18%", s: "até 2027" },
            ].map((x, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.14)", borderRadius: "12px", padding: "10px 12px" }}>
                <div style={{ fontFamily: theme.font, color: "rgba(255,255,255,0.6)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "2px" }}>{x.l}</div>
                <div style={{ fontFamily: theme.headingFont, color: "#FFF", fontSize: "20px", fontWeight: "700" }}>{x.v}</div>
                <div style={{ fontFamily: theme.font, color: "rgba(255,255,255,0.5)", fontSize: "10px" }}>{x.s}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: c.surface, borderRadius: "16px", padding: "18px", border: `1px solid ${c.border}`, boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
          <MD content={hist} />
        </div>
        <p style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "12px", textAlign: "center", marginTop: "14px" }}>
          ✏️ O histórico é atualizado automaticamente pelo coach quando você relata dados.
        </p>
      </div>
    </div>
  );
}
