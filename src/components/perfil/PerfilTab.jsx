import { useState, useEffect } from "react";
import { useTheme } from "../../contexts/ThemeContext.jsx";
import { useDocs } from "../../contexts/DocsContext.jsx";
import { DIAS } from "../../data/constants.js";
import Field from "../ui/Field.jsx";

export default function PerfilTab({ perfil, onSave, macro, micro, onSaveMacro, onSaveMicro }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { clearDocs, restoreDocs } = useDocs();
  const [p, setP] = useState({});
  const [saved, setSaved] = useState(false);
  const [modal, setModal] = useState(null);
  const [modalText, setModalText] = useState("");
  const [modalSaved, setModalSaved] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  function openModal(type) {
    setModalText(type === "macro" ? macro : micro);
    setModal(type);
    setModalSaved(false);
  }

  async function saveModal() {
    if (modal === "macro") await onSaveMacro(modalText);
    else await onSaveMicro(modalText);
    setModalSaved(true);
    setTimeout(() => { setModalSaved(false); setModal(null); }, 1200);
  }

  useEffect(() => {
    try { setP(JSON.parse(perfil || "{}")); } catch { setP({}); }
  }, [perfil]);

  function set(key, val) { setP(prev => ({ ...prev, [key]: val })); }

  function setLimitacao(i, val) { const arr = [...(p.limitacoes || [])]; arr[i] = val; set("limitacoes", arr); }
  function addLimitacao() { set("limitacoes", [...(p.limitacoes || []), ""]); }
  function removeLimitacao(i) { set("limitacoes", (p.limitacoes || []).filter((_, j) => j !== i)); }

  function setTreino(i, key, val) { const arr = [...(p.treinos_planejados || [])]; arr[i] = { ...arr[i], [key]: val }; set("treinos_planejados", arr); }
  function addTreino() { set("treinos_planejados", [...(p.treinos_planejados || []), { dia: "seg", tipo: "", duracao: "1h", horario: "18:00" }]); }
  function removeTreino(i) { set("treinos_planejados", (p.treinos_planejados || []).filter((_, j) => j !== i)); }

  async function save() {
    await onSave(JSON.stringify(p, null, 2));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const sectionStyle = { background: c.surface, borderRadius: "16px", padding: "18px", marginBottom: "12px", border: `1px solid ${c.border}`, boxShadow: "0 1px 6px rgba(0,0,0,0.05)" };
  const secTitle = (icon, title) => (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", paddingBottom: "10px", borderBottom: `1px solid ${c.border}` }}>
      <span style={{ fontSize: "18px" }}>{icon}</span>
      <h3 style={{ fontFamily: theme.headingFont, color: c.text, fontSize: "16px", fontWeight: "700" }}>{title}</h3>
    </div>
  );

  const btnRemove = (onClick) => (
    <button onClick={onClick} style={{ width: "34px", height: "34px", borderRadius: "8px", border: `1px solid ${c.border}`, background: c.surface, cursor: "pointer", color: c.textMuted, fontSize: "14px", flexShrink: 0 }}>✕</button>
  );

  const btnAdd = (onClick, label) => (
    <button onClick={onClick} style={{ padding: "8px 14px", background: "transparent", border: `1.5px dashed ${c.border}`, borderRadius: "10px", fontFamily: theme.font, color: c.textMuted, fontSize: "13px", cursor: "pointer", width: "100%", marginTop: "4px" }}>
      + {label}
    </button>
  );

  const inputStyle = { padding: "8px 12px", background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: "10px", fontFamily: theme.font, fontSize: "13px", color: c.text, outline: "none" };

  return (
    <div style={{ overflowY: "auto", height: "100%", background: c.bg }}>
      <div style={{ padding: "14px 15px 90px" }}>

        {/* Identidade */}
        <div style={sectionStyle}>
          {secTitle("👤", "Identidade")}
          <Field label="Nome completo" value={p.nome || ""} onChange={v => set("nome", v)} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <Field label="Idade" value={p.idade || ""} type="number" onChange={v => set("idade", Number(v))} />
            <Field label="Cidade" value={p.cidade || ""} onChange={v => set("cidade", v)} />
          </div>
        </div>

        {/* Dados corporais */}
        <div style={sectionStyle}>
          {secTitle("⚖️", "Dados corporais")}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <Field label="Peso atual (kg)" value={p.peso_kg || ""} type="number" onChange={v => set("peso_kg", Number(v))} />
            <Field label="Gordura atual (%)" value={p.gordura_pct || ""} type="number" onChange={v => set("gordura_pct", Number(v))} />
            <Field label="Meta peso mín (kg)" value={p.meta_peso_min || ""} type="number" onChange={v => set("meta_peso_min", Number(v))} />
            <Field label="Meta peso máx (kg)" value={p.meta_peso_max || ""} type="number" onChange={v => set("meta_peso_max", Number(v))} />
            <Field label="Meta gordura (%)" value={p.meta_gordura_pct || ""} type="number" onChange={v => set("meta_gordura_pct", Number(v))} />
            <Field label="Ano da meta" value={p.meta_ano || ""} type="number" onChange={v => set("meta_ano", Number(v))} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "4px" }}>
            <Field label="TMB (kcal)" value={p.tmb_kcal || ""} type="number" onChange={v => set("tmb_kcal", Number(v))} hint="Taxa Metabólica Basal" />
            <Field label="Água mínima (L/dia)" value={p.agua_litros || ""} type="number" onChange={v => set("agua_litros", Number(v))} />
          </div>
        </div>

        {/* Objetivo */}
        <div style={sectionStyle}>
          {secTitle("🎯", "Objetivo e contexto")}
          <Field label="Objetivo principal" value={p.meta_descricao || ""} onChange={v => set("meta_descricao", v)} multiline hint="Descreva seu objetivo, motivação e contexto de vida atual." />
          <Field label="Foco semanal" value={p.objetivo_semanal || ""} onChange={v => set("objetivo_semanal", v)} />
        </div>

        {/* Limitações */}
        <div style={sectionStyle}>
          {secTitle("⚠️", "Limitações físicas e restrições")}
          <p style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "12px", marginBottom: "12px", lineHeight: "1.5" }}>
            O coach usa isso para evitar exercícios/alimentos que possam te prejudicar.
          </p>
          {(p.limitacoes || []).map((lim, i) => (
            <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
              <input value={lim} onChange={e => setLimitacao(i, e.target.value)} style={{ flex: 1, ...inputStyle }} />
              {btnRemove(() => removeLimitacao(i))}
            </div>
          ))}
          {btnAdd(addLimitacao, "Adicionar limitação")}
        </div>

        {/* Treinos */}
        <div style={sectionStyle}>
          {secTitle("🏋️", "Treinos planejados")}
          {(p.treinos_planejados || []).map((t, i) => (
            <div key={i} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: "12px", padding: "10px 12px", marginBottom: "8px" }}>
              {/* Row 1: Dia + Tipo */}
              <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: "8px", marginBottom: "8px" }}>
                <select value={t.dia} onChange={e => setTreino(i, "dia", e.target.value)} style={inputStyle}>
                  {DIAS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                </select>
                <input value={t.tipo} onChange={e => setTreino(i, "tipo", e.target.value)} placeholder="Ex: Pilates" style={inputStyle} />
              </div>
              {/* Row 2: Duração + Horário + Remove */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 34px", gap: "8px", alignItems: "center" }}>
                <input value={t.duracao} onChange={e => setTreino(i, "duracao", e.target.value)} placeholder="Duração (ex: 1h)" style={inputStyle} />
                <input value={t.horario || ""} onChange={e => setTreino(i, "horario", e.target.value)} type="time" style={inputStyle} />
                {btnRemove(() => removeTreino(i))}
              </div>
            </div>
          ))}
          {btnAdd(addTreino, "Adicionar treino")}
        </div>

        {/* Hábitos */}
        <div style={sectionStyle}>
          {secTitle("☕", "Hábitos e restrições")}
          <p style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "12px", marginBottom: "12px", lineHeight: "1.5" }}>
            Escreva livremente: alergias, intolerâncias, restrições alimentares, hábitos de sono, comportamentos relevantes.
          </p>
          {(p.habitos || []).map((h, i) => (
            <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
              <input value={h} onChange={e => { const arr = [...(p.habitos || [])]; arr[i] = e.target.value; set("habitos", arr); }}
                placeholder="Ex: Não tolero glúten, Durmo mal em fases de TPM..."
                style={{ flex: 1, ...inputStyle }} />
              {btnRemove(() => set("habitos", (p.habitos || []).filter((_, j) => j !== i)))}
            </div>
          ))}
          {btnAdd(() => set("habitos", [...(p.habitos || []), ""]), "Adicionar hábito ou restrição")}
          <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: `1px solid ${c.border}` }}>
            <Field label="Notas livres para o coach" value={p.notas_livres || ""} onChange={v => set("notas_livres", v)} multiline hint="Contexto extra, situações pontuais, recados diretos ao coach." />
          </div>
        </div>

        {/* Gerenciar dados */}
        <div style={sectionStyle}>
          {secTitle("🔄", "Dados de apresentação")}
          <p style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "12px", marginBottom: "14px", lineHeight: "1.5" }}>
            Este app veio com os dados da Renata como exemplo. Você pode restaurá-los ou limpar tudo para começar do zero.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <button onClick={async () => { setRestoring(true); await restoreDocs(); setRestoring(false); }}
              disabled={restoring}
              style={{ width: "100%", padding: "12px", background: `${c.primary}12`, border: `1.5px solid ${c.primary}40`, borderRadius: "12px", fontFamily: theme.font, fontSize: "13px", fontWeight: "600", color: c.primary, cursor: restoring ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
              {restoring ? "Restaurando..." : "🔄 Restaurar dados da Renata"}
            </button>
            {!confirmClear ? (
              <button onClick={() => setConfirmClear(true)}
                style={{ width: "100%", padding: "12px", background: "transparent", border: `1.5px solid ${c.danger || "#C05A3A"}`, borderRadius: "12px", fontFamily: theme.font, fontSize: "13px", fontWeight: "600", color: c.danger || "#C05A3A", cursor: "pointer" }}>
                Limpar todos os dados
              </button>
            ) : (
              <div style={{ background: `${(c.danger || "#C05A3A")}10`, border: `1.5px solid ${c.danger || "#C05A3A"}40`, borderRadius: "14px", padding: "16px" }}>
                <p style={{ fontFamily: theme.font, color: c.text, fontSize: "13px", fontWeight: "600", marginBottom: "6px" }}>Tem certeza?</p>
                <p style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "12px", lineHeight: "1.5", marginBottom: "14px" }}>
                  Todos os documentos, plano, histórico, progresso, calorias e treinos serão apagados.
                </p>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => setConfirmClear(false)}
                    style={{ flex: 1, padding: "10px", background: c.bg, border: `1px solid ${c.border}`, borderRadius: "10px", fontFamily: theme.font, fontSize: "13px", color: c.text, cursor: "pointer" }}>
                    Cancelar
                  </button>
                  <button onClick={async () => { setClearing(true); await clearDocs(); setClearing(false); setConfirmClear(false); }}
                    disabled={clearing}
                    style={{ flex: 1, padding: "10px", background: c.danger || "#C05A3A", border: "none", borderRadius: "10px", fontFamily: theme.font, fontSize: "13px", fontWeight: "700", color: "#FFF", cursor: clearing ? "not-allowed" : "pointer" }}>
                    {clearing ? "Limpando..." : "Sim, limpar tudo"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Debug AI */}
        <div style={sectionStyle}>
          {secTitle("🔍", "Debug da IA")}
          <p style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "12px", marginBottom: "14px", lineHeight: "1.5" }}>
            Quando ativado, cada interação com o Coach salva um log completo (prompt, mensagens, resposta, tokens, tempo). Acesse os logs na aba 🔍 Logs.
          </p>
          <button
            onClick={() => {
              const current = localStorage.getItem("debugAI") === "true";
              localStorage.setItem("debugAI", current ? "false" : "true");
              setP(prev => ({ ...prev })); // force re-render
            }}
            style={{
              width: "100%", padding: "12px",
              background: localStorage.getItem("debugAI") === "true" ? `${c.primary}18` : "transparent",
              border: `1.5px solid ${localStorage.getItem("debugAI") === "true" ? c.primary : c.border}`,
              borderRadius: "12px", fontFamily: theme.font, fontSize: "13px", fontWeight: "600",
              color: localStorage.getItem("debugAI") === "true" ? c.primary : c.textMuted,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
            }}
          >
            {localStorage.getItem("debugAI") === "true" ? "🟢 Debug ativado — clique para desativar" : "⚪ Debug desativado — clique para ativar"}
          </button>
        </div>
        {/* Documentos narrativos */}
        <div style={sectionStyle}>
          {secTitle("📄", "Documentos do coach")}
          <p style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "12px", marginBottom: "14px", lineHeight: "1.5" }}>
            Contexto narrativo completo que o coach lê antes de cada interação. Edite para refletir sua realidade atual.
          </p>
          {[
            { key: "macro", label: "MACRO", desc: "Quem você é, seus objetivos, contexto de vida e motivações profundas.", icon: "🗺️", color: c.primary },
            { key: "micro", label: "MICRO", desc: "Rotina de fome, preferências alimentares, gatilhos e padrões do dia a dia.", icon: "🔍", color: "#5A7EA3" },
          ].map(item => (
            <div key={item.key} onClick={() => openModal(item.key)}
              style={{ display: "flex", gap: "12px", alignItems: "center", padding: "13px 14px", background: c.bg, borderRadius: "12px", marginBottom: "8px", cursor: "pointer", border: `1.5px solid ${c.border}`, transition: "border-color 0.15s" }}>
              <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: `${item.color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>{item.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: theme.font, color: c.text, fontSize: "13.5px", fontWeight: "700" }}>{item.label}</div>
                <div style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "12px", marginTop: "2px", lineHeight: "1.4" }}>{item.desc}</div>
              </div>
              <span style={{ color: c.textMuted, fontSize: "16px", flexShrink: 0 }}>›</span>
            </div>
          ))}
        </div>
      </div>

      {/* Floating save button */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: "430px", padding: "12px 16px", background: `${c.surface}ee`, backdropFilter: "blur(8px)", borderTop: `1px solid ${c.border}`, zIndex: 50 }}>
        <button onClick={save}
          style={{ width: "100%", padding: "14px", background: saved ? c.ok : `linear-gradient(135deg,${c.primaryLight},${c.primary})`, color: "#FFF", border: "none", borderRadius: "14px", fontFamily: theme.font, fontSize: "15px", fontWeight: "700", cursor: "pointer", transition: "background 0.3s", boxShadow: `0 4px 14px ${c.primary}40` }}>
          {saved ? "✓ Salvo!" : "Salvar perfil"}
        </button>
      </div>

      {/* Modal editor */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, maxWidth: "430px", margin: "0 auto", display: "flex", flexDirection: "column", background: c.bg }}>
          <div style={{ background: c.surface, borderBottom: `1px solid ${c.border}`, padding: "13px 16px", flexShrink: 0, display: "flex", alignItems: "center", gap: "12px" }}>
            <button onClick={() => setModal(null)}
              style={{ width: "34px", height: "34px", borderRadius: "10px", border: `1px solid ${c.border}`, background: c.bg, cursor: "pointer", fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>‹</button>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: theme.headingFont, color: c.text, fontSize: "17px", fontWeight: "700" }}>
                {modal === "macro" ? "🗺️ MACRO" : "🔍 MICRO"}
              </div>
              <div style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "11px", marginTop: "1px" }}>
                {modal === "macro" ? "Contexto geral — quem você é" : "Perfil operacional — como você funciona"}
              </div>
            </div>
          </div>
          <div style={{ padding: "10px 16px 0", flexShrink: 0 }}>
            <p style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "11.5px", lineHeight: "1.6", background: c.surface, padding: "10px 13px", borderRadius: "10px", border: `1px solid ${c.border}` }}>
              {modal === "macro"
                ? "Escreva na primeira pessoa. Descreva quem você é, o que quer, por que quer, e o que carrega."
                : "Detalhe sua rotina de fome, o que você gosta e não gosta de comer, texturas, horários difíceis, gatilhos emocionais."
              }
            </p>
          </div>
          <div style={{ flex: 1, padding: "12px 16px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <textarea value={modalText} onChange={e => setModalText(e.target.value)}
              style={{ flex: 1, width: "100%", padding: "14px", background: c.surface, border: `1.5px solid ${c.border}`, borderRadius: "14px", fontFamily: theme.font, fontSize: "13.5px", color: c.text, outline: "none", resize: "none", lineHeight: "1.7" }} />
          </div>
          <div style={{ padding: "12px 16px 16px", flexShrink: 0 }}>
            <button onClick={saveModal}
              style={{ width: "100%", padding: "14px", background: modalSaved ? c.ok : `linear-gradient(135deg,${c.primaryLight},${c.primary})`, color: "#FFF", border: "none", borderRadius: "14px", fontFamily: theme.font, fontSize: "15px", fontWeight: "700", cursor: "pointer", transition: "background 0.3s", boxShadow: `0 4px 14px ${c.primary}40` }}>
              {modalSaved ? "✓ Salvo!" : `Salvar ${modal.toUpperCase()}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
