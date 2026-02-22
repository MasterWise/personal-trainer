import React, { useState, useEffect } from "react";
import { useAuth } from "./contexts/AuthContext.jsx";
import { useDocs } from "./contexts/DocsContext.jsx";
import { useTheme } from "./contexts/ThemeContext.jsx";
import { get, put, post, del } from "./services/api.js";
import { buildPrompt } from "./data/prompts.js";
import { sendMessage } from "./services/claudeService.js";
import { FILE_TO_STATE, MARCO_EMOJIS } from "./data/constants.js";
import Header from "./components/layout/Header.jsx";
import TabBar from "./components/layout/TabBar.jsx";
import ChatTab from "./components/chat/ChatTab.jsx";
import ConvoDrawerReal from "./components/chat/ConvoDrawer.jsx";
import PlanoView from "./views/PlanoView.jsx";
import SaudeView from "./views/SaudeView.jsx";
import MarcosView from "./views/MarcosView.jsx";
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
  const { docs, docsReady, setDocs, saveDoc } = useDocs();
  const [activeTab, setActiveTab] = useState("chat");
  const [messages, setMessages] = useState([]);
  const [convos, setConvos] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [generating, setGenerating] = useState(false);

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
    const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
    const triggerMsg = {
      role: "user",
      content: `[AÇÃO: GERAR PLANO DO DIA]\nData: ${today}\n\nGere um plano alimentar personalizado para hoje. Analisa meu histórico recente para variar os alimentos (evitar repetição), compensar metas calóricas ou de proteína se necessário, e adaptar ao meu dia. Após gerar, atualize o Plano_Renata.md com o plano de hoje.`,
    };
    const newMsgs = [...messages, triggerMsg];
    setMessages(newMsgs);

    try {
      const apiMsgs = newMsgs.slice(-40).map(m => ({ role: m.role, content: m.content }));
      const data = await sendMessage(
        apiMsgs,
        buildPrompt(docs),
        { thinking: true, thinkingBudget: 5000 }
      );
      const textBlock = data.content?.find(b => b.type === "text")?.text;
      if (!textBlock) throw new Error("Resposta inesperada da API");
      const parsed = JSON.parse(textBlock);

      const aiMsg = { role: "assistant", content: parsed.reply || "..." };
      let newDocs = docs;
      for (const u of (parsed.updates || []).filter(u => !u.requiresPermission)) {
        newDocs = await applyUpdateLocal(u, newDocs);
      }
      setDocs(newDocs);
      setMessages(prev => [...prev, aiMsg]);
    } catch (e) {
      console.error("generatePlan:", e);
      setMessages(prev => [...prev, { role: "assistant", content: `⚠️ Erro ao gerar plano: ${e.message}` }]);
    }
    setGenerating(false);
  }

  async function applyUpdateLocal(update, currentDocs) {
    const stateKey = FILE_TO_STATE[update.file];
    if (!stateKey) return currentDocs;
    const nd = { ...currentDocs };
    try {
      if (update.file === "marcos" && update.action === "add_marco") {
        const marco = typeof update.content === "string" ? JSON.parse(update.content) : update.content;
        const arr = JSON.parse(currentDocs.marcos || "[]");
        arr.push({ id: Date.now(), date: new Date().toLocaleDateString("pt-BR", { month: "short", year: "numeric" }), emoji: MARCO_EMOJIS[marco.type] || "🏆", ...marco });
        nd.marcos = JSON.stringify(arr);
        await saveDoc("marcos", nd.marcos);
      } else if (update.action === "append") {
        const val = typeof update.content === "object" ? JSON.stringify(update.content) : update.content;
        nd[stateKey] = (currentDocs[stateKey] || "") + "\n\n" + val;
        await saveDoc(stateKey, nd[stateKey]);
      } else if (update.action === "replace_all") {
        const val = typeof update.content === "object" ? JSON.stringify(update.content) : update.content;
        nd[stateKey] = val;
        await saveDoc(stateKey, val);
      }
    } catch (e) { console.error("applyUpdate:", e); }
    return nd;
  }

  async function handleToggleItem(itemId) {
    let planoObj;
    try { planoObj = JSON.parse(docs.plano); } catch { return; }
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

    const newPlano = JSON.stringify(planoObj);
    setDocs(prev => ({ ...prev, plano: newPlano }));
    await saveDoc("plano", newPlano);

    if (targetItem.tipo === "alimento" && targetItem.nutri) {
      await syncCalItem(targetItem, newChecked);
    } else if (targetItem.tipo === "treino") {
      await syncTreinoItem(targetItem, newChecked);
    }
  }

  async function syncCalItem(item, checked) {
    const today = new Date().toLocaleDateString("pt-BR");
    let calObj;
    try { calObj = JSON.parse(docs.cal || "{}"); } catch { calObj = {}; }
    if (!calObj.dias) calObj.dias = {};
    if (!calObj.dias[today]) calObj.dias[today] = { kcal_consumido: 0, proteina_g: 0, carbo_g: 0, gordura_g: 0, refeicoes: [] };

    const dia = calObj.dias[today];
    const n = item.nutri;
    const sign = checked ? 1 : -1;

    dia.kcal_consumido = Math.max(0, Math.round((dia.kcal_consumido || 0) + sign * (n.kcal || 0)));
    dia.proteina_g = Math.max(0, +(((dia.proteina_g || 0) + sign * (n.proteina_g || 0)).toFixed(1)));
    dia.carbo_g = Math.max(0, +(((dia.carbo_g || 0) + sign * (n.carbo_g || 0)).toFixed(1)));
    dia.gordura_g = Math.max(0, +(((dia.gordura_g || 0) + sign * (n.gordura_g || 0)).toFixed(1)));

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

  async function syncTreinoItem(item, checked) {
    const today = new Date().toLocaleDateString("pt-BR");
    let treinosObj;
    try { treinosObj = JSON.parse(docs.treinos || "{}"); } catch { treinosObj = {}; }
    if (!treinosObj.registros) treinosObj.registros = [];

    const existingIdx = treinosObj.registros.findIndex(r => r.data === today && r.tipo === (item.treino_tipo || item.texto));

    if (checked) {
      const reg = { data: today, tipo: item.treino_tipo || item.texto, duracao_min: item.duracao_min || 60, realizado: true };
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
    switch (activeTab) {
      case "chat":
        return <ChatTab docs={docs} setDocs={setDocs} messages={messages} setMessages={setMessages} docsReady={docsReady} setTab={setActiveTab} onGeneratePlan={generatePlan} generating={generating} />;
      case "plano":
        return <PlanoView plano={docs.plano} cal={docs.cal} onGeneratePlan={generatePlan} generating={generating} onToggleItem={handleToggleItem} />;
      case "saude":
        return <SaudeView cal={docs.cal} treinos={docs.treinos} />;
      case "marcos":
        return <MarcosView marcos={docs.marcos} />;
      case "perfil":
        return <PerfilTab perfil={docs.perfil} onSave={savePerfil} macro={docs.macro} micro={docs.micro} onSaveMacro={saveMacro} onSaveMicro={saveMicro} />;
      default:
        return null;
    }
  };

  return (
    <div className="pt-app">
      <Header docsReady={docsReady} onHistory={() => setShowHistory(true)} onNewConvo={startNewConvo} hasMessages={messages.length > 0} />
      <div className="pt-content">
        {renderView()}
      </div>
      <TabBar tab={activeTab} setTab={setActiveTab} />
      {showHistory && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, maxWidth: "430px", margin: "0 auto", display: "flex", flexDirection: "column" }}>
          <ConvoDrawerReal convos={convos} onLoad={loadConvo} onDelete={deleteConvo} onClose={() => setShowHistory(false)} />
        </div>
      )}
    </div>
  );
}
