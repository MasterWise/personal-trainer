import { useTheme } from "../../contexts/ThemeContext.jsx";
import { TAB_LABELS, TAB_ICONS, FILE_TO_TAB } from "../../data/constants.js";

const DESCRIPTIONS = {
  plano: "Plano atualizado com a mudança solicitada.",
  marcos: "Novo marco registrado na sua jornada.",
  historico: "Dado registrado no seu histórico.",
  micro: "Perfil atualizado com nova informação.",
  memoria: "Anotação registrada pelo coach.",
};

export default function UpdateCard({ file, onGo }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const label = TAB_LABELS[file] || file;
  const icon = TAB_ICONS[file] || "📄";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 13px", background: c.primaryBg, border: `1.5px solid ${c.border}`, borderRadius: "12px", margin: "4px 0 6px" }}>
      <span style={{ fontSize: "18px" }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <p style={{ fontFamily: theme.font, color: c.textSecondary, fontSize: "12.5px", lineHeight: "1.4" }}>
          {DESCRIPTIONS[file] || `${label} atualizado.`}
        </p>
      </div>
      <button onClick={onGo} style={{ padding: "6px 13px", background: c.primary, color: "#FFF", border: "none", borderRadius: "8px", fontFamily: theme.font, fontSize: "12px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
        Ver {label} →
      </button>
    </div>
  );
}
