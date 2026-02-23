import { useTheme } from "../contexts/ThemeContext.jsx";
import MD from "../components/ui/MD.jsx";

const TIPO_BADGE = {
  alimento: { emoji: "🍎", label: "alimento", color: "#5A9A5A" },
  treino: { emoji: "🏋️", label: "treino", color: "#5A7EA3" },
  outro: { emoji: "📝", label: "outro", color: "#9E7F68" },
};

function parseDateBR(dateStr) {
  if (!dateStr) return new Date();
  const [d, m, y] = dateStr.split("/");
  return new Date(y, m - 1, d);
}

function toDateBR(dateObj) {
  if (!dateObj) return "";
  return dateObj.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function sumNutri(itens, onlyChecked) {
  const r = { kcal: 0, proteina_g: 0, carbo_g: 0, gordura_g: 0, fibra_g: 0 };
  for (const item of itens) {
    if (item.tipo !== "alimento" || !item.nutri) continue;
    if (onlyChecked && !item.checked) continue;
    r.kcal += item.nutri.kcal || 0;
    r.proteina_g += item.nutri.proteina_g || 0;
    r.carbo_g += item.nutri.carbo_g || 0;
    r.gordura_g += item.nutri.gordura_g || 0;
    r.fibra_g += item.nutri.fibra_g || 0;
  }
  return {
    kcal: Math.round(r.kcal),
    proteina_g: +r.proteina_g.toFixed(1),
    carbo_g: +r.carbo_g.toFixed(1),
    gordura_g: +r.gordura_g.toFixed(1),
    fibra_g: +r.fibra_g.toFixed(1)
  };
}

function getAllItens(grupos) {
  const all = [];
  for (const g of grupos) all.push(...(g.itens || []));
  return all;
}

function MiniBar({ value, max, color, theme }) {
  const c = theme.colors;
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ height: "6px", background: `${color}22`, borderRadius: "3px", overflow: "hidden", flex: 1 }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "3px", transition: "width 0.3s" }} />
    </div>
  );
}

function DaySummaryCard({ meta, planejadas, realizadas, theme }) {
  const c = theme.colors;
  const rows = [
    { label: "Kcal", key: "kcal", color: c.primary, unit: "" },
    { label: "Proteína", key: "proteina_g", color: "#5A9A5A", unit: "g" },
    { label: "Carbo", key: "carbo_g", color: "#B87850", unit: "g" },
    { label: "Gordura", key: "gordura_g", color: "#7A6AAA", unit: "g" },
    { label: "Fibras", key: "fibra_g", color: "#8D6E63", unit: "g" },
  ];

  return (
    <div style={{ background: c.surface, padding: "16px 16px", borderBottom: `1px solid ${c.border}` }}>
      {/* Header with Title Integrated */}
      <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 48px 48px 48px", gap: "2px", alignItems: "flex-end", marginBottom: "8px", paddingBottom: "6px", borderBottom: `1px solid ${c.border}` }}>
        <p style={{ gridColumn: "span 2", fontFamily: theme.headingFont, color: c.text, fontSize: "14px", fontWeight: "700", margin: 0, lineHeight: 1 }}>📊 Resumo do dia</p>
        {["Meta", "Plan.", "Feito"].map(h => (
          <span key={h} style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "8px", textTransform: "uppercase", letterSpacing: "0.03em", textAlign: "center", fontWeight: "700", paddingBottom: "1px" }}>{h}</span>
        ))}
      </div>

      {rows.map(row => {
        const nec = meta[row.key] || 0;
        const plan = planejadas[row.key] || 0;
        const real = realizadas[row.key] || 0;
        return (
          <div key={row.key} style={{ display: "grid", gridTemplateColumns: "60px 1fr 48px 48px 48px", gap: "2px", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontFamily: theme.font, color: c.textSecondary, fontSize: "11px", fontWeight: "600" }}>{row.label}</span>
            <MiniBar value={real} max={nec} color={row.color} theme={theme} />
            <span style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "10px", textAlign: "center" }}>{nec}{row.unit}</span>
            <span style={{ fontFamily: theme.font, color: c.textSecondary, fontSize: "10px", textAlign: "center" }}>{plan}{row.unit}</span>
            <span style={{ fontFamily: theme.font, color: real >= nec ? "#5A9A5A" : c.text, fontSize: "10px", textAlign: "center", fontWeight: "700" }}>{real}{row.unit}</span>
          </div>
        );
      })}
    </div>
  );
}

