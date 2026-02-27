import { useEffect, useRef, useState } from "react";
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

export default function PlanoView({
  planoDictStr,
  cal,
  onGeneratePlan,
  onEditPlan,
  onNewPlan,
  onRemovePlan,
  removingPlan = false,
  onOpenPlanHistory,
  planHistoryOpen,
  setPlanHistoryOpen,
  planHistoryItems = [],
  planHistoryLoading = false,
  onOpenPlanVersion,
  generating,
  onToggleItem,
  selectedDate,
  setSelectedDate,
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [showRemoveModal, setShowRemoveModal] = useState(false);

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
          onEditPlan={onEditPlan}
          onNewPlan={onNewPlan}
          onRequestRemovePlan={() => setShowRemoveModal(true)}
          removingPlan={removingPlan}
          onOpenPlanHistory={onOpenPlanHistory}
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

      <PlanHistoryDrawer
        theme={theme}
        open={!!planHistoryOpen}
        onClose={() => setPlanHistoryOpen?.(false)}
        items={planHistoryItems}
        loading={planHistoryLoading}
        selectedDate={selectedDate}
        onOpenVersion={onOpenPlanVersion}
      />

      <ConfirmRemovePlanModal
        theme={theme}
        open={showRemoveModal}
        date={selectedDate}
        loading={removingPlan}
        onClose={() => setShowRemoveModal(false)}
        onConfirm={async () => {
          const removed = await onRemovePlan?.();
          if (removed !== false) {
            setShowRemoveModal(false);
          }
        }}
      />
    </div>
  );
}

