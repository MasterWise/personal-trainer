import { useState } from "react";
import { useTheme } from "../../contexts/ThemeContext.jsx";
import { TAB_LABELS, TAB_ICONS, FILE_TO_TAB } from "../../data/constants.js";

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
};

/** Trunca texto longo e tenta formatar JSON para legibilidade */
function formatPreview(text, maxLen = 600) {
  if (!text) return "(vazio)";
  try {
    const obj = JSON.parse(text);
    const pretty = JSON.stringify(obj, null, 2);
    return pretty.length > maxLen ? pretty.slice(0, maxLen) + "\n…" : pretty;
  } catch {
    return text.length > maxLen ? text.slice(0, maxLen) + "\n…" : text;
  }
}

export default function UpdateCard({ revision, setTab, onRevert }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [expanded, setExpanded] = useState(false);

  const { file, action, before, after, reverted } = revision;
  const label = TAB_LABELS[file] || file;
  const icon = TAB_ICONS[file] || "📄";
  const tab = FILE_TO_TAB[file];
  const desc = DESCRIPTIONS[file] || `${label} atualizado`;
  const actionLabel = ACTION_LABELS[action] || action;

  const cardBg = reverted ? `${c.textMuted}10` : c.primaryBg;
  const cardBorder = reverted ? `${c.textMuted}30` : c.border;

  return (
    <div style={{
      border: `1.5px solid ${cardBorder}`,
      borderRadius: "14px",
      overflow: "hidden",
      opacity: reverted ? 0.6 : 1,
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
            fontFamily: theme.font, color: reverted ? c.textMuted : c.text,
            fontSize: "12.5px", fontWeight: "600", lineHeight: "1.3",
            textDecoration: reverted ? "line-through" : "none",
          }}>
            {desc}
          </p>
          <p style={{
            fontFamily: theme.font, color: c.textMuted,
            fontSize: "10.5px", marginTop: "1px",
          }}>
            {actionLabel} · {reverted ? "Revertido" : "Clique para ver detalhes"}
          </p>
        </div>
        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
          {tab && !reverted && (
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
          {/* Before */}
          {action !== "add_progresso" && (
            <div style={{ marginBottom: "10px" }}>
              <p style={{
                fontFamily: theme.font, fontSize: "10px", fontWeight: "700",
                color: "#A35A5A", textTransform: "uppercase", letterSpacing: "0.05em",
                marginBottom: "4px",
              }}>
                {action === "append" ? "Conteúdo anterior (mantido)" : "Antes"}
              </p>
              <pre style={{
                fontFamily: "monospace", fontSize: "11px", color: c.textSecondary,
                background: "#A35A5A0A", border: `1px solid #A35A5A20`,
                borderRadius: "8px", padding: "8px 10px", margin: 0,
                whiteSpace: "pre-wrap", wordBreak: "break-word",
                maxHeight: "200px", overflowY: "auto",
                opacity: 0.8,
              }}>
                {formatPreview(before)}
              </pre>
            </div>
          )}

          {/* After */}
          <div style={{ marginBottom: reverted ? "0" : "10px" }}>
            <p style={{
              fontFamily: theme.font, fontSize: "10px", fontWeight: "700",
              color: "#5A9A5A", textTransform: "uppercase", letterSpacing: "0.05em",
              marginBottom: "4px",
            }}>
              {action === "append" ? "Conteúdo adicionado" : action === "add_progresso" ? "Novo marco" : "Depois"}
            </p>
            <pre style={{
              fontFamily: "monospace", fontSize: "11px", color: c.text,
              background: "#5A9A5A0A", border: `1px solid #5A9A5A20`,
              borderRadius: "8px", padding: "8px 10px", margin: 0,
              whiteSpace: "pre-wrap", wordBreak: "break-word",
              maxHeight: "200px", overflowY: "auto",
            }}>
              {formatPreview(after)}
            </pre>
          </div>

          {/* Revert Button */}
          {!reverted && onRevert && (
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
              ↩ Reverter alteração
            </button>
          )}
          {reverted && (
            <p style={{
              fontFamily: theme.font, fontSize: "11px", color: c.textMuted,
              textAlign: "center", fontStyle: "italic",
            }}>
              ✓ Esta alteração foi revertida
            </p>
          )}
        </div>
      )}
    </div>
  );
}
