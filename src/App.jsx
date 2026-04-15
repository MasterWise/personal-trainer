import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "./contexts/AuthContext.jsx";
import { useDocs } from "./contexts/DocsContext.jsx";
import { useTheme } from "./contexts/ThemeContext.jsx";
import { useToast } from "./contexts/ToastContext.jsx";
import { get, put, post, del } from "./services/api.js";
import { buildRelevantPlanContext, buildSystemInstructions, buildSystemContext } from "./data/prompts.js";
import { sendMessage } from "./services/claudeService.js";
import {
  getClaudeResponseUserMessage,
  isClaudeResponseParseError,
  parseClaudeStructuredResponse,
} from "./services/claudeResponseParser.js";
import { lockPlanUpdateToDate } from "./utils/planUpdateGuard.js";
import Header from "./components/layout/Header.jsx";
import TabBar from "./components/layout/TabBar.jsx";
import ChatTab from "./components/chat/ChatTab.jsx";
import ConvoDrawerReal from "./components/chat/ConvoDrawer.jsx";
import PlanoView from "./views/PlanoView.jsx";
import SaudeView from "./views/SaudeView.jsx";
import ProgressoView from "./views/ProgressoView.jsx";
import CadernoView from "./views/CadernoView.jsx";
import LogsView from "./views/LogsView.jsx";
import PerfilTab from "./components/perfil/PerfilTab.jsx";
import { deriveHealthViewModel } from "./utils/healthModel.js";
import { diffPerfil, buildMedidaFromDiff, buildProgressoFromDiff } from "./utils/perfilDiff.js";
import { PROGRESSO_EMOJIS } from "./data/constants.js";
import { evaluateAdherenceTriggers } from "./utils/adherenceTriggers.js";
import "./styles/components/app-shell.css";
import "./styles/components/header.css";
import "./styles/components/bottom-nav.css";
import "./styles/components/chat.css";
import "./styles/components/accessibility.css";

/* ── Auth screens ── */
function SetupForm() {
  const { signup } = useAuth();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signup(name, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", padding: "24px", background: "var(--pt-color-bg)" }}>
      <div style={{ width: "64px", height: "64px", borderRadius: "20px", background: "linear-gradient(135deg, var(--pt-color-primary-light), var(--pt-color-primary))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", marginBottom: "20px", boxShadow: "0 6px 24px rgba(184,120,80,0.3)" }}>🌿</div>
      <h1 style={{ fontFamily: "var(--pt-font-heading)", color: "var(--pt-color-text)", marginBottom: "6px", fontSize: "1.5rem" }}>Bem-vinda!</h1>
      <p style={{ color: "var(--pt-color-text-muted)", marginBottom: "24px", fontSize: "14px", textAlign: "center" }}>Crie sua conta para começar</p>
      <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: "320px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" required style={{ padding: "12px 16px", borderRadius: "12px", border: "1px solid var(--pt-color-border)", background: "var(--pt-color-surface)", fontFamily: "var(--pt-font-body)", fontSize: "14px", color: "var(--pt-color-text)", outline: "none" }} />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Senha" required minLength={4} style={{ padding: "12px 16px", borderRadius: "12px", border: "1px solid var(--pt-color-border)", background: "var(--pt-color-surface)", fontFamily: "var(--pt-font-body)", fontSize: "14px", color: "var(--pt-color-text)", outline: "none" }} />
        {error && <p style={{ color: "var(--pt-color-danger)", fontSize: "13px" }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ padding: "12px", borderRadius: "12px", border: "none", background: "var(--pt-color-primary)", color: "#FFF", fontFamily: "var(--pt-font-body)", fontWeight: 700, fontSize: "15px", cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1 }}>
          {loading ? "Criando..." : "Criar conta"}
        </button>
      </form>
    </div>
  );
}

