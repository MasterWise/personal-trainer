import { useTheme } from "../contexts/ThemeContext.jsx";
import { DIAS_SEMANA } from "../data/constants.js";
import MacroBar from "../components/ui/MacroBar.jsx";

export default function SaudeView({ cal, treinos }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const today = new Date().toLocaleDateString("pt-BR");

  let calObj = {};
  let treinosObj = {};
  try { calObj = JSON.parse(cal || "{}"); } catch { /* ignore */ }
  try { treinosObj = JSON.parse(treinos || "{}"); } catch { /* ignore */ }

  const meta = calObj.meta_diaria || { kcal: 1450, proteina_g: 115, carbo_g: 110, gordura_g: 45 };
  const hoje = calObj.dias?.[today] || { kcal_consumido: 0, proteina_g: 0, carbo_g: 0, gordura_g: 0, refeicoes: [] };
  const kcalRestante = Math.max(0, meta.kcal - (hoje.kcal_consumido || 0));
  const kcalPct = meta.kcal > 0 ? Math.min(100, Math.round(((hoje.kcal_consumido || 0) / meta.kcal) * 100)) : 0;
  const kcalOver = (hoje.kcal_consumido || 0) > meta.kcal;

  const diasSemana = Object.entries(calObj.dias || {}).slice(-7);
  const totalSemana = diasSemana.reduce((s, [, d]) => s + (d.kcal_consumido || 0), 0);
  const metaSemana = meta.kcal * 7;

  const regs = (treinosObj.registros || []).slice(-14);
  const planejados = treinosObj.planejados || {};

  const hoje_js = new Date();
  const diaSemana = hoje_js.getDay();
  const startOfWeek = new Date(hoje_js);
  startOfWeek.setDate(hoje_js.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1));
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek); d.setDate(startOfWeek.getDate() + i);
    const dateStr = d.toLocaleDateString("pt-BR");
    const dayKey = DIAS_SEMANA[d.getDay()];
    const reg = regs.find(r => r.data === dateStr);
    const isPlanned = !!planejados[dayKey];
    const isToday = dateStr === today;
    return { dateStr, dayKey, reg, isPlanned, isToday, dayNum: d.getDate(), jsDay: d.getDay() };
  });
  const treinosFeitos = weekDays.filter(d => d.reg?.realizado).length;
  const treinosPlanejados = weekDays.filter(d => d.isPlanned).length;

  const cardStyle = { background: c.surface, borderRadius: "18px", padding: "16px 18px", marginBottom: "12px", border: `1px solid ${c.border}`, boxShadow: "0 1px 6px rgba(0,0,0,0.05)" };

  return (
    <div style={{ overflowY: "auto", height: "100%", background: c.bg }}>
      <div style={{ padding: "14px 15px 28px" }}>

        {/* Calorias hoje */}
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
            <div>
              <p style={{ fontFamily: theme.headingFont, color: c.text, fontSize: "16px", fontWeight: "700" }}>🍎 Calorias hoje</p>
              <p style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "11px", marginTop: "2px" }}>{today}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: theme.headingFont, color: kcalOver ? c.danger : c.primary, fontSize: "24px", fontWeight: "700", lineHeight: "1" }}>{hoje.kcal_consumido || 0}</div>
              <div style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "11px" }}>de {meta.kcal} kcal</div>
            </div>
          </div>

          <div style={{ position: "relative", height: "10px", background: `${c.primary}22`, borderRadius: "8px", overflow: "hidden", marginBottom: "6px" }}>
            <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${kcalPct}%`, background: kcalOver ? c.danger : c.primary, borderRadius: "8px", transition: "width 0.4s" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
            <span style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "11px" }}>{kcalPct}% da meta</span>
            <span style={{ fontFamily: theme.font, color: kcalOver ? c.danger : c.ok, fontSize: "11px", fontWeight: "600" }}>
              {kcalOver ? `+${(hoje.kcal_consumido || 0) - meta.kcal} acima` : `${kcalRestante} restantes`}
            </span>
          </div>

          <MacroBar label="Proteína (g)" value={hoje.proteina_g || 0} meta={meta.proteina_g} color="#5A9A5A" />
          <MacroBar label="Carboidrato (g)" value={hoje.carbo_g || 0} meta={meta.carbo_g} color="#B87850" />
          <MacroBar label="Gordura (g)" value={hoje.gordura_g || 0} meta={meta.gordura_g} color="#7A6AAA" />

          {(hoje.refeicoes || []).length > 0 && (
            <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: `1px solid ${c.border}` }}>
              <p style={{ fontFamily: theme.font, color: c.textSecondary, fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>Registrado hoje</p>
              {(hoje.refeicoes || []).map((r, i) => (
                <div key={i} style={{ display: "flex", gap: "6px", marginBottom: "4px" }}>
                  <span style={{ color: c.primary, fontSize: "11px", marginTop: "1px" }}>•</span>
                  <span style={{ fontFamily: theme.font, color: c.textSecondary, fontSize: "12.5px", lineHeight: "1.5" }}>{r}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Treinos da semana */}
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <p style={{ fontFamily: theme.headingFont, color: c.text, fontSize: "16px", fontWeight: "700" }}>🏋️ Treinos — semana</p>
            <span style={{ fontFamily: theme.font, color: c.primary, fontSize: "13px", fontWeight: "700" }}>{treinosFeitos}/{treinosPlanejados}</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "6px", marginBottom: "12px" }}>
            {weekDays.map(d => {
              const done = d.reg?.realizado === true;
              const missed = d.reg?.realizado === false;
              const planned = d.isPlanned && !d.reg;
              const future = !d.reg && new Date(d.dateStr.split("/").reverse().join("-")) > new Date();
              const bg = done ? "#5A9A5A" : missed ? c.danger : d.isToday && planned ? c.primary : planned && !future ? "#C09040" : c.bg;
              const textColor = (done || missed || (d.isToday && planned)) ? "#FFF" : c.textMuted;
              return (
                <div key={d.dateStr} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                  <span style={{ fontFamily: theme.font, fontSize: "10px", color: c.textMuted, fontWeight: d.isToday ? "700" : "400" }}>
                    {["D", "S", "T", "Q", "Q", "S", "S"][d.jsDay]}
                  </span>
                  <div title={d.reg?.tipo || (d.isPlanned ? planejados[d.dayKey] : "Descanso")}
                    style={{ width: "34px", height: "34px", borderRadius: "10px", background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", border: d.isToday ? `2px solid ${c.primary}` : "none" }}>
                    <span style={{ color: textColor, fontSize: "14px" }}>{done ? "✓" : missed ? "✗" : d.isPlanned ? "◉" : "·"}</span>
                  </div>
                  <span style={{ fontFamily: theme.font, fontSize: "10px", color: d.isToday ? c.primary : c.textMuted, fontWeight: d.isToday ? "700" : "400" }}>{d.dayNum}</span>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {[["#5A9A5A", "✓ Feito"], [c.danger, "✗ Perdido"], [c.primary, "◉ Planejado"], ["#D0C8C0", "· Descanso"]].map(([color, label]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "3px", background: color }} />
                <span style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "10.5px" }}>{label}</span>
              </div>
            ))}
          </div>

          {regs.filter(r => r.notas).length > 0 && (
            <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: `1px solid ${c.border}` }}>
              {regs.filter(r => r.notas).slice(-3).map((r, i) => (
                <div key={i} style={{ display: "flex", gap: "6px", marginBottom: "4px" }}>
                  <span style={{ color: c.primary, fontSize: "11px", marginTop: "1px", flexShrink: 0 }}>•</span>
                  <span style={{ fontFamily: theme.font, color: c.textSecondary, fontSize: "12px" }}><strong>{r.data}</strong> — {r.notas}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resumo semanal */}
        <div style={{ background: c.primary, borderRadius: "18px", padding: "16px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: "-20px", right: "-20px", width: "100px", height: "100px", borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
          <p style={{ fontFamily: theme.font, color: "rgba(255,255,255,0.7)", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px", position: "relative" }}>📊 Semana atual</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", position: "relative" }}>
            {[
              { l: "Kcal semana", v: `${totalSemana}`, s: `meta ${metaSemana}` },
              { l: "Saldo", v: totalSemana <= metaSemana ? `-${metaSemana - totalSemana}` : `+${totalSemana - metaSemana}`, s: totalSemana <= metaSemana ? "dentro da meta" : "acima da meta" },
              { l: "Treinos feitos", v: `${treinosFeitos}`, s: `de ${treinosPlanejados} planejados` },
              { l: "Adesão treinos", v: `${treinosPlanejados > 0 ? Math.round((treinosFeitos / treinosPlanejados) * 100) : 0}%`, s: "na semana" },
            ].map((x, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.14)", borderRadius: "12px", padding: "10px 12px" }}>
                <div style={{ fontFamily: theme.font, color: "rgba(255,255,255,0.6)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "2px" }}>{x.l}</div>
                <div style={{ fontFamily: theme.headingFont, color: "#FFF", fontSize: "20px", fontWeight: "700" }}>{x.v}</div>
                <div style={{ fontFamily: theme.font, color: "rgba(255,255,255,0.5)", fontSize: "10px" }}>{x.s}</div>
              </div>
            ))}
          </div>
        </div>

        <p style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "12px", textAlign: "center", marginTop: "14px" }}>
          💬 Relate refeições e treinos no chat — o coach atualiza aqui automaticamente.
        </p>
      </div>
    </div>
  );
}
