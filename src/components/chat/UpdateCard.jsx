import { useState } from "react";
import { useTheme } from "../../contexts/ThemeContext.jsx";
import { TAB_LABELS, TAB_ICONS, FILE_TO_TAB } from "../../data/constants.js";
import { buildRevisionDiff } from "../../utils/revisionDiff.js";

const DESCRIPTIONS = {
  plano: "Plano atualizado",
  progresso: "Marco registrado",
  historico: "Histórico atualizado",
  micro: "Perfil atualizado",
  memoria: "Anotação do coach",
  calorias: "Calorias atualizadas",
  treinos: "Treinos atualizados",
};

const ACTION_LABELS = {
  replace_all: "Substituído",
  append: "Adicionado",
  add_progresso: "Novo marco",
  append_item: "Item adicionado",
  patch_item: "Item atualizado",
  delete_item: "Item removido",
  append_micro: "Perfil complementado",
  patch_micro: "Perfil ajustado",
  update_calorias_day: "Dia calórico atualizado",
  log_treino_day: "Treino registrado",
  patch_coach_note: "Nota atualizada",
  append_coach_note: "Nota adicionada",
};

function getActionSummary(revisions) {
  const actions = Array.from(
    new Set(
      (Array.isArray(revisions) ? revisions : [])
        .map((rev) => rev?.action)
        .filter(Boolean)
    )
  );

  if (actions.length === 0) return "Atualizado";
  if (actions.length === 1) return ACTION_LABELS[actions[0]] || "Atualizado";
  return `${actions.length} alterações`;
}

/** Formata JSON para legibilidade (sem truncar por padrão) */
function formatPreview(text, maxLen = null) {
  if (!text) return "(vazio)";
  try {
    const obj = JSON.parse(text);
    const pretty = JSON.stringify(obj, null, 2);
    if (Number.isInteger(maxLen) && maxLen > 0 && pretty.length > maxLen) {
      return pretty.slice(0, maxLen) + "\n…";
    }
    return pretty;
  } catch {
    if (Number.isInteger(maxLen) && maxLen > 0 && text.length > maxLen) {
      return text.slice(0, maxLen) + "\n…";
    }
    return text;
  }
}

