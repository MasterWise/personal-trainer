import { useState, useEffect, useRef } from "react";
import { useTheme } from "../../contexts/ThemeContext.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useDocs } from "../../contexts/DocsContext.jsx";
import { get, post, del } from "../../services/api.js";
import { DIAS } from "../../data/constants.js";
import Field from "../ui/Field.jsx";
import TagEditor from "../ui/TagEditor.jsx";

function InviteSection({ theme, sectionStyle, secTitle }) {
  const c = theme.colors;
  const [invites, setInvites] = useState([]);
  const [users, setUsers] = useState([]);
  const [generatedLink, setGeneratedLink] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadInvites();
  }, []);

  async function loadInvites() {
    try {
      const data = await get("/admin/invites");
      setInvites(data.invites || []);
      setUsers(data.users || []);
    } catch { /* ignore */ }
  }

  async function createInvite() {
    setLoading(true);
    try {
      const data = await post("/admin/invites", { ttlHours: 48 });
      const base = window.location.origin + window.location.pathname;
      setGeneratedLink(`${base}?invite=${data.code}`);
      setCopied(false);
      await loadInvites();
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function revokeInvite(code) {
    try {
      await del(`/admin/invites/${code}`);
      await loadInvites();
    } catch { /* ignore */ }
  }

  function copyLink() {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function formatDate(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  }

  function hoursLeft(expiresAt) {
    const ms = new Date(expiresAt) - Date.now();
    if (ms <= 0) return "expirado";
    const h = Math.ceil(ms / (1000 * 60 * 60));
    return `${h}h`;
  }

  const pendingInvites = invites.filter((inv) => !inv.used_by && new Date(inv.expires_at) > new Date());
  const usedInvites = invites.filter((inv) => inv.used_by);
  const nonAdminUsers = users.filter((u) => !u.is_admin);

  return (
    <div style={sectionStyle}>
      {secTitle("👥", "Usuários")}

      <button onClick={createInvite} disabled={loading}
        style={{ width: "100%", padding: "12px", background: `${c.primary}12`, border: `1.5px dashed ${c.primary}40`, borderRadius: "12px", fontFamily: theme.font, fontSize: "13px", fontWeight: "600", color: c.primary, cursor: loading ? "not-allowed" : "pointer", marginBottom: "14px" }}>
        {loading ? "Gerando..." : "+ Convidar usuário"}
      </button>

      {generatedLink && (
        <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: "12px", padding: "14px", marginBottom: "14px" }}>
          <p style={{ fontFamily: theme.font, color: c.text, fontSize: "13px", fontWeight: "600", marginBottom: "8px" }}>Convite gerado!</p>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input readOnly value={generatedLink} style={{ flex: 1, padding: "8px 10px", background: c.surface, border: `1px solid ${c.border}`, borderRadius: "8px", fontFamily: theme.font, fontSize: "11px", color: c.textSecondary, outline: "none", minWidth: 0 }} />
            <button onClick={copyLink} style={{ padding: "8px 14px", background: copied ? "#5A9A5A" : c.primary, border: "none", borderRadius: "8px", fontFamily: theme.font, fontSize: "12px", fontWeight: "700", color: "#FFF", cursor: "pointer", flexShrink: 0, transition: "background 0.2s" }}>
              {copied ? "✓" : "📋"}
            </button>
          </div>
          <p style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "11px", marginTop: "6px" }}>Expira em 48h. Uso único.</p>
          <button onClick={() => setGeneratedLink(null)} style={{ background: "none", border: "none", color: c.textMuted, fontFamily: theme.font, fontSize: "11px", cursor: "pointer", padding: 0, marginTop: "4px" }}>Fechar</button>
        </div>
      )}

      {nonAdminUsers.length > 0 && nonAdminUsers.map((u) => (
        <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${c.border}` }}>
          <span style={{ fontFamily: theme.font, color: c.text, fontSize: "13px" }}>{u.name}</span>
          <span style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "11px" }}>criado {formatDate(u.created_at)}</span>
        </div>
      ))}

      {pendingInvites.length > 0 && pendingInvites.map((inv) => (
        <div key={inv.code} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${c.border}` }}>
          <span style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "12px" }}>
            Código {inv.code.slice(0, 4)}… — pendente ({hoursLeft(inv.expires_at)})
          </span>
          <button onClick={() => revokeInvite(inv.code)} style={{ background: "none", border: "none", color: c.danger || "#C05A3A", fontFamily: theme.font, fontSize: "11px", fontWeight: "600", cursor: "pointer" }}>revogar</button>
        </div>
      ))}

      {nonAdminUsers.length === 0 && pendingInvites.length === 0 && (
        <p style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "12px", textAlign: "center", padding: "8px 0" }}>Nenhum usuário convidado ainda.</p>
      )}
    </div>
  );
}

