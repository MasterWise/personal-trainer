import { useState, useEffect, useRef } from "react";
import { useTheme } from "../../contexts/ThemeContext.jsx";
import { FILE_TO_TAB } from "../../data/constants.js";
import { buildRelevantPlanContext, buildSystemInstructions, buildSystemContext } from "../../data/prompts.js";
import { sendMessage } from "../../services/claudeService.js";
import {
  getClaudeResponseUserMessage,
  isClaudeResponseParseError,
  parseClaudeStructuredResponse,
} from "../../services/claudeResponseParser.js";
import ChatMsg from "./ChatMsg.jsx";
import PermCard from "./PermCard.jsx";

import { useDocs } from "../../contexts/DocsContext.jsx";

export default function ChatTab({
  docs,
  setDocs,
  messages,
  setMessages,
  docsReady,
  setTab,
  onGeneratePlan,
  generating,
  planoDate,
  conversationMeta = { type: "general" },
  readOnly = false,
  inputPlaceholder,
  contextBadge,
}) {
  const { applyUpdate } = useDocs();
  const { theme } = useTheme();
  const c = theme.colors;
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingPerms, setPPerms] = useState([]);
  const bottomRef = useRef(null);
  const taRef = useRef(null);
  const isPlanConversation = conversationMeta?.type === "plan";
  const planLoadingLabel = generating && isPlanConversation
    ? (conversationMeta?.originAction === "new_plan" ? "Gerando novo plano..." : "Gerando plano do dia...")
    : null;
  const contextBadgeIcon = readOnly
    ? "🕘"
    : (generating && isPlanConversation
        ? "🌿"
        : (conversationMeta?.originAction === "edit_plan" ? "✏️" : "📋"));

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading, generating, pendingPerms]);
  useEffect(() => { if (readOnly) setInput(""); }, [readOnly]);

  async function send() {
    const text = input.trim();
    if (!text || loading || !docsReady || readOnly) return;
    const userMsg = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const currentMsgs = [...messages, userMsg];
      const apiMsgs = currentMsgs.slice(-40).map(m => ({ role: m.role, content: m.content }));
      const today = new Date().toLocaleDateString("pt-BR");
      const weekday = new Date().toLocaleDateString("pt-BR", { weekday: "long" });
      const timeStr = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      let nomePerfil = "Renata";
      try { nomePerfil = JSON.parse(docs.perfil || "{}").nome || "Renata"; } catch { /* ignore */ }
      const normalizedMeta = {
        conversationType: conversationMeta?.type === "plan" ? "plan" : "general",
        planDate: conversationMeta?.type === "plan" ? (conversationMeta?.planDate || planoDate) : null,
        planVersion: Number.isInteger(conversationMeta?.planVersion) ? conversationMeta.planVersion : null,
        originAction: conversationMeta?.originAction || null,
      };
      const instructionPlanDate = normalizedMeta.conversationType === "plan" ? (normalizedMeta.planDate || today) : today;
      const planContext = buildRelevantPlanContext(docs, normalizedMeta);
      const data = await sendMessage(
        apiMsgs,
        buildSystemInstructions(nomePerfil, today, weekday, timeStr, instructionPlanDate),
        buildSystemContext(docs, normalizedMeta),
        {
          ...normalizedMeta,
          planContext,
        }
      );
      const parsed = parseClaudeStructuredResponse(data);
      const updates = parsed.updates || [];

      const direct = updates.filter(u => !u.requiresPermission);
      const perms = updates.filter(u => u.requiresPermission);

      // Apply direct updates and capture before/after revisions
      const appliedUpdates = [];
      for (const u of direct) {
        const revision = await applyUpdate(u);
        if (revision) appliedUpdates.push(revision);
      }

      if (perms.length > 0) {
        setPPerms(prev => [...prev, ...perms.map(u => ({ id: Date.now() + Math.random(), update: u }))]);
      }

      const aiMsg = { role: "assistant", content: parsed.reply || "...", appliedUpdates };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e) {
      if (isClaudeResponseParseError(e)) {
        console.error("send() parse error:", e.code, e.meta, e);
        setMessages(prev => [...prev, { role: "assistant", content: getClaudeResponseUserMessage(e) }]);
      } else {
        console.error("send() exception:", e);
        setMessages(prev => [...prev, { role: "assistant", content: `Erro: ${e?.message || String(e)}` }]);
      }
    }
    setLoading(false);
  }

  async function handlePerm(permId, approved) {
    const perm = pendingPerms.find(p => p.id === permId);
    if (!perm) return;
    setPPerms(prev => prev.filter(p => p.id !== permId));
    if (approved) {
      const revision = await applyUpdate(perm.update);
      const appliedUpdates = revision ? [revision] : [];
      setMessages(prev => [...prev, { role: "assistant", content: "✓ Perfil atualizado.", appliedUpdates }]);
    } else {
      setMessages(prev => [...prev, { role: "assistant", content: "Ok, mantive como estava." }]);
    }
  }

  async function handleRevert(msgIndex, revisionIndex) {
    const msg = messages[msgIndex];
    if (!msg?.appliedUpdates?.[revisionIndex]) return;
    const rev = msg.appliedUpdates[revisionIndex];
    // Revert = apply replace_all with the "before" content
    await applyUpdate({ file: rev.file, action: "replace_all", content: rev.before });
    // Mark revision as reverted in the message
    setMessages(prev => prev.map((m, i) => {
      if (i !== msgIndex) return m;
      const newUpdates = [...(m.appliedUpdates || [])];
      newUpdates[revisionIndex] = { ...newUpdates[revisionIndex], reverted: true };
      return { ...m, appliedUpdates: newUpdates };
    }));
  }

  const quickActions = ["Como foi minha semana?", "Lanche da tarde ideal 🍎", "Estou na TPM 😩", "O que jantar hoje?"];

  return (
    <div className="pt-chat">
      <div className="pt-chat__messages">
        {!docsReady && <div style={{ textAlign: "center", marginTop: "40px", color: c.textMuted, fontFamily: theme.font, fontSize: "14px" }}>Carregando memória...</div>}

        {docsReady && contextBadge && (
          <div style={{ padding: "8px 12px 0" }}>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 10px",
              borderRadius: "999px",
              background: `${c.primary}12`,
              color: c.primary,
              border: `1px solid ${c.primary}25`,
              fontFamily: theme.font,
              fontSize: "11px",
              fontWeight: "700",
            }}>
              {contextBadgeIcon} {contextBadge}
            </div>
          </div>
        )}

        {docsReady && messages.length === 0 && (
          <div className="pt-chat__welcome">
            <div className="pt-chat__welcome-avatar">🌿</div>
            <h3 className="pt-chat__welcome-heading">Olá!</h3>
            <p className="pt-chat__welcome-subtitle">Estou aqui para te acompanhar. Como você está hoje?</p>
            <button onClick={onGeneratePlan} disabled={generating}
              style={{ marginTop: "22px", width: "100%", maxWidth: "310px", padding: "14px 20px", background: generating ? `${c.primaryLight}80` : `linear-gradient(135deg,${c.primaryLight},${c.primary})`, color: "#FFF", border: "none", borderRadius: "16px", fontFamily: theme.font, fontSize: "15px", fontWeight: "700", cursor: generating ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", boxShadow: `0 4px 16px ${c.primary}40` }}>
              {generating ? "🌿 Gerando plano..." : "✨ Gerar plano do dia"}
            </button>
            <div className="pt-chat__quick-actions" style={{ marginTop: "12px", width: "100%", maxWidth: "310px" }}>
              {quickActions.map(s => (
                <button key={s} className="pt-chat__quick-action" onClick={() => { setInput(s); taRef.current?.focus(); }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <ChatMsg key={i} msg={m} msgIndex={i} setTab={setTab} onRevert={handleRevert} />
        ))}

        {(loading || generating) && (
          <div className="pt-chat__row pt-chat__row--assistant">
            <div className="pt-chat__avatar">🌿</div>
            <div className="pt-chat__bubble pt-chat__bubble--assistant" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div className="pt-chat__loading">
                {[0, 1, 2].map(i => <div key={i} className="pt-chat__loading-dot" />)}
              </div>
              {planLoadingLabel && (
                <div style={{ fontFamily: theme.font, fontSize: "12px", color: c.textMuted }}>
                  {planLoadingLabel}
                </div>
              )}
            </div>
          </div>
        )}

        {pendingPerms.map(p => (
          <PermCard key={p.id} msg={p.update.permissionMessage} onYes={() => handlePerm(p.id, true)} onNo={() => handlePerm(p.id, false)} />
        ))}

        <div ref={bottomRef} />
      </div>

      <div className="pt-chat__input-area">
        <textarea ref={taRef} value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={docsReady ? (inputPlaceholder || "Escreva aqui... (Enter envia)") : "Carregando..."}
          disabled={!docsReady || readOnly || generating} rows={1}
          className="pt-chat__textarea" />
        <button onClick={send} disabled={!input.trim() || (loading || generating) || !docsReady || readOnly}
          className={`pt-chat__send ${input.trim() && !(loading || generating) && docsReady ? "pt-chat__send--active" : ""}`}>
          ➤
        </button>
      </div>
    </div>
  );
}
