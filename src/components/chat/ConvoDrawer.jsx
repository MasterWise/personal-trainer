import { useTheme } from "../../contexts/ThemeContext.jsx";

export default function ConvoDrawer({ convos, onLoad, onDelete, onClose }) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 100, display: "flex", flexDirection: "column" }}>
      <div onClick={onClose} style={{ flex: 1, background: "rgba(0,0,0,0.35)", cursor: "pointer" }} />
      <div style={{ background: c.surface, borderRadius: "24px 24px 0 0", maxHeight: "78vh", display: "flex", flexDirection: "column", boxShadow: "0 -8px 32px rgba(0,0,0,0.15)" }}>
        <div style={{ padding: "12px 20px 0", flexShrink: 0 }}>
          <div style={{ width: "40px", height: "4px", borderRadius: "2px", background: c.border, margin: "0 auto 14px" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
            <div>
              <h3 style={{ fontFamily: theme.headingFont, color: c.text, fontSize: "18px", fontWeight: "700" }}>Conversas anteriores</h3>
              <p style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "12px", marginTop: "2px" }}>
                {convos.length} conversa{convos.length !== 1 ? "s" : ""} salva{convos.length !== 1 ? "s" : ""}
              </p>
            </div>
            <button onClick={onClose} style={{ width: "34px", height: "34px", borderRadius: "50%", border: `1px solid ${c.border}`, background: c.bg, cursor: "pointer", fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>
        </div>
        <div style={{ overflowY: "auto", padding: "0 16px 24px", flex: 1 }}>
          {convos.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ fontSize: "36px", marginBottom: "12px" }}>💬</div>
              <p style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "14px" }}>Nenhuma conversa arquivada ainda.</p>
            </div>
          )}
          {[...convos].reverse().map(conv => (
            <div key={conv.id} style={{ display: "flex", gap: "10px", alignItems: "center", padding: "12px 14px", background: c.bg, borderRadius: "14px", marginBottom: "8px", border: `1px solid ${c.border}` }}>
              <button onClick={() => onLoad(conv)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <span style={{ fontFamily: theme.font, color: c.text, fontSize: "13px", fontWeight: "600" }}>{conv.date}</span>
                  <span style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "11px" }}>{conv.count} msg{conv.count !== 1 ? "s" : ""}</span>
                </div>
                <p style={{ fontFamily: theme.font, color: c.textSecondary, fontSize: "12.5px", lineHeight: "1.5", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{conv.preview}</p>
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