function PlanHistoryDrawer({ theme, open, onClose, items, loading, selectedDate, onOpenVersion }) {
  const c = theme.colors;
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        top: "calc(var(--pt-header-height) + 8px)",
        width: "min(100%, var(--pt-app-max-width))",
        padding: "0 8px",
        zIndex: 1250,
      }}
    >
      <div style={{
        background: c.surface,
        borderRadius: "16px",
        border: `1px solid ${c.border}`,
        maxHeight: "calc(100vh - var(--pt-header-height) - var(--pt-bottom-nav-height) - 16px)",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 12px 28px rgba(0,0,0,0.18)",
      }}>
        <div style={{ padding: "12px 14px 8px", borderBottom: `1px solid ${c.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
            <div>
              <h3 style={{ fontFamily: theme.headingFont, color: c.text, fontSize: "16px", fontWeight: "700" }}>Histórico de versões</h3>
              <p style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "11px", marginTop: "2px" }}>
                Plano de {selectedDate}
              </p>
            </div>
            <button onClick={onClose} style={{ width: "32px", height: "32px", borderRadius: "50%", border: `1px solid ${c.border}`, background: c.bg, cursor: "pointer", fontSize: "14px" }}>✕</button>
          </div>
        </div>
        <div style={{ padding: "12px 14px 16px", overflowY: "auto" }}>
          {loading && (
            <div style={{ textAlign: "center", padding: "18px 8px", color: c.textMuted, fontFamily: theme.font, fontSize: "12px" }}>
              Carregando versões...
            </div>
          )}

          {!loading && items.length === 0 && (
            <div style={{ textAlign: "center", padding: "28px 12px", color: c.textMuted }}>
              <div style={{ fontSize: "28px", marginBottom: "8px", opacity: 0.5 }}>🗂️</div>
              <p style={{ fontFamily: theme.font, fontSize: "12px" }}>Nenhuma conversa de plano salva para essa data.</p>
            </div>
          )}

          {!loading && items.map((item) => (
            <button
              key={item.id}
              onClick={() => onOpenVersion?.(item.id, !!item.isLatestVersion)}
              style={{
                width: "100%",
                textAlign: "left",
                border: `1px solid ${c.border}`,
                background: c.bg,
                borderRadius: "14px",
                padding: "10px 12px",
                marginBottom: "8px",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                  <span style={{ fontFamily: theme.font, color: c.text, fontSize: "12px", fontWeight: "700" }}>
                    v{item.planVersion || "?"}
                  </span>
                  {item.isLatestVersion && (
                    <span style={{ fontFamily: theme.font, color: "#5A9A5A", background: "#5A9A5A18", borderRadius: "999px", fontSize: "10px", fontWeight: "700", padding: "2px 7px" }}>
                      Atual
                    </span>
                  )}
                  {!item.isLatestVersion && (
                    <span style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "10px" }}>
                      Somente leitura
                    </span>
                  )}
                </div>
                <span style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "10px", whiteSpace: "nowrap" }}>
                  {new Date(item.createdAt || Date.now()).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p style={{ fontFamily: theme.font, color: c.textSecondary, fontSize: "12px", lineHeight: "1.4", marginBottom: "4px", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                {item.preview || "Sem mensagem inicial ainda."}
              </p>
              <span style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "10px" }}>
                {item.messageCount || 0} msg{(item.messageCount || 0) !== 1 ? "s" : ""}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConfirmRemovePlanModal({ theme, open, date, loading, onClose, onConfirm }) {
  const c = theme.colors;
  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1300, maxWidth: "385px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", padding: "22px" }}>
      <div onClick={loading ? undefined : onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.38)", cursor: loading ? "wait" : "pointer" }} />
      <div style={{ position: "relative", width: "100%", background: c.surface, borderRadius: "16px", border: `1px solid ${c.border}`, boxShadow: "0 16px 36px rgba(0,0,0,0.24)", padding: "16px 14px" }}>
        <h3 style={{ fontFamily: theme.headingFont, color: c.text, fontSize: "16px", fontWeight: "700", marginBottom: "8px" }}>
          Remover plano do dia?
        </h3>
        <p style={{ fontFamily: theme.font, color: c.textSecondary, fontSize: "12px", lineHeight: "1.45", marginBottom: "14px" }}>
          Você está prestes a remover o plano de <b>{date}</b>. Essa ação não pode ser desfeita automaticamente.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{ padding: "8px 10px", borderRadius: "10px", border: `1px solid ${c.border}`, background: c.bg, color: c.text, fontFamily: theme.font, fontSize: "12px", fontWeight: "600", cursor: loading ? "not-allowed" : "pointer" }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{ padding: "8px 11px", borderRadius: "10px", border: "none", background: loading ? "#C36E6E99" : "#C36E6E", color: "#FFF", fontFamily: theme.font, fontSize: "12px", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer" }}
          >
            {loading ? "Removendo..." : "Remover plano"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PlanActionSplitButton({ theme, hasPlano, generating, removingPlan, onGeneratePlan, onEditPlan, onNewPlan, onRequestRemovePlan, onOpenPlanHistory }) {
  const c = theme.colors;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const busy = generating || removingPlan;

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDocClick = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  if (!hasPlano) {
    return (
      <div ref={menuRef} style={{ position: "relative", display: "flex", alignItems: "stretch", borderRadius: "10px", boxShadow: `0 2px 8px ${c.primary}25` }}>
        <button
          onClick={onGeneratePlan}
          disabled={busy}
          style={{ padding: "8px 11px 8px 12px", background: busy ? `${c.primaryLight}80` : c.primary, color: "#FFF", border: "none", borderRadius: "10px 0 0 10px", fontFamily: theme.font, fontSize: "12px", fontWeight: "700", cursor: busy ? "not-allowed" : "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "5px" }}
        >
          {generating ? <><span style={{ display: "inline-block", animation: "bounce 1s infinite", fontSize: "13px" }}>🌿</span> Gerando...</> : "✨ Gerar plano"}
        </button>
        <button
          onClick={() => setMenuOpen(v => !v)}
          disabled={busy}
          aria-label="Mais ações do plano"
          style={{ width: "34px", background: busy ? `${c.primaryLight}80` : c.primary, color: "#FFF", border: "none", borderLeft: "1px solid rgba(255,255,255,0.2)", borderRadius: "0 10px 10px 0", cursor: busy ? "not-allowed" : "pointer", fontSize: "12px", fontWeight: "700" }}
        >
          ▾
        </button>

        {menuOpen && (
          <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, minWidth: "174px", background: c.surface, border: `1px solid ${c.border}`, borderRadius: "12px", boxShadow: "0 10px 24px rgba(0,0,0,0.15)", padding: "6px", zIndex: 40 }}>
            <button
              onClick={() => { setMenuOpen(false); onOpenPlanHistory?.(); }}
              style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", padding: "9px 10px", borderRadius: "8px", cursor: "pointer", fontFamily: theme.font, fontSize: "12px", color: c.text }}
            >
              🕘 Histórico de versões
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={menuRef} style={{ position: "relative", display: "flex", alignItems: "stretch", borderRadius: "10px", boxShadow: `0 2px 8px ${c.primary}25` }}>
      <button
        onClick={onEditPlan}
        disabled={busy}
        style={{ padding: "8px 11px 8px 12px", background: busy ? `${c.primaryLight}80` : c.primary, color: "#FFF", border: "none", borderRadius: "10px 0 0 10px", fontFamily: theme.font, fontSize: "12px", fontWeight: "700", cursor: busy ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}
      >
        ✏️ Editar plano
      </button>
      <button
        onClick={() => setMenuOpen(v => !v)}
        disabled={busy}
        aria-label="Mais ações do plano"
        style={{ width: "34px", background: busy ? `${c.primaryLight}80` : c.primary, color: "#FFF", border: "none", borderLeft: "1px solid rgba(255,255,255,0.2)", borderRadius: "0 10px 10px 0", cursor: busy ? "not-allowed" : "pointer", fontSize: "12px", fontWeight: "700" }}
      >
        ▾
      </button>

      {menuOpen && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, minWidth: "174px", background: c.surface, border: `1px solid ${c.border}`, borderRadius: "12px", boxShadow: "0 10px 24px rgba(0,0,0,0.15)", padding: "6px", zIndex: 40 }}>
          <button
            onClick={() => { setMenuOpen(false); onNewPlan?.(); }}
            style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", padding: "9px 10px", borderRadius: "8px", cursor: "pointer", fontFamily: theme.font, fontSize: "12px", color: c.text }}
          >
            ✨ Novo plano
          </button>
          <button
            onClick={() => { setMenuOpen(false); onOpenPlanHistory?.(); }}
            style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", padding: "9px 10px", borderRadius: "8px", cursor: "pointer", fontFamily: theme.font, fontSize: "12px", color: c.text }}
          >
            🕘 Histórico de versões
          </button>
          <button
            onClick={() => { setMenuOpen(false); onRequestRemovePlan?.(); }}
            style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", padding: "9px 10px", borderRadius: "8px", cursor: "pointer", fontFamily: theme.font, fontSize: "12px", color: "#C36E6E", fontWeight: "700" }}
          >
            🗑 Remover plano
          </button>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   PlanHeader — Mini-week strip + title + actions
   Consistent height regardless of plan state
   ────────────────────────────────────────────────────────────────── */
function PlanHeader({ theme, planoDict, selectedDate, setSelectedDate, onGeneratePlan, onEditPlan, onNewPlan, onRequestRemovePlan, removingPlan, onOpenPlanHistory, generating, totalDone, totalItens, hasPlano }) {
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
    <div style={{ background: `linear-gradient(135deg,${c.primaryLight}20,${c.primary}15)`, borderBottom: `1px solid ${c.primary}30`, padding: "10px 12px 8px", overflow: "visible", position: "relative", zIndex: 15 }}>

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
        <PlanActionSplitButton
          theme={theme}
          hasPlano={hasPlano}
          generating={generating}
          removingPlan={removingPlan}
          onGeneratePlan={onGeneratePlan}
          onEditPlan={onEditPlan}
          onNewPlan={onNewPlan}
          onRequestRemovePlan={onRequestRemovePlan}
          onOpenPlanHistory={onOpenPlanHistory}
        />
      </div>
    </div>
  );
}