function PlanItem({ item, onToggle, theme }) {
  const c = theme.colors;
  const badge = TIPO_BADGE[item.tipo] || TIPO_BADGE.outro;

  return (
    <div
      onClick={() => onToggle(item.id)}
      style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "10px 12px", cursor: "pointer", borderRadius: "12px", background: item.checked ? `${c.primary}08` : "transparent", transition: "background 0.2s", marginBottom: "2px" }}
    >
      {/* Checkbox */}
      <div style={{
        width: "22px", height: "22px", borderRadius: "7px", flexShrink: 0, marginTop: "1px",
        border: item.checked ? "none" : `2px solid ${c.textMuted}40`,
        background: item.checked ? "#5A9A5A" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.2s",
      }}>
        {item.checked && <span style={{ color: "#FFF", fontSize: "13px", lineHeight: 1 }}>✓</span>}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ lineHeight: "1.4" }}>
          <span style={{
            fontSize: "12.5px",
            display: "inline-block", marginRight: "5px", verticalAlign: "baseline",
            opacity: item.checked ? 0.3 : 0.75, transition: "opacity 0.2s"
          }}>
            {badge.emoji}
          </span>
          <span style={{
            fontFamily: theme.font, fontSize: "13.5px",
            color: item.checked ? c.textMuted : c.text,
            textDecoration: item.checked ? "line-through" : "none",
            opacity: item.checked ? 0.7 : 1,
            transition: "all 0.2s",
            wordBreak: "break-word"
          }}>
            {item.texto}
          </span>
        </div>
        {item.tipo === "alimento" && item.nutri && (
          <div style={{ display: "flex", gap: "8px", marginTop: "3px", flexWrap: "wrap" }}>
            {[
              { v: item.nutri.kcal, u: "kcal", cl: c.primary },
              { v: item.nutri.proteina_g, u: "p", cl: "#5A9A5A" },
              { v: item.nutri.carbo_g, u: "c", cl: "#B87850" },
              { v: item.nutri.gordura_g, u: "g", cl: "#7A6AAA" },
              { v: item.nutri.fibra_g, u: "f", cl: "#8D6E63" },
            ].map(n => (
              <span key={n.u} style={{ fontFamily: theme.font, fontSize: "10.5px", color: n.cl, fontWeight: "600", opacity: item.checked ? 0.5 : 0.8 }}>
                {n.v}{n.u}
              </span>
            ))}
          </div>
        )}
        {item.tipo === "treino" && (
          <span style={{ fontFamily: theme.font, fontSize: "10.5px", color: "#5A7EA3", fontWeight: "600", opacity: item.checked ? 0.5 : 0.8 }}>
            {item.treino_tipo || item.texto} · {item.duracao_min || 60}min
          </span>
        )}
      </div>
    </div>
  );
}

function GrupoCard({ grupo, onToggle, theme }) {
  const c = theme.colors;
  const itens = grupo.itens || [];
  const done = itens.filter(i => i.checked).length;
  const total = itens.length;
  const grupoNutriPlan = sumNutri(itens, false);
  const grupoNutriDone = sumNutri(itens, true);
  const hasNutri = grupoNutriPlan.kcal > 0;

  return (
    <div style={{ background: c.surface, padding: "14px 16px", borderBottom: `1px solid ${c.border}` }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "18px" }}>{grupo.emoji || "📋"}</span>
          <span style={{ fontFamily: theme.headingFont, color: c.text, fontSize: "14px", fontWeight: "700" }}>{grupo.nome}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {hasNutri && (
            <span style={{ fontFamily: theme.font, fontSize: "10px", color: c.textMuted }}>
              {grupoNutriDone.kcal}/{grupoNutriPlan.kcal}kcal
            </span>
          )}
          <span style={{
            fontFamily: theme.font, fontSize: "11px", fontWeight: "700",
            color: done === total && total > 0 ? "#5A9A5A" : c.primary,
            background: done === total && total > 0 ? "#5A9A5A18" : `${c.primary}15`,
            padding: "2px 8px", borderRadius: "8px",
          }}>
            {done}/{total}
          </span>
        </div>
      </div>

      {/* Progress bar for grupo */}
      {total > 0 && (
        <div style={{ height: "3px", background: `${c.primary}15`, borderRadius: "2px", overflow: "hidden", marginBottom: "8px" }}>
          <div style={{ height: "100%", width: `${Math.round((done / total) * 100)}%`, background: done === total ? "#5A9A5A" : c.primary, borderRadius: "2px", transition: "width 0.3s" }} />
        </div>
      )}

      {/* Itens */}
      {itens.map(item => (
        <PlanItem key={item.id} item={item} onToggle={onToggle} theme={theme} />
      ))}
    </div>
  );
}

