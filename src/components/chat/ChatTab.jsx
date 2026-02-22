import { useState, useEffect, useRef } from "react";
import { useTheme } from "../../contexts/ThemeContext.jsx";
import { FILE_TO_TAB, FILE_TO_STATE, PROGRESSO_EMOJIS } from "../../data/constants.js";
import { buildSystemInstructions, buildSystemContext } from "../../data/prompts.js";
import { sendMessage } from "../../services/claudeService.js";
import ChatMsg from "./ChatMsg.jsx";
import UpdateCard from "./UpdateCard.jsx";
import PermCard from "./PermCard.jsx";

import { useDocs } from "../../contexts/DocsContext.jsx";

export default function ChatTab({ docs, setDocs, messages, setMessages, docsReady, setTab, onGeneratePlan, generating, externalCards, onClearExternalCards }) {
  const { applyUpdate } = useDocs();
  const { theme } = useTheme();
  const c = theme.colors;
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingPerms, setPPerms] = useState([]);
  const [updateCards, setCards] = useState([]);
  const bottomRef = useRef(null);
  const taRef = useRef(null);

  // Merge cards from generatePlan (App.jsx) into the updateCards display
  useEffect(() => {
    if (externalCards && externalCards.length > 0) {
      setCards(prev => {
        const existingFiles = new Set(prev.map(c => c.file));
        const newCards = externalCards.filter(c => !existingFiles.has(c.file));
        return newCards.length > 0 ? [...prev, ...newCards] : prev;
      });
      onClearExternalCards?.();
    }
  }, [externalCards]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading, generating, pendingPerms, updateCards]);

  async function send() {
    const text = input.trim();
    if (!text || loading || !docsReady) return;
    const userMsg = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setCards([]);

    try {
      const currentMsgs = [...messages, userMsg];
      const apiMsgs = currentMsgs.slice(-40).map(m => ({ role: m.role, content: m.content }));
      const today = new Date().toLocaleDateString("pt-BR");
      const weekday = new Date().toLocaleDateString("pt-BR", { weekday: "long" });
      let nomePerfil = "Renata";
      try { nomePerfil = JSON.parse(docs.perfil || "{}").nome || "Renata"; } catch { /* ignore */ }
      const data = await sendMessage(
        apiMsgs,
        buildSystemInstructions(nomePerfil, today, weekday),
        buildSystemContext(docs),
        { thinking: true, thinkingBudget: 5000 }
      );

      const textBlock = data.content?.find(b => b.type === "text")?.text;
      if (!textBlock) {
        setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Resposta inesperada da API. Tente novamente." }]);
        setLoading(false);
        return;
      }

      const parsed = JSON.parse(textBlock);
      const aiMsg = { role: "assistant", content: parsed.reply || "..." };
      const updates = parsed.updates || [];

      const direct = updates.filter(u => !u.requiresPermission);
      const perms = updates.filter(u => u.requiresPermission);

      let newDocs = docs;
      const cards = [];
      for (const u of direct) {
        await applyUpdate(u);
        const tab = FILE_TO_TAB[u.file];
        if (["plano", "progresso", "historico"].includes(tab)) {
          cards.push({ file: u.file, tab });
        }
      }
      setCards(cards);

      if (perms.length > 0) {
        setPPerms(prev => [...prev, ...perms.map(u => ({ id: Date.now() + Math.random(), update: u }))]);
      }

      setMessages(prev => [...prev, aiMsg]);
    } catch (e) {
      console.error("send() exception:", e);
      setMessages(prev => [...prev, { role: "assistant", content: `⚠️ Erro: ${e?.message || String(e)}` }]);
    }
    setLoading(false);
  }

  async function handlePerm(permId, approved) {
    const perm = pendingPerms.find(p => p.id === permId);
    if (!perm) return;
    setPPerms(prev => prev.filter(p => p.id !== permId));
    if (approved) {
      await applyUpdate(perm.update);
      const tab = FILE_TO_TAB[perm.update.file];
      if (["plano", "progresso", "historico"].includes(tab)) {
        setCards(prev => [...prev, { file: perm.update.file, tab }]);
      }
    }
    const note = approved ? "✓ Perfil atualizado." : "Ok, mantive como estava.";
    setMessages(prev => [...prev, { role: "assistant", content: note }]);
  }

  const quickActions = ["Como foi minha semana?", "Lanche da tarde ideal 🍎", "Estou na TPM 😩", "O que jantar hoje?"];

  return (
    <div className="pt-chat">
      <div className="pt-chat__messages">
        {!docsReady && <div style={{ textAlign: "center", marginTop: "40px", color: c.textMuted, fontFamily: theme.font, fontSize: "14px" }}>Carregando memória...</div>}

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

        {messages.map((m, i) => <ChatMsg key={i} msg={m} />)}

        {(loading || generating) && (
          <div className="pt-chat__row pt-chat__row--assistant">
            <div className="pt-chat__avatar">🌿</div>
            <div className="pt-chat__bubble pt-chat__bubble--assistant pt-chat__loading">
              {[0, 1, 2].map(i => <div key={i} className="pt-chat__loading-dot" />)}
            </div>
          </div>
        )}

        {updateCards.map((card, i) => (
          <UpdateCard key={i} file={card.file} onGo={() => { setCards([]); setTab(card.tab); }} />
        ))}

        {pendingPerms.map(p => (
          <PermCard key={p.id} msg={p.update.permissionMessage} onYes={() => handlePerm(p.id, true)} onNo={() => handlePerm(p.id, false)} />
        ))}

        <div ref={bottomRef} />
      </div>

      <div className="pt-chat__input-area">
        <textarea ref={taRef} value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={docsReady ? "Escreva aqui... (Enter envia)" : "Carregando..."}
          disabled={!docsReady} rows={1}
          className="pt-chat__textarea" />
        <button onClick={send} disabled={!input.trim() || (loading || generating) || !docsReady}
          className={`pt-chat__send ${input.trim() && !(loading || generating) && docsReady ? "pt-chat__send--active" : ""}`}>
          ➤
        </button>
      </div>
    </div>
  );
}
