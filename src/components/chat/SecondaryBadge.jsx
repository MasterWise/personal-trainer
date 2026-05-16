import { useTheme } from "../../contexts/ThemeContext.jsx";
import { uniqueIconsByDestination, buildBadgeTooltip } from "../../utils/secondaryUpdates.js";

/**
 * Badge inline minimalista que sinaliza atualizações secundárias do coach
 * (tudo que NÃO é plano). Renderizado dentro da bolha do assistente, no fim
 * do texto, sem consumir linha nova quando há espaço.
 *
 * Click toggla a visualização dos cards completos (renderizados pelo
 * ChatMsg, abaixo do card de plano).
 */
export default function SecondaryBadge({ groups, expanded, onToggle }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const icons = uniqueIconsByDestination(groups);
  if (icons.length === 0) return null;

  const tooltip = buildBadgeTooltip(icons);

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
      title={tooltip}
      aria-expanded={!!expanded}
      aria-label={tooltip}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "3px",
        marginLeft: "8px",
        padding: "2px 7px",
        background: expanded ? `${c.primary}18` : "transparent",
        border: `1px solid ${expanded ? `${c.primary}55` : c.border}`,
        borderRadius: "999px",
        cursor: "pointer",
        verticalAlign: "middle",
        fontFamily: theme.font,
        fontSize: "12px",
        lineHeight: 1,
        color: expanded ? c.primary : c.textMuted,
        transition: "all 0.15s ease",
        userSelect: "none",
      }}
    >
      {icons.map(({ icon, label }) => (
        <span key={label} style={{ fontSize: "13px" }}>{icon}</span>
      ))}
      <span style={{
        fontSize: "9px",
        marginLeft: "1px",
        opacity: 0.7,
        transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 0.15s ease",
        display: "inline-block",
      }}>▾</span>
    </button>
  );
}
