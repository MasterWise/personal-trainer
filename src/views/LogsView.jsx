import { useState, useEffect, useCallback } from "react";
import { useTheme } from "../contexts/ThemeContext.jsx";
import { get, del } from "../services/api.js";

function safeJsonParse(str, fallback) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

function safeJsonFormat(str, fallback = "") {
  if (!str) return fallback;
  try { return JSON.stringify(JSON.parse(str), null, 2); } catch { return str; }
}

function truncateStr(str, maxLen) {
  if (!str || str.length <= maxLen) return str || "";
  return str.slice(0, maxLen) + "...";
}

function CopyButton({ text, theme }) {
  const c = theme.colors;
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      style={{
        padding: "4px 10px", borderRadius: "8px", border: `1px solid ${c.border}`,
        fontFamily: theme.font, fontSize: "11px", fontWeight: "600", cursor: "pointer",
        background: copied ? "#4CAF50" : c.surface, color: copied ? "#fff" : c.textSecondary,
        transition: "all 0.2s",
      }}
    >
      {copied ? "Copiado!" : "Copiar JSON"}
    </button>
  );
}

function JsonBlock({ json, theme, label, maxHeight = "none" }) {
  const c = theme.colors;
  const formatted = typeof json === "string" ? json : JSON.stringify(json, null, 2);

  return (
    <div style={{ marginBottom: "12px" }}>
      {label && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
          <span style={{ fontFamily: theme.headingFont, fontWeight: "700", fontSize: "13px", color: c.primary }}>{label}</span>
          <CopyButton text={formatted} theme={theme} />
        </div>
      )}
      <pre style={{
        background: c.bg, borderRadius: "10px", border: `1px solid ${c.border}`,
        padding: "12px", margin: 0, fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', Consolas, monospace",
        fontSize: "11px", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word",
        color: c.text, maxHeight, overflowY: maxHeight !== "none" ? "auto" : "visible",
        tabSize: 2,
      }}>
        {formatted}
      </pre>
    </div>
  );
}

