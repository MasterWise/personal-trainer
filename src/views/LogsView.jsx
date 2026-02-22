import { useState, useEffect } from "react";
import { useTheme } from "../contexts/ThemeContext.jsx";
import { get, del } from "../services/api.js";

export default function LogsView() {
  const { theme } = useTheme();
  const c = theme.colors;
  const [logs, setLogs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("list"); // list | detail

  useEffect(() => { loadLogs(); }, []);

  async function loadLogs() {
    setLoading(true);
    try {
      const data = await get("/ai-logs?limit=100");
      setLogs(data);
    } catch (e) { console.error("Failed to load logs:", e); }
    setLoading(false);
  }

  async function openLog(id) {
    try {
      const data = await get(`/ai-logs/${id}`);
      setDetail(data);
      setSelected(id);
      setTab("detail");
    } catch (e) { console.error("Failed to load log detail:", e); }
  }

  async function clearAll() {
    if (!confirm("Apagar todos os logs de debug?")) return;
    try {
      await del("/ai-logs");
      setLogs([]);
      setDetail(null);
      setTab("list");
    } catch (e) { console.error("Failed to clear logs:", e); }
  }

  function formatDate(d) {
    try { return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
    catch { return d; }
  }

  const sectionStyle = {
    background: c.bg, borderRadius: "12px", border: `1px solid ${c.border}`,
    padding: "12px", marginBottom: "10px", fontFamily: theme.font, fontSize: "12px",
    whiteSpace: "pre-wrap", wordBreak: "break-word", color: c.text, maxHeight: "300px", overflowY: "auto"
  };
  const labelStyle = { fontFamily: theme.headingFont, fontWeight: "700", fontSize: "13px", color: c.primary, marginBottom: "6px", display: "block" };
  const btnStyle = {
    padding: "6px 14px", borderRadius: "10px", border: `1px solid ${c.border}`, fontFamily: theme.font,
    fontSize: "12px", fontWeight: "600", cursor: "pointer", background: c.surface, color: c.text,
  };

  if (loading) return <div style={{ padding: "20px", textAlign: "center", color: c.textMuted, fontFamily: theme.font }}>Carregando logs...</div>;

  // ----- DETAIL VIEW -----
  if (tab === "detail" && detail) {
    let systemPrompt = detail.system_prompt || "";
    let messagesSent = "[]";
    let responseRaw = "{}";
    let updatesJson = "[]";

    try { messagesSent = JSON.stringify(JSON.parse(detail.messages_sent || "[]"), null, 2); } catch { messagesSent = detail.messages_sent || ""; }
    try { responseRaw = JSON.stringify(JSON.parse(detail.response_raw || "{}"), null, 2); } catch { responseRaw = detail.response_raw || ""; }
    try { updatesJson = JSON.stringify(JSON.parse(detail.updates_json || "[]"), null, 2); } catch { updatesJson = detail.updates_json || ""; }

    return (
      <div style={{ overflowY: "auto", height: "100%", background: c.bg }}>
        <div style={{ padding: "14px 15px 28px" }}>
          <div style={{ display: "flex", gap: "8px", marginBottom: "14px", alignItems: "center" }}>
            <button onClick={() => setTab("list")} style={{ ...btnStyle, background: c.primaryLight, color: "#fff", border: "none" }}>← Voltar</button>
            <span style={{ fontFamily: theme.headingFont, fontSize: "15px", fontWeight: "700", color: c.text }}>Log Detalhado</span>
          </div>

          {/* Summary bar */}
          <div style={{ background: c.surface, borderRadius: "12px", padding: "12px 14px", border: `1px solid ${c.border}`, marginBottom: "12px", display: "flex", flexWrap: "wrap", gap: "12px", fontSize: "12px", fontFamily: theme.font, color: c.textSecondary }}>
            <span>📅 {formatDate(detail.created_at)}</span>
            <span>🤖 {detail.model}</span>
            <span>⏱️ {detail.duration_ms}ms</span>
            <span>📥 {detail.input_tokens} in</span>
            <span>📤 {detail.output_tokens} out</span>
            <span>💰 {detail.total_tokens} total</span>
            <span>💬 {detail.messages_count} msgs</span>
            <span>📝 {detail.updates_count} updates</span>
            <span style={{ color: detail.success ? "#4CAF50" : c.danger }}>{detail.success ? "✅ OK" : `❌ ${detail.error_message}`}</span>
          </div>

          {/* System Prompt */}
          <span style={labelStyle}>📋 System Prompt ({detail.system_prompt_length} chars)</span>
          <div style={sectionStyle}>{systemPrompt}</div>

          {/* Messages Sent */}
          <span style={labelStyle}>💬 Mensagens Enviadas ({detail.messages_count})</span>
          <div style={sectionStyle}>{messagesSent}</div>

          {/* Reply */}
          <span style={labelStyle}>🤖 Reply do Coach</span>
          <div style={{ ...sectionStyle, background: `${c.primary}08`, borderColor: `${c.primary}30` }}>{detail.reply_text || "(vazio)"}</div>

          {/* Updates */}
          <span style={labelStyle}>📝 Updates Gerados ({detail.updates_count})</span>
          <div style={sectionStyle}>{updatesJson}</div>

          {/* Raw Response */}
          <span style={labelStyle}>🔧 Resposta Bruta da API</span>
          <div style={{ ...sectionStyle, maxHeight: "400px", fontSize: "11px", color: c.textMuted }}>{responseRaw}</div>
        </div>
      </div>
    );
  }

  // ----- LIST VIEW -----
  return (
    <div style={{ overflowY: "auto", height: "100%", background: c.bg }}>
      <div style={{ padding: "14px 15px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <span style={{ fontFamily: theme.headingFont, fontSize: "16px", fontWeight: "700", color: c.text }}>🔍 Debug Logs ({logs.length})</span>
          {logs.length > 0 && (
            <button onClick={clearAll} style={{ ...btnStyle, color: c.danger, borderColor: `${c.danger}40` }}>🗑️ Limpar tudo</button>
          )}
        </div>

        {logs.length === 0 && (
          <div style={{ textAlign: "center", marginTop: "40px" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>📭</div>
            <p style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "14px" }}>Nenhum log ainda. Ative o modo debug no Perfil e converse com o Coach.</p>
          </div>
        )}

        {logs.map(log => (
          <button key={log.id} onClick={() => openLog(log.id)}
            style={{ display: "block", width: "100%", textAlign: "left", background: c.surface, border: `1px solid ${c.border}`, borderRadius: "12px", padding: "12px 14px", marginBottom: "8px", cursor: "pointer", transition: "border-color 0.2s" }}
            onMouseOver={e => e.currentTarget.style.borderColor = c.primary}
            onMouseOut={e => e.currentTarget.style.borderColor = c.border}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span style={{ fontFamily: theme.headingFont, color: c.text, fontSize: "13px", fontWeight: "600" }}>
                {log.success ? "✅" : "❌"} {formatDate(log.created_at)}
              </span>
              <span style={{ fontFamily: theme.font, fontSize: "11px", color: c.textMuted }}>
                {log.input_tokens + log.output_tokens} tokens · {log.duration_ms}ms
              </span>
            </div>
            <div style={{ fontFamily: theme.font, fontSize: "12px", color: c.textSecondary, lineHeight: 1.5 }}>
              {log.reply_text ? (log.reply_text.length > 120 ? log.reply_text.slice(0, 120) + "…" : log.reply_text) : (log.error_message || "sem reply")}
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "6px", fontSize: "11px", fontFamily: theme.font, color: c.textMuted }}>
              <span>🤖 {log.model}</span>
              <span>💬 {log.messages_count} msgs</span>
              <span>📝 {log.updates_count} updates</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
