import { useMemo } from "react";
import { useTheme } from "../contexts/ThemeContext.jsx";
import { parseDateBR, toDateBR } from "../utils/healthModel.js";
import MacroBar from "../components/ui/MacroBar.jsx";
import WeightTrendChart from "../components/saude/WeightTrendChart.jsx";
import CircunferenciasCard from "../components/saude/CircunferenciasCard.jsx";
import NovaMedicaoForm from "../components/saude/NovaMedicaoForm.jsx";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const DAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];
const C_DONE = "#4CAF50";
const C_MISSED = "#E53935";

function formatWeekLabel(dateStr) {
  const start = parseDateBR(dateStr);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return start.getMonth() === end.getMonth()
    ? `${start.getDate()} – ${end.getDate()} ${MESES[start.getMonth()]}`
    : `${start.getDate()} ${MESES[start.getMonth()]} – ${end.getDate()} ${MESES[end.getMonth()]}`;
}

function fmtDay(dateStr) {
  const date = parseDateBR(dateStr);
  return `${date.getDate()} ${MESES[date.getMonth()]}`;
}

export default function SaudeView({ selectedDate, setSelectedDate, viewModel, medidas, perfil, onAddMedida }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const {
    realToday,
    meta,
    weekDays,
    dayData,
    selectedPlannedWorkouts,
    completedPlanItems,
    complementaryLogs,
    weekKcal,
    metaSemana,
    treinosFeitos,
    treinosPlanejados,
    isCurrentWeek,
    isSelectedToday,
  } = viewModel;

  const medidasArr = useMemo(() => {
    try { return JSON.parse(medidas || "[]"); } catch { return []; }
  }, [medidas]);
  const perfilObj = useMemo(() => {
    try { return JSON.parse(perfil || "{}"); } catch { return {}; }
  }, [perfil]);

  const kcal = dayData.kcal_consumido || 0;
  const kcalRest = Math.max(0, meta.kcal - kcal);
  const kcalPct = meta.kcal > 0 ? Math.min(100, Math.round((kcal / meta.kcal) * 100)) : 0;
  const kcalOver = kcal > meta.kcal;
  const hasWorkoutInfo = selectedPlannedWorkouts.length > 0 || completedPlanItems.length > 0 || complementaryLogs.length > 0;

  const shiftWeek = (delta) => {
    const date = parseDateBR(selectedDate);
    date.setDate(date.getDate() + delta * 7);
    setSelectedDate(toDateBR(date));
  };

  const cardStyle = { background: c.surface, padding: "24px 16px", borderBottom: `1px solid ${c.border}` };

  return (
    <div style={{ overflowY: "auto", height: "100%", background: c.bg }}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ background: c.surface, padding: "12px 6px 14px", borderBottom: `1px solid ${c.border}` }}>
          <div style={{ textAlign: "center", marginBottom: "8px" }}>
            <span style={{ fontFamily: theme.headingFont, color: c.text, fontSize: "13px", fontWeight: "700" }}>
              {formatWeekLabel(weekDays[0]?.dateStr || selectedDate)}
            </span>
            {!isCurrentWeek && (
              <button
                onClick={() => setSelectedDate(realToday)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: theme.font,
                  fontSize: "10px",
                  color: c.primary,
                  fontWeight: "600",
                  padding: 0,
                  marginLeft: "8px",
                }}
              >
                ↩ hoje
              </button>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "2px", marginBottom: "10px" }}>
            <button
              onClick={() => shiftWeek(-1)}
              style={{
                width: "24px",
                height: "48px",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "16px",
                color: c.textMuted,
                fontWeight: "700",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                padding: 0,
              }}
            >
              ‹
            </button>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "2px", flex: 1 }}>
              {weekDays.map((day) => {
                const done = day.completedWorkoutCount > 0;
                const missed = !done && day.missedWorkoutCount > 0;
                const planned = day.isPlanned && !done && !missed;
                const dotColor = done ? C_DONE : missed ? C_MISSED : null;
                return (
                  <button
                    key={day.dateStr}
                    onClick={() => setSelectedDate(day.dateStr)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "2px",
                      padding: "2px 0",
                      cursor: "pointer",
                      background: "none",
                      border: "none",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: theme.font,
                        fontSize: "9px",
                        fontWeight: day.isToday ? "800" : "500",
                        color: day.isSelected ? c.primary : c.textMuted,
                      }}
                    >
                      {DAY_LABELS[day.jsDay]}
                    </span>
                    <div
                      style={{
                        width: "30px",
                        height: "30px",
                        borderRadius: "9px",
                        background: day.isSelected ? c.primary : c.bg,
                        border: planned && !day.isSelected
                          ? `1.5px dashed ${c.primary}`
                          : day.isToday && !day.isSelected
                            ? `1.5px solid ${c.primary}40`
                            : "1.5px solid transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                        transition: "all 0.15s",
                      }}
                    >
                      <span style={{ fontFamily: theme.font, fontSize: "12px", fontWeight: "700", color: day.isSelected ? "#FFF" : c.text }}>
                        {day.dayNum}
                      </span>
                      {dotColor && (
                        <span
                          style={{
                            position: "absolute",
                            bottom: "-3px",
                            width: "10px",
                            height: "10px",
                            borderRadius: "50%",
                            background: dotColor,
                            border: `1.5px solid ${c.surface}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "6px",
                            color: "#FFF",
                            fontWeight: "900",
                            lineHeight: 1,
                          }}
                        >
                          {done ? "✓" : "✗"}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => shiftWeek(1)}
              disabled={isCurrentWeek}
              style={{
                width: "24px",
                height: "48px",
                background: "none",
                border: "none",
                cursor: isCurrentWeek ? "default" : "pointer",
                fontSize: "16px",
                color: c.textMuted,
                fontWeight: "700",
                opacity: isCurrentWeek ? 0.25 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                padding: 0,
              }}
            >
              ›
            </button>
          </div>

          <div style={{ display: "flex", justifyContent: "space-around", alignItems: "baseline", padding: "6px 8px", background: c.bg, borderRadius: "8px" }}>
            {(() => {
              const saldo = metaSemana - weekKcal;
              const saldoNeg = saldo < 0;
              return [
                { v: `${weekKcal}`, l: "kcal" },
                { v: `${saldo}`, l: "saldo", color: saldoNeg ? C_MISSED : undefined },
                { v: `${treinosFeitos}/${treinosPlanejados}`, l: "treinos" },
                { v: `${treinosPlanejados > 0 ? Math.round((treinosFeitos / treinosPlanejados) * 100) : 0}%`, l: "adesão" },
              ].map((entry, index) => (
                <div key={index} style={{ textAlign: "center" }}>
                  <span style={{ fontFamily: theme.headingFont, color: entry.color || c.text, fontSize: "13px", fontWeight: "700" }}>{entry.v}</span>
                  <div style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "8px", textTransform: "uppercase", letterSpacing: "0.03em" }}>{entry.l}</div>
                </div>
              ));
            })()}
          </div>
        </div>

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
              <div style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "9px", fontStyle: "italic" }}>baseado no seu perfil</div>
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

        {(() => {
          if (medidasArr.length === 0 && !onAddMedida) return null;

          const latest = medidasArr.length > 0 ? medidasArr[medidasArr.length - 1] : null;
          const previous = medidasArr.length > 1 ? medidasArr[medidasArr.length - 2] : null;
          const pesoDelta = latest && previous && latest.peso_kg && previous.peso_kg
            ? (latest.peso_kg - previous.peso_kg).toFixed(1) : null;
          const gordDelta = latest && previous && latest.gordura_pct && previous.gordura_pct
            ? (latest.gordura_pct - previous.gordura_pct).toFixed(1) : null;

          return (
            <div style={cardStyle}>
              <p style={{ fontFamily: theme.headingFont, color: c.text, fontSize: "15px", fontWeight: "700", margin: "0 0 12px" }}>
                📊 Composição Corporal
              </p>

              {latest && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "14px" }}>
                  <div style={{ padding: "10px 12px", background: c.bg, borderRadius: "12px" }}>
                    <div style={{ fontFamily: theme.font, fontSize: "10px", color: c.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Peso</div>
                    <div style={{ fontFamily: theme.headingFont, fontSize: "20px", fontWeight: "700", color: c.text }}>
                      {latest.peso_kg || "—"}<span style={{ fontSize: "12px", fontWeight: "400" }}>kg</span>
                      {pesoDelta && (
                        <span style={{ fontSize: "11px", marginLeft: "6px", color: Number(pesoDelta) <= 0 ? c.ok : c.danger }}>
                          {Number(pesoDelta) > 0 ? "+" : ""}{pesoDelta}
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: theme.font, fontSize: "10px", color: c.textMuted }}>
                      Meta: {perfilObj.meta_peso_min || "?"}-{perfilObj.meta_peso_max || "?"}kg
                    </div>
                  </div>
                  <div style={{ padding: "10px 12px", background: c.bg, borderRadius: "12px" }}>
                    <div style={{ fontFamily: theme.font, fontSize: "10px", color: c.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Gordura</div>
                    <div style={{ fontFamily: theme.headingFont, fontSize: "20px", fontWeight: "700", color: c.text }}>
                      {latest.gordura_pct || "—"}<span style={{ fontSize: "12px", fontWeight: "400" }}>%</span>
                      {gordDelta && (
                        <span style={{ fontSize: "11px", marginLeft: "6px", color: Number(gordDelta) <= 0 ? c.ok : c.danger }}>
                          {Number(gordDelta) > 0 ? "+" : ""}{gordDelta}
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: theme.font, fontSize: "10px", color: c.textMuted }}>
                      Meta: {"<"}{perfilObj.meta_gordura_pct || "?"}%
                    </div>
                  </div>
                </div>
              )}

              <WeightTrendChart
                entries={medidasArr.filter(m => m.peso_kg)}
                metaMin={perfilObj.meta_peso_min}
                metaMax={perfilObj.meta_peso_max}
                theme={theme}
              />

              {latest?.circunferencias && Object.keys(latest.circunferencias).length > 0 && (
                <CircunferenciasCard
                  latest={latest.circunferencias}
                  previous={previous?.circunferencias}
                  theme={theme}
                />
              )}

              {onAddMedida && (
                <div style={{ marginTop: "14px" }}>
                  <NovaMedicaoForm onSave={onAddMedida} theme={theme} />
                </div>
              )}
            </div>
          );
        })()}

        {hasWorkoutInfo && (
          <div style={cardStyle}>
            <p style={{ fontFamily: theme.headingFont, color: c.text, fontSize: "15px", fontWeight: "700", margin: "0 0 10px" }}>
              🏋️ Treino — {fmtDay(selectedDate)}
            </p>

            {selectedPlannedWorkouts.length > 0 && (
              <div style={{ marginBottom: "10px" }}>
                {selectedPlannedWorkouts.map((entry, index) => (
                  <p key={`planned-${index}`} style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "13px", margin: index === 0 ? 0 : "6px 0 0" }}>
                    Planejado: <strong style={{ color: c.text }}>{entry.label}</strong>
                  </p>
                ))}
              </div>
            )}

            {completedPlanItems.length > 0 && completedPlanItems.map((entry) => (
              <p key={entry.id} style={{ fontFamily: theme.font, fontSize: "13px", color: C_DONE, fontWeight: "700", margin: "0 0 6px" }}>
                ✓ Realizado — <span style={{ color: c.text, fontWeight: "500" }}>{entry.tipo}</span>
              </p>
            ))}

            {complementaryLogs.map((entry) => (
              <div key={entry.id} style={{ marginTop: "6px" }}>
                <p style={{ fontFamily: theme.font, fontSize: "13px", color: entry.realizado ? C_DONE : C_MISSED, fontWeight: "700", margin: 0 }}>
                  {entry.realizado ? "✓ Realizado" : "✗ Não realizado"}
                  <span style={{ color: c.text, fontWeight: "500" }}> — {entry.tipo}</span>
                </p>
                {entry.notas && (
                  <p style={{ fontFamily: theme.font, color: c.textSecondary, fontSize: "12px", margin: "6px 0 0", lineHeight: "1.5" }}>
                    {entry.notas}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {dayData.refeicoes.length > 0 && (
          <div style={cardStyle}>
            <p style={{ fontFamily: theme.font, color: c.textSecondary, fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
              {isSelectedToday ? "Registrado hoje" : `Registrado — ${fmtDay(selectedDate)}`}
            </p>
            {dayData.refeicoes.map((entry) => (
              <div key={entry.id} style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
                <span style={{ color: c.primary, fontSize: "11px", marginTop: "2px", flexShrink: 0 }}>•</span>
                <span style={{ fontFamily: theme.font, color: c.textSecondary, fontSize: "12.5px", lineHeight: "1.5" }}>{entry.text}</span>
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
