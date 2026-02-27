import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "./contexts/AuthContext.jsx";
import { useDocs } from "./contexts/DocsContext.jsx";
import { useTheme } from "./contexts/ThemeContext.jsx";
import { get, put, post, del } from "./services/api.js";
import { buildRelevantPlanContext, buildSystemInstructions, buildSystemContext } from "./data/prompts.js";
import { sendMessage } from "./services/claudeService.js";
import {
  getClaudeResponseUserMessage,
  isClaudeResponseParseError,
  parseClaudeStructuredResponse,
} from "./services/claudeResponseParser.js";
import { FILE_TO_STATE, PROGRESSO_EMOJIS } from "./data/constants.js";
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
import "./styles/components/app-shell.css";
import "./styles/components/header.css";
import "./styles/components/bottom-nav.css";
import "./styles/components/chat.css";

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
  const { docs, docsReady, setDocs, saveDoc, applyUpdate } = useDocs();
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

  // Save messages to backend whenever they change
  useEffect(() => {
    if (!isAuthenticated || messages.length === 0) return;
    const timer = setTimeout(() => {
      put("/conversations/current", {
        messages: messages.slice(-60),
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
    const now = new Date();
    const today = now.toLocaleDateString("pt-BR");
    const weekday = now.toLocaleDateString("pt-BR", { weekday: "long" });
    const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const instructionPlanDate = contextOpts.conversationType === "plan" ? (contextOpts.planDate || planoDate) : today;
    let nomePerfil = "Renata";
    try { nomePerfil = JSON.parse(docs.perfil || "{}").nome || "Renata"; } catch { /* ignore */ }

    const planContext = buildRelevantPlanContext(docs, contextOpts);
    const data = await sendMessage(
      apiMsgs,
      buildSystemInstructions(nomePerfil, today, weekday, timeStr, instructionPlanDate),
      buildSystemContext(docs, contextOpts),
      {
        ...contextOpts,
        planContext,
        autoAction: options.autoAction || null,
      }
    );
    const parsed = parseClaudeStructuredResponse(data);

    const appliedUpdates = [];
    const planDateLock = contextOpts.conversationType === "plan" ? (contextOpts.planDate || planoDate) : null;
    const allowPlanReplaceAll = options.autoAction === "generate_plan" || options.autoAction === "new_plan";
    for (const u of (parsed.updates || []).filter(u => !u.requiresPermission)) {
      const guardedUpdate = lockPlanUpdateToDate(u, planDateLock, docs.plano, { allowPlanReplaceAll });
      if (!guardedUpdate) continue;
      const revision = await applyUpdate(guardedUpdate);
      if (revision) appliedUpdates.push(revision);
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

      if (!planoDict?.[planoDate]) {
        return false;
      }

      delete planoDict[planoDate];
      const nextPlano = JSON.stringify(planoDict);
      setDocs(prev => ({ ...prev, plano: nextPlano }));
      await saveDoc("plano", nextPlano);
      return true;
    } catch (e) {
      console.error("removePlanForSelectedDate:", e);
      return false;
    } finally {
      setRemovingPlan(false);
    }
  }


  async function handleToggleItem(itemId) {
    let planoDict;
    try { planoDict = JSON.parse(docs.plano); } catch { return; }
    
    // Migrate old flat format on the fly
    if (planoDict.grupos) {
      const oldDate = planoDict.date || planoDate;
      planoDict = { [oldDate]: planoDict };
    }

    const planoObj = planoDict[planoDate];
    if (!planoObj?.grupos) return;

    let targetItem = null;
    for (const g of planoObj.grupos) {
      for (const item of g.itens) {
        if (item.id === itemId) { targetItem = item; break; }
      }
      if (targetItem) break;
    }
    if (!targetItem) return;

    const newChecked = !targetItem.checked;
    targetItem.checked = newChecked;
    if (newChecked) {
      targetItem.checked_source = "user";
    } else {
      delete targetItem.checked_source;
    }

    const newPlano = JSON.stringify(planoDict);
    setDocs(prev => ({ ...prev, plano: newPlano }));
    await saveDoc("plano", newPlano);

    if (targetItem.tipo === "alimento" && targetItem.nutri) {
      await syncCalItem(targetItem, newChecked, planoDate);
    } else if (targetItem.tipo === "treino") {
      await syncTreinoItem(targetItem, newChecked, planoDate);
    }
  }

  async function syncCalItem(item, checked, dateStr) {
    let calObj;
    try { calObj = JSON.parse(docs.cal || "{}"); } catch { calObj = {}; }
    if (!calObj.dias) calObj.dias = {};
    if (!calObj.dias[dateStr]) calObj.dias[dateStr] = { kcal_consumido: 0, proteina_g: 0, carbo_g: 0, gordura_g: 0, fibra_g: 0, refeicoes: [] };

    const dia = calObj.dias[dateStr];
    const n = item.nutri;
    const sign = checked ? 1 : -1;

    dia.kcal_consumido = Math.max(0, Math.round((dia.kcal_consumido || 0) + sign * (n.kcal || 0)));
    dia.proteina_g = Math.max(0, +(((dia.proteina_g || 0) + sign * (n.proteina_g || 0)).toFixed(1)));
    dia.carbo_g = Math.max(0, +(((dia.carbo_g || 0) + sign * (n.carbo_g || 0)).toFixed(1)));
    dia.gordura_g = Math.max(0, +(((dia.gordura_g || 0) + sign * (n.gordura_g || 0)).toFixed(1)));
    dia.fibra_g = Math.max(0, +(((dia.fibra_g || 0) + sign * (n.fibra_g || 0)).toFixed(1)));

    if (checked) {
      dia.refeicoes = dia.refeicoes || [];
      dia.refeicoes.push(`${item.texto} (${n.kcal}kcal)`);
    } else {
      dia.refeicoes = (dia.refeicoes || []).filter(r => !r.startsWith(item.texto));
    }

    const newCal = JSON.stringify(calObj);
    setDocs(prev => ({ ...prev, cal: newCal }));
    await saveDoc("cal", newCal);
  }

  async function syncTreinoItem(item, checked, dateStr) {
    let treinosObj;
    try { treinosObj = JSON.parse(docs.treinos || "{}"); } catch { treinosObj = {}; }
    if (!treinosObj.registros) treinosObj.registros = [];

    const existingIdx = treinosObj.registros.findIndex(r => r.data === dateStr && r.tipo === (item.treino_tipo || item.texto));

    if (checked) {
      const reg = { data: dateStr, tipo: item.treino_tipo || item.texto, duracao_min: item.duracao_min || 60, realizado: true };
      if (existingIdx >= 0) {
        treinosObj.registros[existingIdx] = reg;
      } else {
        treinosObj.registros.push(reg);
      }
    } else {
      if (existingIdx >= 0) {
        treinosObj.registros.splice(existingIdx, 1);
      }
    }

    const newTreinos = JSON.stringify(treinosObj);
    setDocs(prev => ({ ...prev, treinos: newTreinos }));
    await saveDoc("treinos", newTreinos);
  }

  async function savePerfil(json) {
    setDocs(prev => ({ ...prev, perfil: json }));
    await saveDoc("perfil", json);
  }
  async function saveMacro(text) {
    setDocs(prev => ({ ...prev, macro: text }));
    await saveDoc("macro", text);
  }
  async function saveMicro(text) {
    setDocs(prev => ({ ...prev, micro: text }));
    await saveDoc("micro", text);
  }

  if (isLoading) return <LoadingScreen />;
  if (needsSetup) return <SetupForm />;
  if (!isAuthenticated) return <LoginForm />;

  const renderView = () => {
    return (
      <>
        <div style={{ display: activeTab === "chat" ? "block" : "none", height: "100%", width: "100%" }}>
          <ChatTab
            docs={docs}
            setDocs={setDocs}
            messages={messages}
            setMessages={setMessages}
            docsReady={docsReady}
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
        {activeTab === "saude" && <SaudeView cal={docs.cal} treinos={docs.treinos} />}
        {activeTab === "progresso" && <ProgressoView progresso={docs.progresso} />}
        {activeTab === "caderno" && <CadernoView hist={docs.hist} mem={docs.mem} macro={docs.macro} micro={docs.micro} />}
        {activeTab === "perfil" && <PerfilTab perfil={docs.perfil} onSave={savePerfil} macro={docs.macro} micro={docs.micro} onSaveMacro={saveMacro} onSaveMicro={saveMicro} />}
        {activeTab === "logs" && <LogsView />}
      </>
    );
  };

  return (
    <div className="pt-app">
      <Header docsReady={docsReady} onHistory={() => setShowHistory(true)} onNewConvo={startNewConvo} hasMessages={messages.length > 0} />
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
