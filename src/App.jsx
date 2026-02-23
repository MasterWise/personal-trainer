import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "./contexts/AuthContext.jsx";
import { useDocs } from "./contexts/DocsContext.jsx";
import { useTheme } from "./contexts/ThemeContext.jsx";
import { get, put, post, del } from "./services/api.js";
import { buildSystemInstructions, buildSystemContext } from "./data/prompts.js";
import { sendMessage } from "./services/claudeService.js";
import {
  getClaudeResponseUserMessage,
  isClaudeResponseParseError,
  parseClaudeStructuredResponse,
} from "./services/claudeResponseParser.js";
import { FILE_TO_STATE, PROGRESSO_EMOJIS } from "./data/constants.js";
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

/* ══════════════════════════════════════════════════════════════════════════
   APP
══════════════════════════════════════════════════════════════════════════ */
export default function App() {
  const { isAuthenticated, isLoading, needsSetup } = useAuth();
  const { docs, docsReady, setDocs, saveDoc, applyUpdate } = useDocs();
  const [activeTab, setActiveTab] = useState("chat");
  const [planoDate, setPlanoDate] = useState(new Date().toLocaleDateString("pt-BR"));
  const [messages, setMessages] = useState([]);
  const [convos, setConvos] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [generating, setGenerating] = useState(false);
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
        const archived = Array.isArray(archiveRes) ? archiveRes : [];
        setConvos(archived.map(c => ({
          id: c.id,
          date: c.created_at,
          preview: c.preview,
          count: c.message_count,
          messages: JSON.parse(c.messages || "[]"),
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
      put("/conversations/current", { messages: messages.slice(-60) }).catch(() => {});
    }, 500);
    return () => clearTimeout(timer);
  }, [messages, isAuthenticated]);

  async function startNewConvo() {
    if (messages.length === 0) return;
    try { await post("/conversations/archive", {}); } catch { /* ignore */ }
    const archived = messages.length > 0 ? {
      id: Date.now(),
      date: new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      preview: (messages.find(m => m.role === "user")?.content || "Conversa").slice(0, 120),
      count: messages.length,
      messages: messages.slice(-60),
    } : null;
    if (archived) setConvos(prev => [...prev, archived]);
    setMessages([]);
    setActiveTab("chat");
  }

  async function loadConvo(c) {
    if (messages.length > 0) await startNewConvo();
    setMessages(c.messages || []);
    setConvos(prev => prev.filter(x => x.id !== c.id));
    setShowHistory(false);
    setActiveTab("chat");
  }

  async function deleteConvo(id) {
    try { await del(`/conversations/${id}`); } catch { /* ignore */ }
    setConvos(prev => prev.filter(c => c.id !== id));
  }

  async function generatePlan() {
    if (generating) return;
    setGenerating(true);
    setActiveTab("chat");
    
    const parts = planoDate.split("/");
    const dt = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00`);
    const dtFormatted = dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
    
    const triggerMsg = {
      role: "user",
      content: `[AÇÃO: GERAR PLANO DO DIA]\nData Selecionada no App: ${dtFormatted} (${planoDate})\n\nGere um plano alimentar personalizado para a data correspondente (${planoDate}). Analise meu histórico recente para variar os alimentos (evitar repetição), compensar metas calóricas se necessário, e focar no que deve ser feito nesse dia específico.`,
    };
    const newMsgs = [...messages, triggerMsg];
    setMessages(newMsgs);

    try {
      const apiMsgs = newMsgs.slice(-40).map(m => ({ role: m.role, content: m.content }));
      const today = new Date().toLocaleDateString("pt-BR");
      const weekday = new Date().toLocaleDateString("pt-BR", { weekday: "long" });
      const timeStr = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      let nomePerfil = "Renata";
      try { nomePerfil = JSON.parse(docs.perfil || "{}").nome || "Renata"; } catch { /* ignore */ }
      const data = await sendMessage(
        apiMsgs,
        buildSystemInstructions(nomePerfil, today, weekday, timeStr, planoDate),
        buildSystemContext(docs, planoDate)
      );
      const parsed = parseClaudeStructuredResponse(data);

      const appliedUpdates = [];
      for (const u of (parsed.updates || []).filter(u => !u.requiresPermission)) {
        const revision = await applyUpdate(u);
        if (revision) appliedUpdates.push(revision);
      }
      const aiMsg = { role: "assistant", content: parsed.reply || "...", appliedUpdates };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e) {
      if (isClaudeResponseParseError(e)) {
        console.error("generatePlan parse error:", e.code, e.meta, e);
      } else {
        console.error("generatePlan:", e);
      }
      setMessages(prev => [...prev, { role: "assistant", content: `Erro ao gerar plano: ${getClaudeResponseUserMessage(e)}` }]);
    }
    setGenerating(false);
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
          <ChatTab docs={docs} setDocs={setDocs} messages={messages} setMessages={setMessages} docsReady={docsReady} setTab={setActiveTab} onGeneratePlan={generatePlan} generating={generating} planoDate={planoDate} />
        </div>
        {activeTab === "plano" && <PlanoView planoDictStr={docs.plano} cal={docs.cal} onGeneratePlan={generatePlan} generating={generating} onToggleItem={handleToggleItem} selectedDate={planoDate} setSelectedDate={setPlanoDate} />}
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
        <div style={{ position: "fixed", inset: 0, zIndex: 200, maxWidth: "385px", margin: "0 auto", display: "flex", flexDirection: "column" }}>
          <ConvoDrawerReal convos={convos} onLoad={loadConvo} onDelete={deleteConvo} onClose={() => setShowHistory(false)} />
        </div>
      )}
    </div>
  );
}
