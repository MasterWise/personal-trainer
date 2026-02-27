import { useTheme } from "../../contexts/ThemeContext.jsx";

export default function ConvoDrawer({ convos, onLoad, onDelete, onClose }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const sortedConvos = [...convos].sort((a, b) => {
    const aTs = Date.parse(a?.date || "") || 0;
    const bTs = Date.parse(b?.date || "") || 0;
    return bTs - aTs;
  });

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
      <div style={{ background: c.surface, borderRadius: "16px", border: `1px solid ${c.border}`, maxHeight: "calc(100vh - var(--pt-header-height) - var(--pt-bottom-nav-height) - 16px)", display: "flex", flexDirection: "column", boxShadow: "0 12px 28px rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "12px 14px 8px", borderBottom: `1px solid ${c.border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
            <div>
              <h3 style={{ fontFamily: theme.headingFont, color: c.text, fontSize: "16px", fontWeight: "700" }}>Conversas anteriores</h3>
              <p style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "11px", marginTop: "2px" }}>
                {convos.length} conversa{convos.length !== 1 ? "s" : ""} salva{convos.length !== 1 ? "s" : ""}
              </p>
            </div>
            <button onClick={onClose} style={{ width: "32px", height: "32px", borderRadius: "50%", border: `1px solid ${c.border}`, background: c.bg, cursor: "pointer", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>
        </div>
        <div style={{ overflowY: "auto", padding: "12px 14px 16px", flex: 1 }}>
          {convos.length === 0 && (
            <div style={{ textAlign: "center", padding: "28px 12px" }}>
              <div style={{ fontSize: "28px", marginBottom: "8px", opacity: 0.5 }}>💬</div>
              <p style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "12px" }}>Nenhuma conversa arquivada ainda.</p>
            </div>
          )}
          {sortedConvos.map(conv => (
            <div key={conv.id} style={{ display: "flex", gap: "10px", alignItems: "center", padding: "10px 12px", background: c.bg, borderRadius: "14px", marginBottom: "8px", border: `1px solid ${c.border}` }}>
              <button onClick={() => onLoad(conv)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <span style={{ fontFamily: theme.font, color: c.text, fontSize: "12px", fontWeight: "700" }}>{conv.date}</span>
                  <span style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "10px" }}>{conv.count} msg{conv.count !== 1 ? "s" : ""}</span>
                </div>
                <p style={{ fontFamily: theme.font, color: c.textSecondary, fontSize: "12px", lineHeight: "1.45", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{conv.preview}</p>
              </button>
              <button onClick={() => onDelete(conv.id)} style={{ width: "30px", height: "30px", borderRadius: "8px", border: `1px solid ${c.border}`, background: c.surface, cursor: "pointer", fontSize: "13px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: c.textMuted }}>
                🗑
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