export default function PerfilTab({ perfil, onSave, macro, micro, onSaveMacro, onSaveMicro }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { user } = useAuth();
  const { clearDocs, restoreDocs } = useDocs();
  const isAdmin = !!user?.isAdmin;
  const [p, setP] = useState({});
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

  // Track external perfil prop changes vs user-initiated edits
  const isExternalUpdate = useRef(false);

  useEffect(() => {
    isExternalUpdate.current = true;
    try { setP(JSON.parse(perfil || "{}")); } catch { setP({}); }
  }, [perfil]);

  function set(key, val) { setP(prev => ({ ...prev, [key]: val })); }

  function setLimitacao(i, val) { const arr = [...(p.limitacoes || [])]; arr[i] = val; set("limitacoes", arr); }
  function addLimitacao() { set("limitacoes", [...(p.limitacoes || []), ""]); }
  function removeLimitacao(i) { set("limitacoes", (p.limitacoes || []).filter((_, j) => j !== i)); }

  function setTreino(i, key, val) { const arr = [...(p.treinos_planejados || [])]; arr[i] = { ...arr[i], [key]: val }; set("treinos_planejados", arr); }
  function addTreino() { set("treinos_planejados", [...(p.treinos_planejados || []), { dia: "seg", tipo: "", duracao: "1h", horario: "18:00" }]); }
  function removeTreino(i) { set("treinos_planejados", (p.treinos_planejados || []).filter((_, j) => j !== i)); }

  // Auto-save with debounce — skip initial load and external prop changes
  const isFirstRender = useRef(true);
  const [autoSaveStatus, setAutoSaveStatus] = useState(""); // "" | "saving" | "saved"

  useEffect(() => {
    // Skip auto-save on first render (when perfil prop loads into p)
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Skip auto-save when p was set from external perfil prop change (e.g., AI sync)
    if (isExternalUpdate.current) {
      isExternalUpdate.current = false;
      return;
    }
    // Skip if p is empty (no data loaded yet)
    if (!p || Object.keys(p).length === 0) return;

    setAutoSaveStatus("saving");
    const timer = setTimeout(async () => {
      await onSave(JSON.stringify(p, null, 2));
      setAutoSaveStatus("saved");
      setTimeout(() => setAutoSaveStatus(""), 1500);
    }, 800);
    return () => clearTimeout(timer);
  }, [p]);

  const sectionStyle = { 
    background: c.surface, 
    padding: "24px 20px", 
    margin: "0 16px 24px", 
    borderRadius: "20px",
    border: `1px solid ${c.border}`,
    boxShadow: `0 4px 24px rgba(0,0,0,0.02)`
  };
  
  const secTitle = (icon, title) => (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
      <div style={{ 
        width: "36px", height: "36px", borderRadius: "12px", 
        background: `${c.primaryLight}20`, color: c.primary,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" 
      }}>
        {icon}
      </div>
      <h3 style={{ fontFamily: theme.headingFont, color: c.text, fontSize: "17px", fontWeight: "700" }}>{title}</h3>
    </div>
  );

  const btnRemove = (onClick) => (
    <button onClick={onClick} style={{ width: "38px", height: "38px", borderRadius: "12px", border: "none", background: `${c.textMuted}10`, cursor: "pointer", color: c.textMuted, fontSize: "14px", flexShrink: 0, transition: "background 0.2s" }}>✕</button>
  );

  const btnAdd = (onClick, label) => (
    <button onClick={onClick} style={{ padding: "12px 16px", background: "transparent", border: `1.5px dashed ${c.border}`, borderRadius: "12px", fontFamily: theme.font, color: c.textMuted, fontSize: "13.5px", fontWeight: "600", cursor: "pointer", width: "100%", marginTop: "8px", transition: "all 0.2s" }}>
      + {label}
    </button>
  );

  const inputStyle = { padding: "10px 14px", background: c.bg, border: `1px solid ${c.border}`, borderRadius: "12px", fontFamily: theme.font, fontSize: "14px", color: c.text, outline: "none", boxShadow: `inset 0 2px 4px rgba(0,0,0,0.02)` };

  return (
    <div style={{ overflowY: "auto", height: "100%", background: c.bg }}>
      <div style={{ padding: "16px 0 90px", display: "flex", flexDirection: "column" }}>

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

        {/* Metas nutricionais diárias */}
        <div style={sectionStyle}>
          {secTitle("🍎", "Metas nutricionais diárias")}
          <p style={{ fontFamily: theme.font, fontSize: "11px", color: c.textMuted, margin: "0 0 12px", lineHeight: "1.5" }}>
            Alvos diários que o coach usa para montar seu plano alimentar.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <Field label="Calorias (kcal)" value={p.macros_alvo?.kcal ?? ""} type="number" onChange={v => set("macros_alvo", { ...(p.macros_alvo || {}), kcal: v ? Number(v) : "" })} />
            <Field label="Proteína (g)" value={p.macros_alvo?.proteina_g ?? ""} onChange={v => set("macros_alvo", { ...(p.macros_alvo || {}), proteina_g: v })} />
            <Field label="Carboidrato (g)" value={p.macros_alvo?.carbo_g ?? ""} onChange={v => set("macros_alvo", { ...(p.macros_alvo || {}), carbo_g: v })} />
            <Field label="Gordura (g)" value={p.macros_alvo?.gordura_g ?? ""} onChange={v => set("macros_alvo", { ...(p.macros_alvo || {}), gordura_g: v })} />
            <Field label="Fibras (g)" value={p.macros_alvo?.fibras_g ?? ""} type="number" onChange={v => set("macros_alvo", { ...(p.macros_alvo || {}), fibras_g: v ? Number(v) : "" })} />
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
            <div key={i} style={{ display: "flex", gap: "5px", marginBottom: "8px", alignItems: "center" }}>
              <select value={t.dia} onChange={e => setTreino(i, "dia", e.target.value)} style={{ ...inputStyle, padding: "8px 4px", fontSize: "12px", width: "62px", flexShrink: 0 }}>
                {DIAS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
              </select>
              <input value={t.tipo} onChange={e => setTreino(i, "tipo", e.target.value)} placeholder="Pilates" style={{ ...inputStyle, padding: "8px 6px", flex: 1, minWidth: 0 }} />
              <select value={t.duracao} onChange={e => setTreino(i, "duracao", e.target.value)} style={{ ...inputStyle, padding: "8px 2px", fontSize: "12px", width: "60px", flexShrink: 0 }}>
                {["30min", "45min", "1h", "1h15", "1h30", "2h"].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <input value={t.horario || ""} onChange={e => setTreino(i, "horario", e.target.value)} type="time" style={{ ...inputStyle, padding: "8px 4px", fontSize: "12px", width: "80px", flexShrink: 0 }} />
              {btnRemove(() => removeTreino(i))}
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

        {/* Preferências alimentares */}
        <div style={sectionStyle}>
          {secTitle("🍽️", "Preferências alimentares")}
          <p style={{ fontFamily: theme.font, fontSize: "11px", color: c.textMuted, margin: "0 0 12px", lineHeight: "1.5" }}>
            O coach usa para personalizar receitas e sugestões de refeições.
          </p>

          <label style={{ display: "block", fontFamily: theme.font, color: c.textMuted, fontSize: "10.5px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>
            Texturas favoritas
          </label>
          <div style={{ marginBottom: "12px" }}>
            <TagEditor
              values={p.preferencias_alimentares?.texturas_favoritas || []}
              onChange={(vals) => set("preferencias_alimentares", { ...(p.preferencias_alimentares || {}), texturas_favoritas: vals })}
            />
          </div>

          <label style={{ display: "block", fontFamily: theme.font, color: c.textMuted, fontSize: "10.5px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>
            Pratos favoritos
          </label>
          <div style={{ marginBottom: "12px" }}>
            <TagEditor
              values={p.preferencias_alimentares?.pratos_favoritos || []}
              onChange={(vals) => set("preferencias_alimentares", { ...(p.preferencias_alimentares || {}), pratos_favoritos: vals })}
            />
          </div>

          <label style={{ display: "block", fontFamily: theme.font, color: c.textMuted, fontSize: "10.5px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>
            Doces gatilho (TPM)
          </label>
          <div style={{ marginBottom: "12px" }}>
            <TagEditor
              values={p.preferencias_alimentares?.doces_gatilho || []}
              onChange={(vals) => set("preferencias_alimentares", { ...(p.preferencias_alimentares || {}), doces_gatilho: vals })}
            />
          </div>

          <label style={{ display: "block", fontFamily: theme.font, color: c.textMuted, fontSize: "10.5px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>
            Escapes aprovados
          </label>
          <div style={{ marginBottom: "12px" }}>
            <TagEditor
              values={p.preferencias_alimentares?.escapes_aprovados || []}
              onChange={(vals) => set("preferencias_alimentares", { ...(p.preferencias_alimentares || {}), escapes_aprovados: vals })}
            />
          </div>
        </div>

        {/* Usuários (admin only) */}
        {isAdmin && <InviteSection theme={theme} sectionStyle={sectionStyle} secTitle={secTitle} />}

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

      {/* Auto-save status indicator */}
      {autoSaveStatus && (
        <div style={{
          position: "fixed", bottom: "70px", left: "50%", transform: "translateX(-50%)",
          padding: "8px 18px", borderRadius: "20px",
          background: autoSaveStatus === "saved" ? "#5A9A5Acc" : `${c.primary}cc`,
          color: "#FFF", fontFamily: theme.font, fontSize: "12px", fontWeight: "700",
          backdropFilter: "blur(6px)", boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
          zIndex: 50, transition: "all 0.3s", pointerEvents: "none",
        }}>
          {autoSaveStatus === "saving" ? "💾 Salvando..." : "✓ Salvo"}
        </div>
      )}

      {/* Modal editor */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, maxWidth: "385px", margin: "0 auto", display: "flex", flexDirection: "column", background: c.bg }}>
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
