import { useTheme } from "../../contexts/ThemeContext.jsx";

export default function Header({ docsReady, onHistory, onNewConvo, hasMessages }) {
  const { theme, toggleTheme, themeId } = useTheme();
  const c = theme.colors;

  return (
    <div className="pt-header">
      <div className="pt-header__avatar">🌿</div>
      <div className="pt-header__info">
        <div className="pt-header__name">Coach Renata</div>
        <div className="pt-header__status">
          <span className="pt-header__status-dot" style={{ background: docsReady ? c.ok : "#C09040" }} />
          {docsReady ? "Online — memória carregada" : "Carregando..."}
        </div>
      </div>
      <div className="pt-header__actions">
        <button className="pt-header__action-btn" onClick={toggleTheme} title={themeId === "warm" ? "Modo escuro" : "Modo claro"}>
          {themeId === "warm" ? "🌙" : "☀️"}
        </button>
        <button className="pt-header__action-btn" onClick={onHistory} title="Histórico de conversas">🕐</button>
        <button className="pt-header__action-btn" onClick={onNewConvo}
          disabled={!hasMessages}
          style={{ opacity: hasMessages ? 1 : 0.4, cursor: hasMessages ? "pointer" : "not-allowed", background: hasMessages ? c.primary : undefined, color: hasMessages ? "#FFF" : undefined }}
          title="Nova conversa">
          ✏️
        </button>
      </div>
    </div>
  );
}