function LoginForm() {
  const { login } = useAuth();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(name, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", padding: "24px", background: "var(--pt-color-bg)" }}>
      <div style={{ width: "64px", height: "64px", borderRadius: "20px", background: "linear-gradient(135deg, var(--pt-color-primary-light), var(--pt-color-primary))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", marginBottom: "20px", boxShadow: "0 6px 24px rgba(184,120,80,0.3)" }}>🌿</div>
      <h1 style={{ fontFamily: "var(--pt-font-heading)", color: "var(--pt-color-text)", marginBottom: "6px", fontSize: "1.5rem" }}>Entrar</h1>
      <p style={{ color: "var(--pt-color-text-muted)", marginBottom: "24px", fontSize: "14px", textAlign: "center" }}>Acesse sua conta</p>
      <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: "320px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" required style={{ padding: "12px 16px", borderRadius: "12px", border: "1px solid var(--pt-color-border)", background: "var(--pt-color-surface)", fontFamily: "var(--pt-font-body)", fontSize: "14px", color: "var(--pt-color-text)", outline: "none" }} />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Senha" required style={{ padding: "12px 16px", borderRadius: "12px", border: "1px solid var(--pt-color-border)", background: "var(--pt-color-surface)", fontFamily: "var(--pt-font-body)", fontSize: "14px", color: "var(--pt-color-text)", outline: "none" }} />
        {error && <p style={{ color: "var(--pt-color-danger)", fontSize: "13px" }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ padding: "12px", borderRadius: "12px", border: "none", background: "var(--pt-color-primary)", color: "#FFF", fontFamily: "var(--pt-font-body)", fontWeight: 700, fontSize: "15px", cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1 }}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}

function RegisterForm() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteInfo, setInviteInfo] = useState(null);
  const [inviteError, setInviteError] = useState(null);
  const [showLogin, setShowLogin] = useState(false);

  const inviteCode = new URLSearchParams(window.location.search).get("invite");

  useEffect(() => {
    if (!inviteCode) {
      setInviteError("Nenhum código de convite informado");
      return;
    }
    fetch(`/api/pt/auth/invite/${encodeURIComponent(inviteCode)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setInviteInfo(data);
        } else {
          setInviteError(
            data.reason === "used" ? "Este convite já foi utilizado"
            : data.reason === "expired" ? "Este convite expirou"
            : "Convite inválido"
          );
        }
      })
      .catch(() => setInviteError("Erro ao validar convite"));
  }, [inviteCode]);

  if (showLogin) return <LoginForm />;

  if (inviteError) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", padding: "24px", background: "var(--pt-color-bg)" }}>
        <div style={{ width: "64px", height: "64px", borderRadius: "20px", background: "linear-gradient(135deg, var(--pt-color-primary-light), var(--pt-color-primary))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", marginBottom: "20px", boxShadow: "0 6px 24px rgba(184,120,80,0.3)" }}>🌿</div>
        <h1 style={{ fontFamily: "var(--pt-font-heading)", color: "var(--pt-color-text)", marginBottom: "6px", fontSize: "1.3rem" }}>Convite inválido</h1>
        <p style={{ color: "var(--pt-color-text-muted)", marginBottom: "24px", fontSize: "14px", textAlign: "center", lineHeight: "1.6" }}>{inviteError}<br />Peça um novo convite ao administrador.</p>
        <button onClick={() => setShowLogin(true)} style={{ background: "none", border: "none", color: "var(--pt-color-primary)", fontFamily: "var(--pt-font-body)", fontSize: "14px", fontWeight: "600", cursor: "pointer" }}>
          Já tem conta? Entrar
        </button>
      </div>
    );
  }

  if (!inviteInfo) return <LoadingScreen />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(name, password, inviteCode);
      window.history.replaceState({}, "", window.location.pathname);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", padding: "24px", background: "var(--pt-color-bg)" }}>
      <div style={{ width: "64px", height: "64px", borderRadius: "20px", background: "linear-gradient(135deg, var(--pt-color-primary-light), var(--pt-color-primary))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", marginBottom: "20px", boxShadow: "0 6px 24px rgba(184,120,80,0.3)" }}>🌿</div>
      <h1 style={{ fontFamily: "var(--pt-font-heading)", color: "var(--pt-color-text)", marginBottom: "6px", fontSize: "1.5rem" }}>Criar sua conta</h1>
      <p style={{ color: "var(--pt-color-text-muted)", marginBottom: "24px", fontSize: "14px", textAlign: "center" }}>Convite de <strong>{inviteInfo.createdBy}</strong></p>
      <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: "320px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" required style={{ padding: "12px 16px", borderRadius: "12px", border: "1px solid var(--pt-color-border)", background: "var(--pt-color-surface)", fontFamily: "var(--pt-font-body)", fontSize: "14px", color: "var(--pt-color-text)", outline: "none" }} />
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Senha" required minLength={4} style={{ padding: "12px 16px", borderRadius: "12px", border: "1px solid var(--pt-color-border)", background: "var(--pt-color-surface)", fontFamily: "var(--pt-font-body)", fontSize: "14px", color: "var(--pt-color-text)", outline: "none" }} />
        {error && <p style={{ color: "var(--pt-color-danger)", fontSize: "13px" }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ padding: "12px", borderRadius: "12px", border: "none", background: "var(--pt-color-primary)", color: "#FFF", fontFamily: "var(--pt-font-body)", fontWeight: 700, fontSize: "15px", cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1 }}>
          {loading ? "Criando..." : "Criar conta"}
        </button>
      </form>
      <button onClick={() => setShowLogin(true)} style={{ background: "none", border: "none", color: "var(--pt-color-primary)", fontFamily: "var(--pt-font-body)", fontSize: "13px", fontWeight: "600", cursor: "pointer", marginTop: "16px" }}>
        Já tem conta? Entrar
      </button>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: "var(--pt-color-bg)", gap: "16px" }}>
      <div style={{ width: "52px", height: "52px", borderRadius: "16px", background: "linear-gradient(135deg, var(--pt-color-primary-light), var(--pt-color-primary))", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "24px" }}>🌿</div>
      <p style={{ color: "var(--pt-color-text-muted)", fontSize: "14px", fontFamily: "var(--pt-font-body)" }}>Carregando...</p>
    </div>
  );
}

const DEFAULT_CONVO_META = {
  type: "general",
  planDate: null,
  planVersion: null,
  planThreadKey: null,
  originAction: null,
};

function normalizeConvoMeta(meta) {
  if (!meta || typeof meta !== "object") return DEFAULT_CONVO_META;
  return {
    type: meta.type === "plan" ? "plan" : "general",
    planDate: typeof meta.planDate === "string" ? meta.planDate : null,
    planVersion: Number.isInteger(meta.planVersion) ? meta.planVersion : null,
    planThreadKey: typeof meta.planThreadKey === "string" ? meta.planThreadKey : null,
    originAction: typeof meta.originAction === "string" ? meta.originAction : null,
  };
}

function formatPlanActionDateLabel(dateStr) {
  const [d, m, y] = String(dateStr || "").split("/");
  if (!d || !m || !y) return dateStr || "";
  const dt = new Date(`${y}-${m}-${d}T12:00:00`);
  return dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}

function getAutoPlanApiInstruction({ action, planDate }) {
  const targetLabel = formatPlanActionDateLabel(planDate);
  if (action === "new_plan") {
    return `Ação automática do app: gere uma NOVA versão completa do plano para ${targetLabel} (${planDate}), usando o contexto fornecido em <action_context>, <plan_context> e <memory_context>.`;
  }
  return `Ação automática do app: gere o plano completo do dia para ${targetLabel} (${planDate}), usando o contexto fornecido em <action_context>, <plan_context> e <memory_context>.`;
}

function getChatPlaceholder(meta, readOnly, generating) {
  if (readOnly) return "Visualizando versão histórica (somente leitura)";
  if (generating && meta?.type === "plan") {
    return meta?.originAction === "new_plan" ? "Gerando novo plano..." : "Gerando plano do dia...";
  }
  if (meta?.type === "plan") return "O que você gostaria de mudar no plano?";
  return "Escreva aqui... (Enter envia)";
}

function getChatContextBadge(meta, readOnly, generating) {
  if (meta?.type !== "plan" || !meta.planDate) return null;
  const versionLabel = meta.planVersion ? ` · v${meta.planVersion}` : "";
  if (readOnly) return `Versão histórica do plano ${meta.planDate}${versionLabel}`;
  if (generating) {
    if (meta.originAction === "new_plan") return `Gerando novo plano ${meta.planDate}${versionLabel}`;
    if (meta.originAction === "generate_plan") return `Gerando plano ${meta.planDate}${versionLabel}`;
  }
  if (meta.originAction === "edit_plan") return `Editando plano ${meta.planDate}${versionLabel}`;
  return `Plano ${meta.planDate}${versionLabel}`;
}

function hasPlanoForDate(planoStr, dateStr) {
  try {
    const parsed = JSON.parse(planoStr || "{}");
    if (parsed && parsed.grupos) {
      const oldDate = parsed.date || dateStr;
      return oldDate === dateStr && Array.isArray(parsed.grupos) && parsed.grupos.length > 0;
    }
    if (!parsed || typeof parsed !== "object") return false;
    const plan = parsed[dateStr];
    return !!(plan && Array.isArray(plan.grupos) && plan.grupos.length > 0);
  } catch {
    return false;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   APP
══════════════════════════════════════════════════════════════════════════ */
export default function App() {
  const { isAuthenticated, isLoading, needsSetup } = useAuth();
  const {
    docs,
    docsReady,
    docsStatus,
    docsError,
    docsGeneration,
    mutateDocs,
    applyUpdateBatch,
  } = useDocs();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState("chat");
  const [planoDate, setPlanoDate] = useState(new Date().toLocaleDateString("pt-BR"));
  const [messages, setMessages] = useState([]);
  const [currentConvoId, setCurrentConvoId] = useState(null);
  const [currentConvoMeta, setCurrentConvoMeta] = useState(DEFAULT_CONVO_META);
  const [chatReadOnly, setChatReadOnly] = useState(false);
  const [convos, setConvos] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showPlanHistory, setShowPlanHistory] = useState(false);
  const [planHistoryItems, setPlanHistoryItems] = useState([]);
  const [planHistoryLoading, setPlanHistoryLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [removingPlan, setRemovingPlan] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevMsgsLen = useRef(0);
  // Stable session ID for CLI bridges — independent of currentConvoId (which starts null
  // for new conversations and would break isResume detection on turn 2).
  const cliSessionIdRef = useRef(crypto.randomUUID());

  useEffect(() => {
    const len = messages.length;
    if (len > prevMsgsLen.current) {
      if (activeTab !== "chat" && messages[len - 1].role === "assistant") {
        setUnreadCount(prev => prev + 1);
      }
    }
    prevMsgsLen.current = len;
  }, [messages, activeTab]);

  useEffect(() => {
    if (activeTab === "chat") {
      setUnreadCount(0);
    }
  }, [activeTab]);

  // Load current conversation and archived convos on auth
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    async function load() {
      try {
        const [currentRes, archiveRes] = await Promise.all([
          get("/conversations/current"),
          get("/conversations"),
        ]);
        if (cancelled) return;
        setMessages(currentRes.messages || []);
        setCurrentConvoId(currentRes.id || null);
        setCurrentConvoMeta(normalizeConvoMeta(currentRes));
        setChatReadOnly(currentRes?.type === "plan" && currentRes?.isLatestPlanVersion === false);
        const archived = Array.isArray(archiveRes) ? archiveRes : [];
        setConvos(archived.map(c => ({
          id: c.id,
          date: c.createdAt || c.created_at,
          preview: c.preview,
          count: c.messageCount ?? c.message_count ?? 0,
          messages: Array.isArray(c.messages) ? c.messages : [],
          meta: normalizeConvoMeta(c),
        })));
      } catch { /* ignore */ }
    }
    load();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || docsGeneration === 0) return;
    cliSessionIdRef.current = crypto.randomUUID();
    setMessages([]);
    setCurrentConvoId(null);
    setCurrentConvoMeta(DEFAULT_CONVO_META);
    setChatReadOnly(false);
    setShowHistory(false);
    setShowPlanHistory(false);
    setActiveTab("chat");
  }, [docsGeneration, isAuthenticated]);

  // Save messages to backend whenever they change
  useEffect(() => {
    if (!isAuthenticated || (!currentConvoId && messages.length === 0)) return;
    const timer = setTimeout(() => {
      put("/conversations/current", {
        conversationId: currentConvoId,
        messages,
        meta: currentConvoMeta,
      }).then((res) => {
        if (res?.id) setCurrentConvoId(res.id);
      }).catch(() => {});
    }, 500);
    return () => clearTimeout(timer);
  }, [messages, isAuthenticated, currentConvoMeta]);

  function applyCurrentConversation(conversation, options = {}) {
    const convo = conversation || null;
    const meta = normalizeConvoMeta(convo || {});
    cliSessionIdRef.current = crypto.randomUUID();
    setCurrentConvoId(convo?.id || null);
    setCurrentConvoMeta(meta);
    setMessages(Array.isArray(convo?.messages) ? convo.messages : []);
    setChatReadOnly(Boolean(options.readOnly));
    if (options.closeHistory !== false) setShowHistory(false);
    if (options.closePlanHistory !== false) setShowPlanHistory(false);
    if (options.switchToChat !== false) setActiveTab("chat");
  }

  async function refreshGeneralConvos() {
    try {
      const archiveRes = await get("/conversations");
      const archived = Array.isArray(archiveRes) ? archiveRes : [];
      setConvos(archived.map(c => ({
        id: c.id,
        date: c.createdAt || c.created_at,
        preview: c.preview,
        count: c.messageCount ?? c.message_count ?? 0,
        messages: Array.isArray(c.messages) ? c.messages : [],
        meta: normalizeConvoMeta(c),
      })));
    } catch {
      /* ignore */
    }
  }

  async function archiveCurrentConversationIfNeeded() {
    if (!currentConvoId && messages.length === 0) return;
    try {
      await post("/conversations/archive", {});
    } catch {
      /* ignore */
    }
    await refreshGeneralConvos();
  }

  async function activateConversation(conversationId, options = {}) {
    const res = await post("/conversations/activate", { id: conversationId });
    applyCurrentConversation(res.conversation, {
      readOnly: options.readOnly ?? (res.isLatestPlanVersion === false),
      closeHistory: options.closeHistory,
      closePlanHistory: options.closePlanHistory,
      switchToChat: options.switchToChat,
    });
    await refreshGeneralConvos();
    return res;
  }

  function getLlmContextOptionsForConversation(meta) {
    const normalized = normalizeConvoMeta(meta);
    return normalized.type === "plan"
      ? {
          conversationType: "plan",
          planDate: normalized.planDate || planoDate,
          planVersion: normalized.planVersion,
          originAction: normalized.originAction,
        }
      : {
          conversationType: "general",
          planDate: null,
          planVersion: null,
          originAction: null,
        };
  }

  async function requestClaudeForMessages(currentMsgs, convoMetaForRequest, options = {}) {
    const contextOpts = getLlmContextOptionsForConversation(convoMetaForRequest);
    const apiMsgs = currentMsgs.slice(-40).map(m => ({ role: m.role, content: m.content }));
    const apiOnlyUserInstruction = typeof options.apiOnlyUserInstruction === "string"
      ? options.apiOnlyUserInstruction.trim()
      : "";
    if (apiOnlyUserInstruction) {
      apiMsgs.push({ role: "user", content: apiOnlyUserInstruction });
    }
    const instructionPlanDate = contextOpts.conversationType === "plan" ? (contextOpts.planDate || planoDate) : new Date().toLocaleDateString("pt-BR");
    let nomePerfil = "Renata";
    try { nomePerfil = JSON.parse(docs.perfil || "{}").nome || "Renata"; } catch { /* ignore */ }

    const planContext = buildRelevantPlanContext(docs, contextOpts);
    const data = await sendMessage(
      apiMsgs,
      buildSystemInstructions(nomePerfil, instructionPlanDate),
      buildSystemContext(docs, contextOpts),
      {
        ...contextOpts,
        planContext,
        autoAction: options.autoAction || null,
        _sessionId: cliSessionIdRef.current,
      }
    );
    const parsed = parseClaudeStructuredResponse(data);

    let appliedUpdates = [];
    const planDateLock = contextOpts.conversationType === "plan" ? (contextOpts.planDate || planoDate) : null;
    const allowPlanReplaceAll = options.autoAction === "generate_plan" || options.autoAction === "new_plan";
    const guardedUpdates = [];
    for (const u of (parsed.updates || []).filter(u => !u.requiresPermission)) {
      const guardedUpdate = lockPlanUpdateToDate(u, planDateLock, docs.plano, { allowPlanReplaceAll });
      if (guardedUpdate) guardedUpdates.push(guardedUpdate);
    }

    if (guardedUpdates.length > 0) {
      appliedUpdates = await applyUpdateBatch(guardedUpdates);
    }

    return {
      aiMsg: { role: "assistant", content: parsed.reply || "...", appliedUpdates },
      parsed,
    };
  }

  async function loadPlanHistory(date = planoDate) {
    setPlanHistoryLoading(true);
    try {
      const res = await get(`/conversations/plan/history?date=${encodeURIComponent(date)}`);
      setPlanHistoryItems(Array.isArray(res?.items) ? res.items : []);
      setShowPlanHistory(true);
    } catch (e) {
      console.error("loadPlanHistory:", e);
      setPlanHistoryItems([]);
      setShowPlanHistory(true);
    } finally {
      setPlanHistoryLoading(false);
    }
  }

  async function startNewConvo() {
    if (!currentConvoId && messages.length === 0) return;
    await archiveCurrentConversationIfNeeded();
    cliSessionIdRef.current = crypto.randomUUID();
    setMessages([]);
    setCurrentConvoId(null);
    setCurrentConvoMeta(DEFAULT_CONVO_META);
    setChatReadOnly(false);
    setActiveTab("chat");
  }

  async function loadConvo(c) {
    if (!c?.id) return;
    if (currentConvoId && currentConvoId !== c.id) {
      await archiveCurrentConversationIfNeeded();
    }
    await activateConversation(c.id, { readOnly: false, closeHistory: true, closePlanHistory: false, switchToChat: true });
  }

  async function deleteConvo(id) {
    try { await del(`/conversations/${id}`); } catch { /* ignore */ }
    setConvos(prev => prev.filter(c => c.id !== id));
  }

  async function openPlanVersion(conversationId, isLatestVersion) {
    if (!conversationId) return;
    if (currentConvoId && currentConvoId !== conversationId) {
      await archiveCurrentConversationIfNeeded();
    }
    await activateConversation(conversationId, {
      readOnly: !isLatestVersion,
      closeHistory: true,
      closePlanHistory: true,
      switchToChat: true,
    });
  }

  async function editPlanConversation() {
    if (generating) return;
    setActiveTab("chat");

    try {
      const latestRes = await get(`/conversations/plan/latest?date=${encodeURIComponent(planoDate)}`);
      if (latestRes?.exists && latestRes.conversation) {
        if (currentConvoId && currentConvoId !== latestRes.conversation.id) {
          await archiveCurrentConversationIfNeeded();
        }
        if (currentConvoId !== latestRes.conversation.id) {
          await activateConversation(latestRes.conversation.id, {
            readOnly: false,
            closeHistory: true,
            closePlanHistory: true,
            switchToChat: true,
          });
        } else {
          setChatReadOnly(false);
        }
      } else {
        if (currentConvoId || messages.length > 0) {
          await archiveCurrentConversationIfNeeded();
        }
        const startRes = await post("/conversations/plan/start", { planDate: planoDate, mode: "edit" });
        applyCurrentConversation(startRes.conversation, { readOnly: false, switchToChat: true });
      }
    } catch (e) {
      console.error("editPlanConversation:", e);
      setMessages(prev => [...prev, { role: "assistant", content: "Erro ao abrir conversa de edição do plano." }]);
    }
  }

  async function createPlanConversation(action) {
    if (generating) return;
    setGenerating(true);
    setActiveTab("chat");

    try {
      if (currentConvoId || messages.length > 0) {
        await archiveCurrentConversationIfNeeded();
      }

      const shouldBehaveAsNewPlan = action === "generate" && !hasPlanoForDate(docs.plano, planoDate);
      const resolvedAction = (action === "new_plan" || shouldBehaveAsNewPlan) ? "new_plan" : "generate";
      const mode = resolvedAction === "new_plan" ? "new_plan" : "generate";
      const startRes = await post("/conversations/plan/start", { planDate: planoDate, mode });
      applyCurrentConversation(startRes.conversation, { readOnly: false, switchToChat: true });

      const convoMeta = normalizeConvoMeta(startRes.conversation);
      const newMsgs = [...(startRes.conversation?.messages || [])];
      setMessages(newMsgs);

      try {
        const { aiMsg } = await requestClaudeForMessages(newMsgs, {
          ...convoMeta,
          type: "plan",
          planDate: planoDate,
          originAction: resolvedAction === "new_plan" ? "new_plan" : "generate_plan",
        }, {
          autoAction: resolvedAction === "new_plan" ? "new_plan" : "generate_plan",
          apiOnlyUserInstruction: getAutoPlanApiInstruction({
            action: resolvedAction === "new_plan" ? "new_plan" : "generate",
            planDate: planoDate,
          }),
        });
        setMessages(prev => [...prev, aiMsg]);
      } catch (e) {
        if (isClaudeResponseParseError(e)) {
          console.error("generatePlan parse error:", e.code, e.meta, e);
        } else {
          console.error("generatePlan:", e);
        }
        setMessages(prev => [...prev, { role: "assistant", content: `Erro ao gerar plano: ${getClaudeResponseUserMessage(e)}` }]);
      }
    } catch (e) {
      console.error("createPlanConversation:", e);
      const msg = e?.message?.includes("Já existe conversa de plano")
        ? "Já existe uma conversa de plano para essa data. Use Editar plano ou Novo plano."
        : "Erro ao iniciar conversa de plano.";
      setMessages(prev => [...prev, { role: "assistant", content: msg }]);
    } finally {
      setGenerating(false);
    }
  }

  async function generatePlan() {
    await createPlanConversation("generate");
  }

  async function generateNewPlanVersion() {
    await createPlanConversation("new_plan");
  }

  async function removePlanForSelectedDate() {
    if (removingPlan) return false;
    setRemovingPlan(true);
    try {
      let planoDict = {};
      let calObj = {};
      let treinosObj = {};
      try {
        const parsed = JSON.parse(docs.plano || "{}");
        if (parsed && parsed.grupos) {
          const oldDate = parsed.date || planoDate;
          planoDict = { [oldDate]: parsed };
        } else if (parsed && typeof parsed === "object") {
          planoDict = parsed;
        }
      } catch {
        planoDict = {};
      }
      try {
        calObj = JSON.parse(docs.cal || "{}");
      } catch {
        calObj = {};
      }
      try {
        treinosObj = JSON.parse(docs.treinos || "{}");
      } catch {
        treinosObj = {};
      }

      if (!planoDict?.[planoDate]) {
        return false;
      }

      const result = await mutateDocs((prevDocs) => {
        const nextDict = JSON.parse(JSON.stringify(planoDict));
        delete nextDict[planoDate];
        const nextCal = { ...(calObj || {}) };
        if (nextCal.dias && typeof nextCal.dias === "object") {
          delete nextCal.dias[planoDate];
        }
        const nextTreinos = {
          ...(treinosObj || {}),
          registros: Array.isArray(treinosObj.registros)
            ? treinosObj.registros.filter((entry) => entry?.data !== planoDate)
            : [],
        };
        return {
          ...prevDocs,
          plano: JSON.stringify(nextDict),
          cal: JSON.stringify(nextCal),
          treinos: JSON.stringify(nextTreinos),
        };
      }, {
        rebuildHealthCache: true,
      });
      return result.changedKeys.length > 0;
    } catch (e) {
      console.error("removePlanForSelectedDate:", e);
      return false;
    } finally {
      setRemovingPlan(false);
    }
  }


  async function handleToggleItem(itemId) {
    await mutateDocs((prevDocs) => {
      let planoDict;
      try {
        planoDict = JSON.parse(prevDocs.plano || "{}");
      } catch {
        return prevDocs;
      }

      if (planoDict.grupos) {
        const oldDate = planoDict.date || planoDate;
        planoDict = { [oldDate]: planoDict };
      }

      const planoObj = planoDict[planoDate];
      if (!planoObj?.grupos) return prevDocs;

      let targetItem = null;
      for (const group of planoObj.grupos) {
        for (const item of group.itens) {
          if (item.id === itemId) {
            targetItem = item;
            break;
          }
        }
        if (targetItem) break;
      }

      if (!targetItem) return prevDocs;

      targetItem.checked = !targetItem.checked;
      if (targetItem.checked) {
        targetItem.checked_source = "user";
      } else {
        delete targetItem.checked_source;
      }

      return {
        ...prevDocs,
        plano: JSON.stringify(planoDict),
      };
    }, {
      rebuildHealthCache: true,
    });
  }

  async function savePerfil(json) {
    // Pre-compute diff outside callback so we can use it for toast after await
    let nextPerfil = {};
    try { nextPerfil = JSON.parse(json || "{}"); } catch { /* ignore */ }
    let prevPerfilForDiff = {};
    try { prevPerfilForDiff = JSON.parse(docs.perfil || "{}"); } catch { /* ignore */ }
    const diffForToast = diffPerfil(prevPerfilForDiff, nextPerfil);

    await mutateDocs((prevDocs) => {
      let prevPerfil = {};
      let nextP = {};
      try { prevPerfil = JSON.parse(prevDocs.perfil || "{}"); } catch { /* ignore */ }
      try { nextP = JSON.parse(json || "{}"); } catch { /* ignore */ }

      const diff = diffPerfil(prevPerfil, nextP);
      const nextDocs = { ...prevDocs, perfil: json };

      // Auto-create medidas entry on body data change (dedup by date)
      if (diff.bodyChanged) {
        const medida = buildMedidaFromDiff(nextP, diff.bodyDelta);
        let medidasArr = [];
        try { medidasArr = JSON.parse(prevDocs.medidas || "[]"); } catch { /* ignore */ }
        const today = new Date().toLocaleDateString("pt-BR");
        const existingIdx = medidasArr.findIndex(m => m.data === today && m.metodo === "perfil");
        if (existingIdx >= 0) {
          medidasArr[existingIdx] = { ...medidasArr[existingIdx], ...medida };
        } else {
          medidasArr.push(medida);
        }
        if (medidasArr.length > 365) medidasArr.splice(0, medidasArr.length - 365);
        nextDocs.medidas = JSON.stringify(medidasArr);
      }

      // Auto-create progresso entries on meta/limitation changes
      const progressoEntries = buildProgressoFromDiff(diff);
      if (progressoEntries.length > 0) {
        let progressoArr = [];
        try { progressoArr = JSON.parse(prevDocs.progresso || "[]"); } catch { /* ignore */ }
        const todayLabel = new Date().toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
        for (const entry of progressoEntries) {
          // Dedup: don't create if same type + title exists for today
          const exists = progressoArr.some(p => p.date === todayLabel && p.type === entry.type && p.title === entry.title);
          if (!exists) {
            progressoArr.push({
              id: Date.now() + Math.random(),
              date: todayLabel,
              emoji: PROGRESSO_EMOJIS[entry.type] || "🔄",
              ...entry,
            });
          }
        }
        nextDocs.progresso = JSON.stringify(progressoArr);
      }

      return nextDocs;
    }, {
      rebuildHealthCache: true,
    });

    if (diffForToast.bodyChanged) {
      toast.show(`📊 Medida registrada: ${diffForToast.bodyDelta.peso_kg?.to || ""}kg`, "success");
    }
  }
  async function saveMacro(text) {
    await mutateDocs((prevDocs) => ({ ...prevDocs, macro: text }));
  }
  async function saveMicro(text) {
    await mutateDocs((prevDocs) => ({ ...prevDocs, micro: text }));
  }

  async function addMedida(medidaObj) {
    await mutateDocs((prevDocs) => {
      let medidasArr = [];
      try { medidasArr = JSON.parse(prevDocs.medidas || "[]"); } catch { /* ignore */ }
      const today = new Date().toLocaleDateString("pt-BR");
      const newEntry = { data: today, ...medidaObj };
      // Dedup: update existing entry for today from same source
      const existingIdx = medidasArr.findIndex(m => m.data === today && m.metodo === (medidaObj.metodo || "manual"));
      if (existingIdx >= 0) {
        medidasArr[existingIdx] = { ...medidasArr[existingIdx], ...newEntry };
      } else {
        medidasArr.push(newEntry);
      }

      if (medidasArr.length > 365) medidasArr.splice(0, medidasArr.length - 365);

      // Also sync perfil with latest body values
      let perfil = {};
      try { perfil = JSON.parse(prevDocs.perfil || "{}"); } catch { /* ignore */ }
      if (medidaObj.peso_kg) perfil.peso_kg = medidaObj.peso_kg;
      if (medidaObj.gordura_pct) perfil.gordura_pct = medidaObj.gordura_pct;
      if (medidaObj.tmb_kcal) perfil.tmb_kcal = medidaObj.tmb_kcal;

      return {
        ...prevDocs,
        medidas: JSON.stringify(medidasArr),
        perfil: JSON.stringify(perfil, null, 2),
      };
    }, { rebuildHealthCache: true });

    toast.show("✓ Medição salva", "success");
  }

  // Automatic progresso triggers from adherence data
  // Must be BEFORE conditional returns to respect Rules of Hooks
  useEffect(() => {
    if (!docsReady || !isAuthenticated) return;
    const timer = setTimeout(() => {
      let medidasArr = [];
      let progressoArr = [];
      try { medidasArr = JSON.parse(docs.medidas || "[]"); } catch { /* ignore */ }
      try { progressoArr = JSON.parse(docs.progresso || "[]"); } catch { /* ignore */ }

      const vm = deriveHealthViewModel({
        planoStr: docs.plano, perfilStr: docs.perfil,
        treinosStr: docs.treinos, calStr: docs.cal,
        selectedDate: planoDate,
      });
      if (!vm) return;

      const triggers = evaluateAdherenceTriggers(vm, medidasArr, progressoArr);
      if (triggers.length > 0) {
        mutateDocs((prevDocs) => {
          let arr = [];
          try { arr = JSON.parse(prevDocs.progresso || "[]"); } catch { /* ignore */ }
          const todayLabel = new Date().toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
          for (const t of triggers) {
            arr.push({
              id: Date.now() + Math.random(),
              date: todayLabel,
              emoji: PROGRESSO_EMOJIS[t.type] || "🏆",
              ...t,
            });
          }
          return { ...prevDocs, progresso: JSON.stringify(arr) };
        });
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [docsReady, isAuthenticated, docs.plano, docs.medidas, docs.progresso]);

  if (isLoading) return <LoadingScreen />;
  if (needsSetup) return <SetupForm />;

  const hasInviteParam = new URLSearchParams(window.location.search).has("invite");
  if (!isAuthenticated && hasInviteParam) return <RegisterForm />;
  if (!isAuthenticated) return <LoginForm />;

  const healthViewModel = deriveHealthViewModel({
    planoStr: docs.plano,
    perfilStr: docs.perfil,
    treinosStr: docs.treinos,
    calStr: docs.cal,
    selectedDate: planoDate,
  });

  const renderView = () => {
    return (
      <>
        <div style={{ display: activeTab === "chat" ? "block" : "none", height: "100%", width: "100%" }}>
          <ChatTab
            docs={docs}
            messages={messages}
            setMessages={setMessages}
            docsReady={docsReady}
            docsStatus={docsStatus}
            docsError={docsError}
            setTab={setActiveTab}
            onGeneratePlan={generatePlan}
            generating={generating}
            planoDate={planoDate}
            conversationMeta={currentConvoMeta}
            readOnly={chatReadOnly}
            inputPlaceholder={getChatPlaceholder(currentConvoMeta, chatReadOnly, generating)}
            contextBadge={getChatContextBadge(currentConvoMeta, chatReadOnly, generating)}
          />
        </div>
        {activeTab === "plano" && (
          <PlanoView
            planoDictStr={docs.plano}
            cal={docs.cal}
            onGeneratePlan={generatePlan}
            onEditPlan={editPlanConversation}
            onNewPlan={generateNewPlanVersion}
            onRemovePlan={removePlanForSelectedDate}
            removingPlan={removingPlan}
            onOpenPlanHistory={() => loadPlanHistory(planoDate)}
            planHistoryOpen={showPlanHistory}
            setPlanHistoryOpen={setShowPlanHistory}
            planHistoryItems={planHistoryItems}
            planHistoryLoading={planHistoryLoading}
            onOpenPlanVersion={openPlanVersion}
            generating={generating}
            onToggleItem={handleToggleItem}
            selectedDate={planoDate}
            setSelectedDate={setPlanoDate}
          />
        )}
        {activeTab === "saude" && (
          <SaudeView
            selectedDate={planoDate}
            setSelectedDate={setPlanoDate}
            viewModel={healthViewModel}
            medidas={docs.medidas}
            perfil={docs.perfil}
            onAddMedida={addMedida}
          />
        )}
        {activeTab === "progresso" && <ProgressoView progresso={docs.progresso} />}
        {activeTab === "caderno" && <CadernoView hist={docs.hist} mem={docs.mem} macro={docs.macro} micro={docs.micro} />}
        {activeTab === "perfil" && <PerfilTab perfil={docs.perfil} onSave={savePerfil} macro={docs.macro} micro={docs.micro} onSaveMacro={saveMacro} onSaveMicro={saveMicro} />}
        {activeTab === "logs" && <LogsView />}
      </>
    );
  };

  return (
    <div className="pt-app">
      <Header
        docsReady={docsReady}
        docsStatus={docsStatus}
        docsError={docsError}
        onHistory={() => setShowHistory(true)}
        onNewConvo={startNewConvo}
        hasMessages={messages.length > 0}
      />
      <div className="pt-content">
        {renderView()}
      </div>
      <TabBar tab={activeTab} setTab={setActiveTab} unreadCount={unreadCount} />
      {showHistory && (
        <ConvoDrawerReal convos={convos} onLoad={loadConvo} onDelete={deleteConvo} onClose={() => setShowHistory(false)} />
      )}
    </div>
  );
}