export default function PlanoView({ planoDictStr, cal, onGeneratePlan, generating, onToggleItem, selectedDate, setSelectedDate }) {
  const { theme } = useTheme();
  const c = theme.colors;

  // Parse plano dict (handles both old flat and new dict formats)
  let planoDict = {};
  let planoObj = null;
  try {
    const parsed = JSON.parse(planoDictStr || "{}");
    if (parsed.grupos) {
      // Old flat format — wrap into dict
      const oldDate = parsed.date || selectedDate;
      planoDict = { [oldDate]: parsed };
    } else {
      planoDict = parsed;
    }
    const p = planoDict[selectedDate];
    if (p && p.grupos) planoObj = p;
  } catch { /* fallback */ }

  // Totals (only if plan exists for selected date)
  const allItens = planoObj ? getAllItens(planoObj.grupos) : [];
  const meta = planoObj?.meta || { kcal: 1450, proteina_g: 115, carbo_g: 110, gordura_g: 45, fibra_g: 25 };
  const planejadas = planoObj ? sumNutri(allItens, false) : null;
  const realizadas = planoObj ? sumNutri(allItens, true) : null;
  const totalItens = allItens.length;
  const totalDone = allItens.filter(i => i.checked).length;

  return (
    <div style={{ overflowY: "auto", overflowX: "hidden", height: "100%", background: c.bg }}>
      <div style={{ padding: "0 0 28px", display: "flex", flexDirection: "column" }}>

        <PlanHeader
          theme={theme}
          planoDict={planoDict}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          onGeneratePlan={onGeneratePlan}
          generating={generating}
          totalDone={totalDone}
          totalItens={totalItens}
          hasPlano={!!planoObj}
        />

        {planoObj ? (
          <>
            <DaySummaryCard meta={meta} planejadas={planejadas} realizadas={realizadas} theme={theme} />
            {planoObj.grupos.map((grupo, i) => (
              <GrupoCard key={grupo.nome + i} grupo={grupo} onToggle={onToggleItem} theme={theme} />
            ))}
            <p style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "12px", textAlign: "center", marginTop: "14px" }}>
              ✏️ Marque itens conforme realiza. O coach atualiza o plano pelo chat.
            </p>
          </>
        ) : (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px", opacity: 0.4 }}>📋</div>
            <p style={{ fontFamily: theme.headingFont, color: c.textSecondary, fontSize: "15px", fontWeight: "600", marginBottom: "6px" }}>
              Nenhum plano para esta data
            </p>
            <p style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "12px", lineHeight: "1.5" }}>
              Toque em <b>✨ Gerar plano</b> para criar um plano personalizado.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   PlanHeader — Mini-week strip + title + generate button
   Consistent height regardless of plan state
   ────────────────────────────────────────────────────────────────── */