export default function UpdateCard({ revisions = [], setTab, onRevert }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [expanded, setExpanded] = useState(false);

  const list = Array.isArray(revisions) ? revisions.filter(Boolean) : [];
  if (list.length === 0) return null;
  const primary = list[0];
  const { file, action } = primary;
  const label = TAB_LABELS[file] || file;
  const icon = TAB_ICONS[file] || "📄";
  const tab = FILE_TO_TAB[file];
  const desc = DESCRIPTIONS[file] || `${label} atualizado`;
  const actionLabel = getActionSummary(list);
  const total = list.length;
  const allReverted = list.every((rev) => rev?.reverted);

  const cardBg = allReverted ? `${c.textMuted}10` : c.primaryBg;
  const cardBorder = allReverted ? `${c.textMuted}30` : c.border;

  return (
    <div style={{
      border: `1.5px solid ${cardBorder}`,
      borderRadius: "14px",
      overflow: "hidden",
      opacity: allReverted ? 0.6 : 1,
      transition: "opacity 0.3s",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: "8px",
        padding: "10px 12px",
        background: cardBg,
        cursor: "pointer",
      }} onClick={() => setExpanded(!expanded)}>
        <span style={{ fontSize: "16px", flexShrink: 0 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontFamily: theme.font, color: allReverted ? c.textMuted : c.text,
            fontSize: "12.5px", fontWeight: "600", lineHeight: "1.3",
            textDecoration: allReverted ? "line-through" : "none",
          }}>
            {desc}{total > 1 ? ` (${total})` : ""}
          </p>
          <p style={{
            fontFamily: theme.font, color: c.textMuted,
            fontSize: "10.5px", marginTop: "1px",
          }}>
            {actionLabel} · {allReverted ? "Revertido" : "Clique para ver detalhes"}
          </p>
        </div>
        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
          {tab && !allReverted && (
            <button
              onClick={e => { e.stopPropagation(); setTab(tab); }}
              style={{
                padding: "5px 10px", background: c.primary, color: "#FFF",
                border: "none", borderRadius: "8px", fontFamily: theme.font,
                fontSize: "11px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              Ver →
            </button>
          )}
          <span style={{
            fontSize: "14px", color: c.textMuted,
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s", display: "inline-block",
          }}>▾</span>
        </div>
      </div>

      {/* Expandable Diff Area */}
      {expanded && (
        <div style={{
          padding: "10px 12px",
          background: c.surface,
          borderTop: `1px solid ${cardBorder}`,
        }}>
          {list.map((rev, idx) => {
            const diff = buildRevisionDiff(rev.action, rev.before, rev.after);
            const itemReverted = rev?.reverted === true;
            return (
              <div key={`${file}-${action}-${idx}`} style={{ marginBottom: idx === list.length - 1 ? (allReverted ? "0" : "10px") : "12px" }}>
                {list.length > 1 && (
                  <p style={{
                    fontFamily: theme.font,
                    fontSize: "10px",
                    fontWeight: "700",
                    color: c.textMuted,
                    marginBottom: "6px",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}>
                    Alteração {idx + 1}{itemReverted ? " · Revertida" : ""}
                  </p>
                )}

                {!diff.hideBefore && (
                  <div style={{ marginBottom: "10px" }}>
                    <p style={{
                      fontFamily: theme.font, fontSize: "10px", fontWeight: "700",
                      color: "#A35A5A", textTransform: "uppercase", letterSpacing: "0.05em",
                      marginBottom: "4px",
                    }}>
                      Antes (trecho alterado)
                    </p>
                    <pre style={{
                      fontFamily: "monospace", fontSize: "11px", color: c.textSecondary,
                      background: "#A35A5A0A", border: `1px solid #A35A5A20`,
                      borderRadius: "8px", padding: "8px 10px", margin: 0,
                      whiteSpace: "pre-wrap", wordBreak: "break-word",
                      maxHeight: "200px", overflowY: "auto",
                      opacity: 0.8,
                    }}>
                      {formatPreview(diff.beforeDisplay)}
                    </pre>
                  </div>
                )}

                <div>
                  <p style={{
                    fontFamily: theme.font, fontSize: "10px", fontWeight: "700",
                    color: "#5A9A5A", textTransform: "uppercase", letterSpacing: "0.05em",
                    marginBottom: "4px",
                  }}>
                    {rev.action === "append" ? "Conteúdo adicionado (diff)" : rev.action === "add_progresso" ? "Novo marco" : "Depois (trecho alterado)"}
                  </p>
                  <pre style={{
                    fontFamily: "monospace", fontSize: "11px", color: c.text,
                    background: "#5A9A5A0A", border: `1px solid #5A9A5A20`,
                    borderRadius: "8px", padding: "8px 10px", margin: 0,
                    whiteSpace: "pre-wrap", wordBreak: "break-word",
                    maxHeight: "200px", overflowY: "auto",
                  }}>
                    {formatPreview(diff.afterDisplay)}
                  </pre>
                </div>
              </div>
            );
          })}

          {/* Revert Button */}
          {!allReverted && onRevert && (
            <button
              onClick={onRevert}
              style={{
                width: "100%", padding: "8px 14px",
                background: "transparent",
                border: `1.5px solid #A35A5A40`,
                borderRadius: "10px",
                fontFamily: theme.font, fontSize: "12px", fontWeight: "700",
                color: "#A35A5A", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                transition: "background 0.2s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "#A35A5A10"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              ↩ Reverter {total > 1 ? "alterações do grupo" : "alteração"}
            </button>
          )}
          {allReverted && (
            <p style={{
              fontFamily: theme.font, fontSize: "11px", color: c.textMuted,
              textAlign: "center", fontStyle: "italic",
            }}>
              ✓ Este grupo de alterações foi revertido
            </p>
          )}
        </div>
      )}
    </div>
  );
}
