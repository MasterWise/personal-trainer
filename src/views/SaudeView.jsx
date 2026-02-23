import { useState } from "react";
import { useTheme } from "../contexts/ThemeContext.jsx";
import { DIAS_SEMANA } from "../data/constants.js";
import MacroBar from "../components/ui/MacroBar.jsx";

/* ── Helpers ── */
function parseDateBR(str) {
  const [d, m, y] = str.split("/").map(Number);
  return new Date(y, m - 1, d);
}
function toDateBR(date) { return date.toLocaleDateString("pt-BR"); }
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
function formatWeekLabel(start) {
  const end = new Date(start); end.setDate(start.getDate() + 6);
  return start.getMonth() === end.getMonth()
    ? `${start.getDate()} – ${end.getDate()} ${MESES[start.getMonth()]}`
    : `${start.getDate()} ${MESES[start.getMonth()]} – ${end.getDate()} ${MESES[end.getMonth()]}`;
}
function fmtDay(dateStr) {
  const d = parseDateBR(dateStr);
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}
const DAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];
const C_DONE = "#4CAF50";
const C_MISSED = "#E53935";

export default function SaudeView({ cal, treinos }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const realToday = toDateBR(new Date());
  const [selectedDate, setSelectedDate] = useState(realToday);

  let calObj = {}, treinosObj = {};
  try { calObj = JSON.parse(cal || "{}"); } catch { /* */ }
  try { treinosObj = JSON.parse(treinos || "{}"); } catch { /* */ }

  const meta = calObj.meta_diaria || { kcal: 1450, proteina_g: 115, carbo_g: 110, gordura_g: 45, fibra_g: 25 };
  const regs = treinosObj.registros || [];
  const planejados = treinosObj.planejados || {};

  const selectedJS = parseDateBR(selectedDate);
  const startOfWeek = getMonday(selectedJS);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek); d.setDate(startOfWeek.getDate() + i);
    const dateStr = toDateBR(d);
    const dayKey = DIAS_SEMANA[d.getDay()];
    return {
      dateStr, dayKey,
      reg: regs.find(r => r.data === dateStr),
      isPlanned: !!planejados[dayKey],
      isToday: dateStr === realToday,
      isSelected: dateStr === selectedDate,
      dayNum: d.getDate(), jsDay: d.getDay(),
    };
  });

  const treinosFeitos = weekDays.filter(d => d.reg?.realizado).length;
  const treinosPlanejados = weekDays.filter(d => d.isPlanned).length;
  const isCurrentWeek = toDateBR(getMonday(new Date())) === toDateBR(startOfWeek);
  const isSelectedToday = selectedDate === realToday;

  // Day data
  const dayData = calObj.dias?.[selectedDate] || { kcal_consumido: 0, proteina_g: 0, carbo_g: 0, gordura_g: 0, fibra_g: 0, refeicoes: [] };
  const kcal = dayData.kcal_consumido || 0;
  const kcalRest = Math.max(0, meta.kcal - kcal);
  const kcalPct = meta.kcal > 0 ? Math.min(100, Math.round((kcal / meta.kcal) * 100)) : 0;
  const kcalOver = kcal > meta.kcal;

  // Week totals
  const weekKcal = weekDays.reduce((s, d) => s + (calObj.dias?.[d.dateStr]?.kcal_consumido || 0), 0);
  const metaSemana = meta.kcal * 7;

  const shiftWeek = (delta) => {
    const d = parseDateBR(selectedDate);
    d.setDate(d.getDate() + delta * 7);
    setSelectedDate(toDateBR(d));
  };

  const cardStyle = { background: c.surface, padding: "24px 16px", borderBottom: `1px solid ${c.border}` };
  const compactCardStyle = { ...cardStyle, padding: "16px 16px 20px" };
  const navBtn = (label, onClick, disabled) => (
    <button onClick={onClick} disabled={disabled} style={{
      width: "30px", height: "30px", borderRadius: "8px",
      border: `1px solid ${c.border}`, background: c.bg,
      cursor: disabled ? "default" : "pointer", fontSize: "14px",
      color: c.textSecondary, fontWeight: "700",
      display: "flex", alignItems: "center", justifyContent: "center",
      opacity: disabled ? 0.3 : 1,
    }}>{label}</button>
  );

  // selected day workout info
  const selDay = weekDays.find(d => d.isSelected);
  const selReg = selDay?.reg;
  const selPlan = selDay ? planejados[selDay.dayKey] : null;
  const hasWorkoutInfo = !!(selReg || selPlan);

  return (
    <div style={{ overflowY: "auto", height: "100%", background: c.bg }}>
      <div style={{ display: "flex", flexDirection: "column" }}>

        {/* ═══════════ SECTION 1: Week Nav + Calendar + Scoreboard ═══════════ */}
        <div style={{ background: c.surface, padding: "12px 6px 14px", borderBottom: `1px solid ${c.border}` }}>
          {/* Week label + back link */}
          <div style={{ textAlign: "center", marginBottom: "8px" }}>
            <span style={{ fontFamily: theme.headingFont, color: c.text, fontSize: "13px", fontWeight: "700" }}>
              {formatWeekLabel(startOfWeek)}
            </span>
            {!isCurrentWeek && (
              <button onClick={() => setSelectedDate(realToday)} style={{
                background: "none", border: "none", cursor: "pointer",
                fontFamily: theme.font, fontSize: "10px", color: c.primary,
                fontWeight: "600", padding: 0, marginLeft: "8px",
              }}>↩ hoje</button>
            )}
          </div>

          {/* ‹ [calendar] › — arrows flanking the 7-day strip */}
          <div style={{ display: "flex", alignItems: "center", gap: "2px", marginBottom: "10px" }}>
            <button onClick={() => shiftWeek(-1)} style={{
              width: "24px", height: "48px", background: "none", border: "none",
              cursor: "pointer", fontSize: "16px", color: c.textMuted, fontWeight: "700",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0,
            }}>‹</button>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "2px", flex: 1 }}>
              {weekDays.map(d => {
                const done = d.reg?.realizado === true;
                const missed = d.reg?.realizado === false;
                const planned = d.isPlanned && !d.reg;
                const dotColor = done ? C_DONE : missed ? C_MISSED : null;
                return (
                  <button key={d.dateStr} onClick={() => setSelectedDate(d.dateStr)} style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
                    padding: "2px 0", cursor: "pointer", background: "none", border: "none",
                  }}>
                    <span style={{
                      fontFamily: theme.font, fontSize: "9px", fontWeight: d.isToday ? "800" : "500",
                      color: d.isSelected ? c.primary : c.textMuted,
                    }}>{DAY_LABELS[d.jsDay]}</span>
                    <div style={{
                      width: "30px", height: "30px", borderRadius: "9px",
                      background: d.isSelected ? c.primary : c.bg,
                      border: planned && !d.isSelected ? `1.5px dashed ${c.primary}` : d.isToday && !d.isSelected ? `1.5px solid ${c.primary}40` : "1.5px solid transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      position: "relative", transition: "all 0.15s",
                    }}>
                      <span style={{ fontFamily: theme.font, fontSize: "12px", fontWeight: "700", color: d.isSelected ? "#FFF" : c.text }}>{d.dayNum}</span>
                      {dotColor && (
                        <span style={{
                          position: "absolute", bottom: "-3px",
                          width: "10px", height: "10px", borderRadius: "50%",
                          background: dotColor, border: `1.5px solid ${c.surface}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "6px", color: "#FFF", fontWeight: "900", lineHeight: 1,
                        }}>{done ? "✓" : "✗"}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <button onClick={() => shiftWeek(1)} disabled={isCurrentWeek} style={{
              width: "24px", height: "48px", background: "none", border: "none",
              cursor: isCurrentWeek ? "default" : "pointer", fontSize: "16px",
              color: c.textMuted, fontWeight: "700", opacity: isCurrentWeek ? 0.25 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0,
            }}>›</button>
          </div>

          {/* One-line scoreboard */}
          <div style={{
            display: "flex", justifyContent: "space-around", alignItems: "baseline",
            padding: "6px 8px", background: c.bg, borderRadius: "8px",
          }}>
            {(() => {
              const saldo = metaSemana - weekKcal;
              const saldoNeg = saldo < 0;
              return [
                { v: `${weekKcal}`, l: "kcal" },
                { v: `${saldoNeg ? "" : ""}${saldo}`, l: "saldo", color: saldoNeg ? C_MISSED : undefined },
                { v: `${treinosFeitos}/${treinosPlanejados}`, l: "treinos" },
                { v: `${treinosPlanejados > 0 ? Math.round((treinosFeitos / treinosPlanejados) * 100) : 0}%`, l: "adesão" },
              ].map((x, i) => (
                <div key={i} style={{ textAlign: "center" }}>
                  <span style={{ fontFamily: theme.headingFont, color: x.color || c.text, fontSize: "13px", fontWeight: "700" }}>{x.v}</span>
                  <div style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "8px", textTransform: "uppercase", letterSpacing: "0.03em" }}>{x.l}</div>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* ═══════════ SECTION 2: Calorias do dia selecionado ═══════════ */}
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
            <div>
              <p style={{ fontFamily: theme.headingFont, color: c.text, fontSize: "16px", fontWeight: "700", margin: 0 }}>
                🍎 {isSelectedToday ? "Calorias hoje" : `Calorias — ${fmtDay(selectedDate)}`}
              </p>
              <p style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "11px", margin: "2px 0 0" }}>{selectedDate}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: theme.headingFont, color: kcalOver ? c.danger : c.primary, fontSize: "24px", fontWeight: "700", lineHeight: "1" }}>{kcal}</div>
              <div style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "11px" }}>de {meta.kcal} kcal</div>
            </div>
          </div>

          <div style={{ position: "relative", height: "10px", background: `${c.primary}22`, borderRadius: "8px", overflow: "hidden", marginBottom: "6px" }}>
            <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${kcalPct}%`, background: kcalOver ? c.danger : c.primary, borderRadius: "8px", transition: "width 0.4s" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
            <span style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "11px" }}>{kcalPct}% da meta</span>
            <span style={{ fontFamily: theme.font, color: kcalOver ? c.danger : c.ok, fontSize: "11px", fontWeight: "600" }}>
              {kcalOver ? `+${kcal - meta.kcal} acima` : `${kcalRest} restantes`}
            </span>
          </div>

          <MacroBar label="Proteína (g)" value={dayData.proteina_g || 0} meta={meta.proteina_g} color="#4CAF50" />
          <MacroBar label="Carboidrato (g)" value={dayData.carbo_g || 0} meta={meta.carbo_g} color="#FF9800" />
          <MacroBar label="Gordura (g)" value={dayData.gordura_g || 0} meta={meta.gordura_g} color="#7E57C2" />
          <MacroBar label="Fibras (g)" value={dayData.fibra_g || 0} meta={meta.fibra_g} color="#8D6E63" />
        </div>

        {/* ═══════════ SECTION 3: Treino do dia (only if applicable) ═══════════ */}
        {hasWorkoutInfo && (
          <div style={cardStyle}>
            <p style={{ fontFamily: theme.headingFont, color: c.text, fontSize: "15px", fontWeight: "700", margin: "0 0 10px" }}>
              🏋️ Treino — {fmtDay(selectedDate)}
            </p>
            {selPlan && !selReg && (
              <p style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "13px", margin: 0 }}>
                Planejado: <strong style={{ color: c.text }}>{selPlan}</strong>
              </p>
            )}
            {selReg && (
              <div>
                <p style={{ fontFamily: theme.font, fontSize: "13px", color: selReg.realizado ? C_DONE : C_MISSED, fontWeight: "700", margin: 0 }}>
                  {selReg.realizado ? "✓ Realizado" : "✗ Não realizado"}
                  {selReg.tipo && <span style={{ color: c.text, fontWeight: "500" }}> — {selReg.tipo}</span>}
                </p>
                {selReg.notas && (
                  <p style={{ fontFamily: theme.font, color: c.textSecondary, fontSize: "12px", margin: "6px 0 0", lineHeight: "1.5" }}>{selReg.notas}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══════════ SECTION 4: Registros alimentares do dia ═══════════ */}
        {(dayData.refeicoes || []).length > 0 && (
          <div style={cardStyle}>
            <p style={{ fontFamily: theme.font, color: c.textSecondary, fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
              {isSelectedToday ? "Registrado hoje" : `Registrado — ${fmtDay(selectedDate)}`}
            </p>
            {(dayData.refeicoes || []).map((r, i) => (
              <div key={i} style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
                <span style={{ color: c.primary, fontSize: "11px", marginTop: "2px", flexShrink: 0 }}>•</span>
                <span style={{ fontFamily: theme.font, color: c.textSecondary, fontSize: "12.5px", lineHeight: "1.5" }}>{r}</span>
              </div>
            ))}
          </div>
        )}

        <p style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "11px", textAlign: "center", margin: "14px 16px 28px", fontStyle: "italic" }}>
          💬 Relate refeições e treinos no chat — o coach atualiza aqui.
        </p>
      </div>
    </div>
  );
}