function PlanHeader({ theme, planoDict, selectedDate, setSelectedDate, onGeneratePlan, generating, totalDone, totalItens, hasPlano }) {
  const c = theme.colors;
  const DAY_LETTERS = ["D", "S", "T", "Q", "Q", "S", "S"];
  const todayStr = toDateBR(new Date());
  const isToday = selectedDate === todayStr;

  // Build the week around the selected date (Mon–Sun)
  const selDate = parseDateBR(selectedDate);
  const jsDay = selDate.getDay(); // 0=Sun
  const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay;
  const monday = new Date(selDate);
  monday.setDate(selDate.getDate() + mondayOffset);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = toDateBR(d);
    const dayPlan = planoDict[dateStr];
    const hasPlan = !!(dayPlan && dayPlan.grupos && dayPlan.grupos.length > 0);
    let status = "empty"; // no plan
    if (hasPlan) {
      const items = getAllItens(dayPlan.grupos);
      const doneCount = items.filter(x => x.checked).length;
      status = doneCount === items.length && items.length > 0 ? "done" : "has_plan";
    }
    return {
      dateStr,
      dayNum: d.getDate(),
      jsDay: d.getDay(),
      isToday: dateStr === todayStr,
      isSelected: dateStr === selectedDate,
      status,
    };
  });

  // Week range label  e.g. "17 – 23 Fev"
  const firstDay = weekDays[0];
  const lastDay = weekDays[6];
  const monthName = parseDateBR(lastDay.dateStr).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  const weekLabel = `${firstDay.dayNum} – ${lastDay.dayNum} ${monthName}`;

  const changeWeek = (dir) => {
    const d = parseDateBR(selectedDate);
    d.setDate(d.getDate() + dir * 7);
    setSelectedDate(toDateBR(d));
  };

  const hasProgress = totalItens > 0;
  const allDone = hasProgress && totalDone === totalItens;
  const formattedSelected = parseDateBR(selectedDate).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  return (
    <div style={{ background: `linear-gradient(135deg,${c.primaryLight}20,${c.primary}15)`, borderBottom: `1px solid ${c.primary}30`, padding: "10px 12px 8px", overflow: "hidden" }}>

      {/* Week label + back to today */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
        <span style={{ fontFamily: theme.headingFont, color: c.textSecondary, fontSize: "11px", fontWeight: "600", letterSpacing: "0.02em" }}>
          {weekLabel}
        </span>
        {!isToday && (
          <button onClick={() => setSelectedDate(todayStr)} style={{ background: "transparent", border: "none", color: c.primary, fontSize: "11px", cursor: "pointer", fontFamily: theme.font, fontWeight: "600" }}>
            ↩ Hoje
          </button>
        )}
      </div>

      {/* Mini-week strip */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: "8px" }}>
        <button onClick={() => changeWeek(-1)} style={{ background: "transparent", border: "none", color: c.textMuted, fontSize: "14px", cursor: "pointer", padding: "2px 4px 2px 0", lineHeight: 1, flexShrink: 0 }}>‹</button>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", flex: 1, minWidth: 0 }}>
          {weekDays.map(d => {
            const dotColor = d.status === "done" ? "#5A9A5A" : d.status === "has_plan" ? c.primary : `${c.textMuted}40`;
            return (
              <button
                key={d.dateStr}
                onClick={() => setSelectedDate(d.dateStr)}
                style={{
                  background: "transparent", border: "none", cursor: "pointer", padding: "1px 0",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: "1px",
                }}
              >
                <span style={{ fontFamily: theme.font, fontSize: "9px", color: c.textMuted, fontWeight: d.isToday ? "700" : "400", lineHeight: 1 }}>
                  {DAY_LETTERS[d.jsDay]}
                </span>
                <div style={{
                  width: "26px", height: "26px", borderRadius: "8px",
                  background: d.isSelected ? c.primary : "transparent",
                  border: d.isToday && !d.isSelected ? `2px solid ${c.primary}` : d.isSelected ? "none" : `1px solid ${c.textMuted}25`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s",
                }}>
                  <span style={{
                    fontFamily: theme.headingFont, fontSize: "11px", fontWeight: "700", lineHeight: 1,
                    color: d.isSelected ? "#FFF" : d.isToday ? c.primary : c.text,
                  }}>
                    {d.dayNum}
                  </span>
                </div>
                <div style={{
                  width: "4px", height: "4px", borderRadius: "50%",
                  background: dotColor,
                  transition: "background 0.2s",
                }} />
              </button>
            );
          })}
        </div>
        <button onClick={() => changeWeek(1)} style={{ background: "transparent", border: "none", color: c.textMuted, fontSize: "14px", cursor: "pointer", padding: "2px 0 2px 4px", lineHeight: 1, flexShrink: 0 }}>›</button>
      </div>

      {/* Title + Generate button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
        <div>
          <p style={{ fontFamily: theme.headingFont, color: c.text, fontSize: "14px", fontWeight: "700", lineHeight: "1.2" }}>
            Plano Alimentar
            {hasProgress && <span style={{ fontFamily: theme.font, color: allDone ? "#5A9A5A" : c.primary, fontSize: "11px", fontWeight: "700", marginLeft: "8px" }}>{allDone ? "✅ Completo" : `${totalDone}/${totalItens}`}</span>}
          </p>
          <p style={{ fontFamily: theme.font, color: c.textSecondary, fontSize: "10px", textTransform: "capitalize", lineHeight: "1.3", marginTop: "1px" }}>
            {formattedSelected}{!hasProgress && <span style={{ color: c.textMuted, marginLeft: "6px" }}>· sem plano</span>}
          </p>
        </div>
        <button onClick={onGeneratePlan} disabled={generating}
          style={{ padding: "8px 14px", background: generating ? `${c.primaryLight}80` : c.primary, color: "#FFF", border: "none", borderRadius: "10px", fontFamily: theme.font, fontSize: "12px", fontWeight: "700", cursor: generating ? "not-allowed" : "pointer", whiteSpace: "nowrap", flexShrink: 0, display: "flex", alignItems: "center", gap: "5px", boxShadow: `0 2px 8px ${c.primary}35` }}>
          {generating ? <><span style={{ display: "inline-block", animation: "bounce 1s infinite", fontSize: "13px" }}>🌿</span> Gerando...</> : "✨ Gerar plano"}
        </button>
      </div>
    </div>
  );
}