function DetailTabs({ activeTab, onTabChange, theme }) {
  const c = theme.colors;
  const tabs = [
    { id: "trace", label: "Transaction Trace" },
    { id: "history", label: "Chat History Raw" },
    { id: "detail", label: "Log Detalhado" },
  ];

  return (
    <div style={{ display: "flex", gap: "4px", marginBottom: "14px", flexWrap: "wrap" }}>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onTabChange(t.id)}
          style={{
            padding: "6px 14px", borderRadius: "10px", fontFamily: theme.font,
            fontSize: "12px", fontWeight: "600", cursor: "pointer",
            background: activeTab === t.id ? c.primary : c.surface,
            color: activeTab === t.id ? "#fff" : c.text,
            border: activeTab === t.id ? "none" : `1px solid ${c.border}`,
            transition: "all 0.2s",
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// --- Transaction Trace View ---
function TransactionTrace({ detail, theme }) {
  const c = theme.colors;

  const requestPayload = safeJsonParse(detail.request_payload, null);
  const responseRaw = safeJsonParse(detail.response_raw, null);
  const durationMs = detail.duration_ms || 0;
  const createdAt = detail.created_at || "";
  const success = detail.success;
  const httpStatus = success ? "200 OK" : (detail.error_message || "Error");

  // Build a summary of the request for the header
  const provider = requestPayload?._gateway?.provider
    || responseRaw?._gateway?.provider
    || requestPayload?.app
    || "unknown";
  const sessionId = requestPayload?._sessionId || "(none)";
  const msgCount = requestPayload?.messages?.length || detail.messages_count || 0;

  // Build a display-friendly request object
  const displayRequest = requestPayload ? { ...requestPayload } : null;
  if (displayRequest) {
    // Show system prompt truncated in the trace
    if (displayRequest.system && displayRequest.system.length > 200) {
      displayRequest._system_preview = displayRequest.system.slice(0, 200) + "...";
      displayRequest._system_full_length = displayRequest.system.length;
      delete displayRequest.system;
    }
    // Show messages count summary
    if (displayRequest.messages) {
      displayRequest._messages_count = displayRequest.messages.length;
    }
  }

  const headerStyle = {
    fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
    fontSize: "12px", fontWeight: "700", marginBottom: "4px",
  };

  return (
    <div>
      {/* Trace Header */}
      <div style={{
        background: c.surface, borderRadius: "12px", padding: "12px 14px",
        border: `1px solid ${c.border}`, marginBottom: "14px",
        fontFamily: "'Fira Code', Consolas, monospace", fontSize: "12px", color: c.text,
        lineHeight: 1.8,
      }}>
        <div style={{ fontWeight: "700", fontSize: "13px", marginBottom: "4px", color: c.primary }}>
          Turno — {createdAt ? new Date(createdAt).toLocaleString("pt-BR") : "?"} — {durationMs}ms
        </div>
        <div>app: <span style={{ color: c.textSecondary }}>{requestPayload?.app || "personal-trainer"}</span></div>
        <div>provider: <span style={{ color: c.textSecondary }}>{provider}</span></div>
        <div>sessionId: <span style={{ color: c.textSecondary }}>{sessionId}</span></div>
        <div>messages: <span style={{ color: c.textSecondary }}>{msgCount} itens</span></div>
        <div>status: <span style={{ color: success ? "#4CAF50" : c.danger }}>{success ? "200 OK" : httpStatus}</span></div>
      </div>

      {/* REQUEST */}
      <div style={{ ...headerStyle, color: "#2196F3" }}>REQUEST  &rarr;  POST /api/ai/chat</div>
      {requestPayload ? (
        <JsonBlock json={requestPayload} theme={theme} label="Request Payload (completo)" maxHeight="400px" />
      ) : (
        <div style={{
          background: c.bg, borderRadius: "10px", border: `1px solid ${c.border}`,
          padding: "12px", marginBottom: "12px", fontFamily: theme.font, fontSize: "12px",
          color: c.textMuted, fontStyle: "italic",
        }}>
          Request payload nao disponivel (log anterior a esta feature).
          Veja "Mensagens Enviadas" na aba Log Detalhado.
        </div>
      )}

      {/* RESPONSE */}
      <div style={{ ...headerStyle, color: success ? "#4CAF50" : c.danger }}>
        RESPONSE  &larr;  {success ? "200 OK" : httpStatus}
      </div>
      {responseRaw ? (
        <JsonBlock json={responseRaw} theme={theme} label="Response (completo)" maxHeight="500px" />
      ) : (
        <div style={{
          background: c.bg, borderRadius: "10px", border: `1px solid ${c.border}`,
          padding: "12px", marginBottom: "12px", fontFamily: theme.font, fontSize: "12px",
          color: c.textMuted, fontStyle: "italic",
        }}>
          Response nao disponivel.
        </div>
      )}
    </div>
  );
}

// --- Chat History Raw View ---
function ChatHistoryRaw({ detail, theme }) {
  const c = theme.colors;

  // messages_sent contains the full messages array that was sent to the gateway
  const messagesSent = safeJsonParse(detail.messages_sent, []);
  const messagesFormatted = JSON.stringify(messagesSent, null, 2);

  // Also show the response content as the final "assistant" message
  const responseRaw = safeJsonParse(detail.response_raw, null);
  let responseContent = null;
  if (responseRaw?.content) {
    responseContent = responseRaw.content;
  }

  // Build the full history: messages sent + response
  const fullHistory = [...messagesSent];
  if (responseContent) {
    fullHistory.push({ role: "assistant", content: responseContent });
  }
  const fullHistoryFormatted = JSON.stringify(fullHistory, null, 2);

  return (
    <div>
      <div style={{
        background: c.surface, borderRadius: "12px", padding: "10px 14px",
        border: `1px solid ${c.border}`, marginBottom: "14px",
        fontFamily: theme.font, fontSize: "12px", color: c.textSecondary,
      }}>
        {messagesSent.length} mensagens enviadas
        {responseContent && " + 1 resposta do assistant"}
        {" "}= {fullHistory.length} mensagens totais
      </div>

      <JsonBlock
        json={fullHistoryFormatted}
        theme={theme}
        label={`Chat History Completo (${fullHistory.length} mensagens)`}
        maxHeight="none"
      />
    </div>
  );
}

// --- Original Detail View (preserved) ---
function DetailView({ detail, theme }) {
  const c = theme.colors;
  const sectionStyle = {
    background: c.bg, borderRadius: "12px", border: `1px solid ${c.border}`,
    padding: "12px", marginBottom: "10px", fontFamily: theme.font, fontSize: "12px",
    whiteSpace: "pre-wrap", wordBreak: "break-word", color: c.text, maxHeight: "300px", overflowY: "auto"
  };
  const labelStyle = { fontFamily: theme.headingFont, fontWeight: "700", fontSize: "13px", color: c.primary, marginBottom: "6px", display: "block" };

  let systemPrompt = detail.system_prompt || "";
  let messagesSent = safeJsonFormat(detail.messages_sent, "[]");
  let responseRaw = safeJsonFormat(detail.response_raw, "{}");
  let updatesJson = safeJsonFormat(detail.updates_json, "[]");

  function formatDate(d) {
    try { return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
    catch { return d; }
  }

  return (
    <div>
      {/* Summary bar */}
      <div style={{ background: c.surface, borderRadius: "12px", padding: "12px 14px", border: `1px solid ${c.border}`, marginBottom: "12px", display: "flex", flexWrap: "wrap", gap: "12px", fontSize: "12px", fontFamily: theme.font, color: c.textSecondary }}>
        <span>{formatDate(detail.created_at)}</span>
        <span>{detail.model}</span>
        <span>{detail.duration_ms}ms</span>
        <span>{detail.input_tokens} in</span>
        <span>{detail.output_tokens} out</span>
        <span>{detail.total_tokens} total</span>
        <span>{detail.messages_count} msgs</span>
        <span>{detail.updates_count} updates</span>
        <span style={{ color: detail.success ? "#4CAF50" : c.danger }}>{detail.success ? "OK" : detail.error_message}</span>
      </div>

      {/* System Prompt */}
      <span style={labelStyle}>System Prompt ({detail.system_prompt_length} chars)</span>
      <div style={sectionStyle}>{systemPrompt}</div>

      {/* Messages Sent */}
      <span style={labelStyle}>Mensagens Enviadas ({detail.messages_count})</span>
      <div style={sectionStyle}>{messagesSent}</div>

      {/* Reply */}
      <span style={labelStyle}>Reply do Coach</span>
      <div style={{ ...sectionStyle, background: `${c.primary}08`, borderColor: `${c.primary}30` }}>{detail.reply_text || "(vazio)"}</div>

      {/* Updates */}
      <span style={labelStyle}>Updates Gerados ({detail.updates_count})</span>
      <div style={sectionStyle}>{updatesJson}</div>

      {/* Raw Response */}
      <span style={labelStyle}>Resposta Bruta da API</span>
      <div style={{ ...sectionStyle, maxHeight: "400px", fontSize: "11px", color: c.textMuted }}>{responseRaw}</div>
    </div>
  );
}

export default function LogsView() {
  const { theme } = useTheme();
  const c = theme.colors;
  const [logs, setLogs] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list"); // list | detail-tabs
  const [detailTab, setDetailTab] = useState("trace"); // trace | history | detail

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
      setDetailTab("trace");
      setView("detail-tabs");
    } catch (e) { console.error("Failed to load log detail:", e); }
  }

  async function clearAll() {
    if (!confirm("Apagar todos os logs de debug?")) return;
    try {
      await del("/ai-logs");
      setLogs([]);
      setDetail(null);
      setView("list");
    } catch (e) { console.error("Failed to clear logs:", e); }
  }

  function formatDate(d) {
    try { return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
    catch { return d; }
  }

  const btnStyle = {
    padding: "6px 14px", borderRadius: "10px", border: `1px solid ${c.border}`, fontFamily: theme.font,
    fontSize: "12px", fontWeight: "600", cursor: "pointer", background: c.surface, color: c.text,
  };

  if (loading) return <div style={{ padding: "20px", textAlign: "center", color: c.textMuted, fontFamily: theme.font }}>Carregando logs...</div>;

  // ----- DETAIL TABS VIEW -----
  if (view === "detail-tabs" && detail) {
    return (
      <div style={{ overflowY: "auto", height: "100%", background: c.bg }}>
        <div style={{ padding: "14px 15px 28px" }}>
          <div style={{ display: "flex", gap: "8px", marginBottom: "14px", alignItems: "center" }}>
            <button onClick={() => setView("list")} style={{ ...btnStyle, background: c.primaryLight, color: "#fff", border: "none" }}>
              &larr; Voltar
            </button>
            <span style={{ fontFamily: theme.headingFont, fontSize: "14px", fontWeight: "700", color: c.text }}>
              {formatDate(detail.created_at)} &middot; {detail.duration_ms}ms
            </span>
          </div>

          <DetailTabs activeTab={detailTab} onTabChange={setDetailTab} theme={theme} />

          {detailTab === "trace" && <TransactionTrace detail={detail} theme={theme} />}
          {detailTab === "history" && <ChatHistoryRaw detail={detail} theme={theme} />}
          {detailTab === "detail" && <DetailView detail={detail} theme={theme} />}
        </div>
      </div>
    );
  }

  // ----- LIST VIEW -----
  return (
    <div style={{ overflowY: "auto", height: "100%", background: c.bg }}>
      <div style={{ padding: "14px 15px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <span style={{ fontFamily: theme.headingFont, fontSize: "16px", fontWeight: "700", color: c.text }}>Debug Logs ({logs.length})</span>
          {logs.length > 0 && (
            <button onClick={clearAll} style={{ ...btnStyle, color: c.danger, borderColor: `${c.danger}40` }}>Limpar tudo</button>
          )}
        </div>

        {logs.length === 0 && (
          <div style={{ textAlign: "center", marginTop: "40px" }}>
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
                {log.success ? "OK" : "ERR"} {formatDate(log.created_at)}
              </span>
              <span style={{ fontFamily: theme.font, fontSize: "11px", color: c.textMuted }}>
                {(log.input_tokens || 0) + (log.output_tokens || 0)} tokens | {log.duration_ms}ms
              </span>
            </div>
            <div style={{ fontFamily: theme.font, fontSize: "12px", color: c.textSecondary, lineHeight: 1.5 }}>
              {log.reply_text ? (log.reply_text.length > 120 ? log.reply_text.slice(0, 120) + "..." : log.reply_text) : (log.error_message || "sem reply")}
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "6px", fontSize: "11px", fontFamily: theme.font, color: c.textMuted }}>
              <span>{log.model}</span>
              <span>{log.messages_count} msgs</span>
              <span>{log.updates_count} updates</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
