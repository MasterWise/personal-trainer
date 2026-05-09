import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "../../contexts/ThemeContext.jsx";
import { buildRelevantPlanContext, buildSystemInstructions, buildSystemContext } from "../../data/prompts.js";
import { getAsyncClaudeResponse, sendMessage } from "../../services/claudeService.js";
import {
  getClaudeResponseUserMessage,
  isClaudeResponseParseError,
  parseClaudeStructuredResponse,
} from "../../services/claudeResponseParser.js";
import { hashString } from "../../utils/stringHash.js";
import { lockPlanUpdateToDate } from "../../utils/planUpdateGuard.js";
import { enforcePlanUserCheckedPermission } from "../../utils/planPermissionGuard.js";
import { enforcePerfilPermission } from "../../utils/perfilPermissionGuard.js";
import { buildPermissionGroups } from "../../utils/permissionGroups.js";
import ChatMsg from "./ChatMsg.jsx";
import PermCard from "./PermCard.jsx";

import { post } from "../../services/api.js";
import { useDocs } from "../../contexts/DocsContext.jsx";

export default function ChatTab({
  docs,
  messages,
  setMessages,
  docsReady,
  docsStatus = "loading",
  docsError = null,
  setTab,
  onGeneratePlan,
  generating,
  planoDate,
  conversationMeta = { type: "general" },
  readOnly = false,
  inputPlaceholder,
  contextBadge,
  conversationId = null,
  cliSessionId: cliSessionIdProp = null,
  hasInFlight = false,
  onAsyncResponseQueued = null,
  pendingPerms = [],
  onAddPermissionGroups = null,
  onResolvePermission = null,
}) {
  const { applyUpdateBatch } = useDocs();
  const { theme } = useTheme();
  const c = theme.colors;
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // Use the CLI session ID from App.jsx (unified namespace); fall back to local UUID
  const [localSessionId] = useState(() => crypto.randomUUID());
  const sessionId = cliSessionIdProp || localSessionId;
  const bottomRef = useRef(null);
  const taRef = useRef(null);
  const isPlanConversation = conversationMeta?.type === "plan";
  const planLoadingLabel = generating && isPlanConversation
    ? (conversationMeta?.originAction === "new_plan" ? "Gerando novo plano..." : "Gerando plano do dia...")
    : null;
  const planDateLock = isPlanConversation
    ? (conversationMeta?.planDate || planoDate || new Date().toLocaleDateString("pt-BR"))
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
    if (!text || loading || hasInFlight || !docsReady || readOnly) return;
    const userMsg = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";
    setLoading(true);

    try {
      const currentMsgs = [...messages, userMsg];
      const apiMsgs = currentMsgs.slice(-40).map(m => ({ role: m.role, content: m.content }));
      let nomePerfil = "Renata";
      try { nomePerfil = JSON.parse(docs.perfil || "{}").nome || "Renata"; } catch { /* ignore */ }
      const normalizedMeta = {
        conversationType: conversationMeta?.type === "plan" ? "plan" : "general",
        planDate: conversationMeta?.type === "plan" ? (conversationMeta?.planDate || planoDate) : null,
        planVersion: Number.isInteger(conversationMeta?.planVersion) ? conversationMeta.planVersion : null,
        originAction: conversationMeta?.originAction || null,
      };
      const instructionPlanDate = normalizedMeta.conversationType === "plan" ? (normalizedMeta.planDate || new Date().toLocaleDateString("pt-BR")) : new Date().toLocaleDateString("pt-BR");
      const planContext = buildRelevantPlanContext(docs, normalizedMeta);
      const data = await sendMessage(
        apiMsgs,
        buildSystemInstructions(nomePerfil, instructionPlanDate),
        buildSystemContext(docs, normalizedMeta),
        {
          ...normalizedMeta,
          planContext,
          _sessionId: sessionId,
          conversationId,
        }
      );
      const asyncResponse = getAsyncClaudeResponse(data);
      if (asyncResponse) {
        onAsyncResponseQueued?.(asyncResponse);
        setLoading(false);
        return;
      }

      const responseId = data?.responseId || data?._responseId || null;
      const parsed = parseClaudeStructuredResponse(data);
      const updates = parsed.updates || [];
      const preparedEntries = updates
        .map((u, idx) => {
          const locked = lockPlanUpdateToDate(u, planDateLock, docs.plano, { allowPlanReplaceAll: false });
          if (!locked) console.warn(`[ChatTab] Update #${idx} dropped by planUpdateGuard:`, { file: u.file, action: u.action, targetDate: u.targetDate });
          return locked;
        })
        .filter(Boolean)
        .map((u) => enforcePlanUserCheckedPermission(u, docs.plano))
        .map((entry) => {
          if (entry.requiresPermission) return entry;
          const perfilCheck = enforcePerfilPermission(entry.update, docs.perfil);
          return perfilCheck.requiresPermission ? perfilCheck : entry;
        });

      const direct = preparedEntries
        .filter((entry) => !entry.update?.requiresPermission)
        .map((entry) => entry.update);
      const perms = preparedEntries.filter((entry) => entry.update?.requiresPermission);

      // Apply direct updates and capture before/after revisions
      const appliedUpdates = direct.length > 0 ? await applyUpdateBatch(direct) : [];

      if (perms.length > 0 && onAddPermissionGroups) {
        onAddPermissionGroups(buildPermissionGroups(perms));
      }

      const aiMsg = { role: "assistant", content: parsed.reply || "...", appliedUpdates, _responseId: responseId };
      setMessages(prev => [...prev, aiMsg]);

      // Acknowledge the pending response so it's not replayed on reconnect
      if (responseId) {
        post("/claude/pending/" + responseId + "/ack", {}).catch(() => {});
      }
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
    if (onResolvePermission) {
      await onResolvePermission(permId, approved);
    }
  }

  async function handleRevert(msgIndex, revisionIndex) {
    const msg = messages[msgIndex];
    if (!msg?.appliedUpdates?.[revisionIndex]) return;
    const rev = msg.appliedUpdates[revisionIndex];
    const currentDoc = docs[rev.docKey] || "";
    if (hashString(currentDoc) !== rev.afterHash) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Não reverti essa alteração porque o documento mudou depois dela. Recarregue o contexto ou aplique uma correção nova.",
      }]);
      return;
    }
    const revertUpdate = lockPlanUpdateToDate(
      { file: rev.file, action: "replace_all", content: rev.before },
      planDateLock,
      docs.plano,
      { allowPlanReplaceAll: true }
    );
    if (!revertUpdate) return;
    await applyUpdateBatch([revertUpdate]);
    setMessages(prev => prev.map((m, i) => {
      if (i !== msgIndex) return m;
      const newUpdates = [...(m.appliedUpdates || [])];
      newUpdates[revisionIndex] = { ...newUpdates[revisionIndex], canRevert: false, revertedAt: new Date().toISOString() };
      return { ...m, appliedUpdates: newUpdates };
    }));
  }

  const quickActions = ["Como foi minha semana?", "Lanche da tarde ideal 🍎", "Estou na TPM 😩", "O que jantar hoje?"];
  const firstSessionActions = [
    "Meu objetivo é perder peso 🎯",
    "Quero ganhar massa muscular 💪",
    "Conta como é minha rotina 📅",
    "Minhas preferências alimentares 🥗",
    "Estou com pouca disposição 😴",
    "Não sei por onde começar 🤔",
  ];
  const showWelcome = docsReady && messages.length === 0 && !generating && !isPlanConversation;

  const todayKey = (planoDate || new Date().toLocaleDateString("pt-BR"));
  const hasPlanToday = (() => {
    try {
      const dict = JSON.parse(docs?.plano || "{}");
      return !!dict?.[todayKey];
    } catch { return false; }
  })();
  const isFirstSession = (() => {
    try {
      const perfilObj = JSON.parse(docs?.perfil || "{}");
      // Pos-onboarding o usuario ja tem nome + objetivo + restricoes/treinos.
      // Idade e peso_kg sao capturados pela IA via chat — enquanto faltarem,
      // mantem welcome "Prazer em te conhecer" para sinalizar descoberta inicial.
      return !(perfilObj.idade && perfilObj.peso_kg);
    } catch { return true; }
  })();

  // Auto-resize textarea up to 3 visible lines, then scroll
  const autoResizeTextarea = useCallback((el) => {
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 22;
    const maxHeight = lineHeight * 3 + 22; // 3 lines + vertical padding
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, []);

  return (
    <div className="pt-chat">
      <div className="pt-chat__messages">
        {!docsReady && docsStatus !== "error" && <div style={{ textAlign: "center", marginTop: "40px", color: c.textMuted, fontFamily: theme.font, fontSize: "14px" }}>Carregando memória...</div>}
        {docsStatus === "error" && (
          <div style={{ textAlign: "center", marginTop: "40px", color: c.danger || "#C05A3A", fontFamily: theme.font, fontSize: "14px", padding: "0 20px" }}>
            {docsError || "Erro ao carregar memória. Tente recarregar o app."}
          </div>
        )}

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

        {showWelcome && (
          <div className="pt-chat__welcome">
            <div className="pt-chat__welcome-avatar">🌿</div>
            {isFirstSession ? (
              <>
                <h3 className="pt-chat__welcome-heading">Prazer em te conhecer!</h3>
                <p className="pt-chat__welcome-subtitle">Antes de criar um plano, quero entender você melhor. Conta sobre seus objetivos, rotina e preferências.</p>
                <div className="pt-chat__quick-actions" style={{ marginTop: "22px", width: "100%", maxWidth: "310px" }}>
                  {firstSessionActions.map(s => (
                    <button key={s} className="pt-chat__quick-action" onClick={() => { setInput(s); taRef.current?.focus(); }}>
                      {s}
                    </button>
                  ))}
                </div>
              </>
            ) : hasPlanToday ? (
              <>
                <h3 className="pt-chat__welcome-heading">Olá!</h3>
                <p className="pt-chat__welcome-subtitle">Estou aqui para te acompanhar. Como você está hoje?</p>
                <button onClick={() => setTab && setTab("plano")}
                  style={{ marginTop: "22px", width: "100%", maxWidth: "310px", padding: "14px 20px", background: `linear-gradient(135deg,${c.primaryLight},${c.primary})`, color: "#FFF", border: "none", borderRadius: "16px", fontFamily: theme.font, fontSize: "15px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", boxShadow: `0 4px 16px ${c.primary}40` }}>
                  📋 Ver plano de hoje
                </button>
                <div className="pt-chat__quick-actions" style={{ marginTop: "12px", width: "100%", maxWidth: "310px" }}>
                  {quickActions.map(s => (
                    <button key={s} className="pt-chat__quick-action" onClick={() => { setInput(s); taRef.current?.focus(); }}>
                      {s}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        )}

        {messages.map((m, i) => (
          <ChatMsg key={i} msg={m} msgIndex={i} setTab={setTab} onRevert={handleRevert} />
        ))}

        {(loading || generating || hasInFlight) && (
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
          <PermCard key={p.id} prompt={p.prompt} onYes={() => handlePerm(p.id, true)} onNo={() => handlePerm(p.id, false)} />
        ))}

        <div ref={bottomRef} />
      </div>

      <div className="pt-chat__input-area">
        <textarea ref={taRef} value={input}
          onChange={e => { setInput(e.target.value); autoResizeTextarea(e.target); }}
          placeholder={docsReady ? (inputPlaceholder || "Escreva aqui...") : "Carregando..."}
          disabled={!docsReady || readOnly || generating || hasInFlight} rows={1}
          className="pt-chat__textarea" />
        <button onClick={send} disabled={!input.trim() || (loading || generating || hasInFlight) || !docsReady || readOnly}
          className={`pt-chat__send ${input.trim() && !(loading || generating || hasInFlight) && docsReady ? "pt-chat__send--active" : ""}`}>
          ➤
        </button>
      </div>
    </div>
  );
}
