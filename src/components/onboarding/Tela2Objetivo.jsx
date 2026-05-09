const OBJETIVOS = [
  { value: "perder_peso", label: "Perder peso e gordura corporal" },
  { value: "ganhar_massa", label: "Ganhar massa muscular" },
  { value: "manter_energia", label: "Manter peso, ter mais energia" },
  { value: "recuperacao", label: "Recuperacao pos-lesao / saude geral" },
  { value: "pre_gestacional", label: "Preparacao pre-gestacional" },
  { value: "outro", label: "Outro" },
];

export default function Tela2Objetivo({ objetivo, metaDescricao, onChange, onSkip, onNext, onBack }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "24px", background: "var(--pt-color-bg)" }}>
      <div style={{ width: "100%", maxWidth: "360px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <p style={{ color: "var(--pt-color-text-muted)", fontSize: "13px", textAlign: "center", marginBottom: 0 }}>Passo 2 de 3</p>
        <h1 style={{ fontFamily: "var(--pt-font-heading)", color: "var(--pt-color-text)", fontSize: "1.4rem", textAlign: "center", margin: "0 0 4px 0" }}>Qual e o seu objetivo principal?</h1>
        <p style={{ color: "var(--pt-color-text-muted)", fontSize: "13.5px", textAlign: "center", marginBottom: "8px" }}>Escolha o que mais combina com voce agora. Pode mudar depois.</p>

        <div role="radiogroup" aria-label="Objetivo principal" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {OBJETIVOS.map(opt => {
            const selected = objetivo === opt.value;
            return (
              <label
                key={opt.value}
                style={{
                  padding: "12px 14px",
                  borderRadius: "12px",
                  border: `1.5px solid ${selected ? "var(--pt-color-primary)" : "var(--pt-color-border)"}`,
                  background: selected ? "var(--pt-color-primary-light)" : "var(--pt-color-surface)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  transition: "border-color 0.15s, background 0.15s",
                }}
              >
                <input
                  type="radio"
                  name="objetivo"
                  value={opt.value}
                  checked={selected}
                  onChange={() => onChange({ objetivo: opt.value })}
                  style={{ accentColor: "var(--pt-color-primary)" }}
                />
                <span style={{ fontFamily: "var(--pt-font-body)", fontSize: "14px", color: "var(--pt-color-text)" }}>{opt.label}</span>
              </label>
            );
          })}
        </div>

        <div style={{ marginTop: "8px" }}>
          <label style={{ display: "block", fontFamily: "var(--pt-font-body)", color: "var(--pt-color-text-muted)", fontSize: "12px", marginBottom: "6px" }}>
            Conta um pouco mais (opcional)
          </label>
          <textarea
            value={metaDescricao}
            onChange={(e) => onChange({ meta_descricao: e.target.value })}
            placeholder="Ex.: quero recuperar disposicao, voltar a treinar com regularidade..."
            rows={3}
            style={{ width: "100%", padding: "10px 12px", borderRadius: "12px", border: "1px solid var(--pt-color-border)", background: "var(--pt-color-surface)", fontFamily: "var(--pt-font-body)", fontSize: "13.5px", color: "var(--pt-color-text)", outline: "none", resize: "vertical", lineHeight: 1.45 }}
          />
        </div>

        <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
          <button type="button" onClick={onBack} style={{ flex: "0 0 auto", padding: "12px 14px", borderRadius: "12px", border: "1px solid var(--pt-color-border)", background: "transparent", color: "var(--pt-color-text-muted)", fontFamily: "var(--pt-font-body)", fontSize: "14px", cursor: "pointer" }}>
            Voltar
          </button>
          <button type="button" onClick={onSkip} style={{ flex: "1", padding: "12px", borderRadius: "12px", border: "1px solid var(--pt-color-border)", background: "var(--pt-color-surface)", color: "var(--pt-color-text-muted)", fontFamily: "var(--pt-font-body)", fontSize: "14px", cursor: "pointer" }}>
            Pular
          </button>
          <button type="button" onClick={onNext} disabled={!objetivo} style={{ flex: "1.4", padding: "12px", borderRadius: "12px", border: "none", background: "var(--pt-color-primary)", color: "#FFF", fontFamily: "var(--pt-font-body)", fontWeight: 700, fontSize: "15px", cursor: objetivo ? "pointer" : "not-allowed", opacity: objetivo ? 1 : 0.55 }}>
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}
