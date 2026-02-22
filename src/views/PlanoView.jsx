import { useTheme } from "../contexts/ThemeContext.jsx";
import MD from "../components/ui/MD.jsx";

const TIPO_BADGE = {
  alimento: { emoji: "🍎", label: "alimento", color: "#5A9A5A" },
  treino: { emoji: "🏋️", label: "treino", color: "#5A7EA3" },
  outro: { emoji: "📝", label: "outro", color: "#9E7F68" },
};

function sumNutri(itens, onlyChecked) {
  const r = { kcal: 0, proteina_g: 0, carbo_g: 0, gordura_g: 0 };
  for (const item of itens) {
    if (item.tipo !== "alimento" || !item.nutri) continue;
    if (onlyChecked && !item.checked) continue;
    r.kcal += item.nutri.kcal || 0;
    r.proteina_g += item.nutri.proteina_g || 0;
    r.carbo_g += item.nutri.carbo_g || 0;
    r.gordura_g += item.nutri.gordura_g || 0;
  }
  return { kcal: Math.round(r.kcal), proteina_g: +r.proteina_g.toFixed(1), carbo_g: +r.carbo_g.toFixed(1), gordura_g: +r.gordura_g.toFixed(1) };
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
  ];

  return (
    <div style={{ background: c.surface, borderRadius: "18px", padding: "16px", marginBottom: "12px", border: `1px solid ${c.border}`, boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
      <p style={{ fontFamily: theme.headingFont, color: c.text, fontSize: "15px", fontWeight: "700", marginBottom: "12px" }}>📊 Resumo do dia</p>

      {/* Header */}
      <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 60px 60px 60px", gap: "4px", marginBottom: "8px", paddingBottom: "6px", borderBottom: `1px solid ${c.border}` }}>
        <span />
        <span />
        {["Necessárias", "Planejadas", "Realizadas"].map(h => (
          <span key={h} style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.03em", textAlign: "center", fontWeight: "700" }}>{h}</span>
        ))}
      </div>

      {rows.map(row => {
        const nec = meta[row.key] || 0;
        const plan = planejadas[row.key] || 0;
        const real = realizadas[row.key] || 0;
        return (
          <div key={row.key} style={{ display: "grid", gridTemplateColumns: "80px 1fr 60px 60px 60px", gap: "4px", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontFamily: theme.font, color: c.textSecondary, fontSize: "12px", fontWeight: "600" }}>{row.label}</span>
            <MiniBar value={real} max={nec} color={row.color} theme={theme} />
            <span style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "11px", textAlign: "center" }}>{nec}{row.unit}</span>
            <span style={{ fontFamily: theme.font, color: c.textSecondary, fontSize: "11px", textAlign: "center" }}>{plan}{row.unit}</span>
            <span style={{ fontFamily: theme.font, color: real >= nec ? "#5A9A5A" : c.text, fontSize: "11px", textAlign: "center", fontWeight: "700" }}>{real}{row.unit}</span>
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
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          <span style={{
            fontFamily: theme.font, fontSize: "13.5px", lineHeight: "1.4",
            color: item.checked ? c.textMuted : c.text,
            textDecoration: item.checked ? "line-through" : "none",
            opacity: item.checked ? 0.7 : 1,
            transition: "all 0.2s",
          }}>
            {item.texto}
          </span>
          <span style={{
            fontSize: "9px", fontFamily: theme.font, padding: "1px 6px", borderRadius: "6px",
            background: `${badge.color}18`, color: badge.color, fontWeight: "600",
            whiteSpace: "nowrap",
          }}>
            {badge.emoji} {badge.label}
          </span>
        </div>
        {item.tipo === "alimento" && item.nutri && (
          <div style={{ display: "flex", gap: "8px", marginTop: "3px", flexWrap: "wrap" }}>
            {[
              { v: item.nutri.kcal, u: "kcal", cl: c.primary },
              { v: item.nutri.proteina_g, u: "p", cl: "#5A9A5A" },
              { v: item.nutri.carbo_g, u: "c", cl: "#B87850" },
              { v: item.nutri.gordura_g, u: "g", cl: "#7A6AAA" },
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
    <div style={{ background: c.surface, borderRadius: "16px", padding: "14px 14px 10px", marginBottom: "10px", border: `1px solid ${c.border}`, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
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

export default function PlanoView({ plano, cal, onGeneratePlan, generating, onToggleItem }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  // Accept plano as object or JSON string, fallback to markdown
  let planoObj = null;
  if (plano && typeof plano === "object" && plano.grupos) {
    planoObj = plano;
  } else if (typeof plano === "string") {
    try {
      const parsed = JSON.parse(plano);
      if (parsed && parsed.grupos) planoObj = parsed;
    } catch { /* markdown fallback */ }
  }

  // Markdown fallback
  if (!planoObj) {
    return (
      <div style={{ overflowY: "auto", height: "100%", background: c.bg }}>
        <div style={{ padding: "14px 16px 28px" }}>
          <GenerateBar theme={theme} today={today} onGeneratePlan={onGeneratePlan} generating={generating} />
          <div style={{ background: c.surface, borderRadius: "16px", padding: "18px", border: `1px solid ${c.border}`, boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
            <MD content={plano} />
          </div>
          <p style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "12px", textAlign: "center", marginTop: "14px" }}>
            ✨ Gere um novo plano para ativar o modo interativo.
          </p>
        </div>
      </div>
    );
  }

  // Calculate totals
  const allItens = getAllItens(planoObj.grupos);
  const meta = planoObj.meta || { kcal: 1450, proteina_g: 115, carbo_g: 110, gordura_g: 45 };
  const planejadas = sumNutri(allItens, false);
  const realizadas = sumNutri(allItens, true);
  const totalItens = allItens.length;
  const totalDone = allItens.filter(i => i.checked).length;

  return (
    <div style={{ overflowY: "auto", height: "100%", background: c.bg }}>
      <div style={{ padding: "14px 16px 28px" }}>

        <GenerateBar theme={theme} today={today} onGeneratePlan={onGeneratePlan} generating={generating} totalDone={totalDone} totalItens={totalItens} />

        <DaySummaryCard meta={meta} planejadas={planejadas} realizadas={realizadas} theme={theme} />

        {planoObj.grupos.map((grupo, i) => (
          <GrupoCard key={grupo.nome + i} grupo={grupo} onToggle={onToggleItem} theme={theme} />
        ))}

        <p style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "12px", textAlign: "center", marginTop: "14px" }}>
          ✏️ Marque itens conforme realiza. O coach atualiza o plano pelo chat.
        </p>
      </div>
    </div>
  );
}

function GenerateBar({ theme, today, onGeneratePlan, generating, totalDone, totalItens }) {
  const c = theme.colors;
  const hasProgress = totalItens !== undefined && totalItens > 0;
  const allDone = hasProgress && totalDone === totalItens;

  return (
    <div style={{ background: `linear-gradient(135deg,${c.primaryLight}22,${c.primary}18)`, border: `1.5px solid ${c.primary}40`, borderRadius: "18px", padding: "16px", marginBottom: "14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
        <div>
          <p style={{ fontFamily: theme.headingFont, color: c.text, fontSize: "15px", fontWeight: "700", marginBottom: "4px" }}>📅 Plano de hoje</p>
          <p style={{ fontFamily: theme.font, color: c.textSecondary, fontSize: "12px", lineHeight: "1.5", textTransform: "capitalize" }}>{today}</p>
          {hasProgress && (
            <p style={{ fontFamily: theme.font, color: allDone ? "#5A9A5A" : c.primary, fontSize: "12px", fontWeight: "700", marginTop: "4px" }}>
              {allDone ? "✅ Tudo concluído!" : `${totalDone}/${totalItens} itens feitos`}
            </p>
          )}
        </div>
        <button onClick={onGeneratePlan} disabled={generating}
          style={{ padding: "10px 16px", background: generating ? `${c.primaryLight}80` : c.primary, color: "#FFF", border: "none", borderRadius: "12px", fontFamily: theme.font, fontSize: "13px", fontWeight: "700", cursor: generating ? "not-allowed" : "pointer", whiteSpace: "nowrap", flexShrink: 0, display: "flex", alignItems: "center", gap: "6px", boxShadow: `0 3px 12px ${c.primary}35` }}>
          {generating ? <><span style={{ display: "inline-block", animation: "bounce 1s infinite", fontSize: "14px" }}>🌿</span> Gerando...</> : "✨ Gerar plano"}
        </button>
      </div>
    </div>
  );
}
