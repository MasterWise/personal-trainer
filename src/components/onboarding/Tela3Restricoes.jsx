import { useMemo, useState } from "react";

const COMUNS = [
  "Intolerancia a lactose",
  "Sensibilidade a gluten",
  "Sensibilidade a FODMAPs",
  "Alimentacao vegetariana",
  "Alimentacao vegana",
  "Hipertensao",
  "Diabetes",
];

const FREQUENCIAS = [
  { value: "nao", label: "Nao treino" },
  { value: "1-2x", label: "1-2x por semana" },
  { value: "3-5x", label: "3-5x por semana" },
  { value: "diario", label: "Quase todos os dias" },
];

export default function Tela3Restricoes({ limitacoes, treinosPlanejados, onChange, onSkip, onSubmit, onBack, saving, error }) {
  const initialFreq = useMemo(() => {
    if (!Array.isArray(treinosPlanejados) || treinosPlanejados.length === 0) return "";
    const first = treinosPlanejados[0];
    return first?.frequencia || "";
  }, [treinosPlanejados]);
  const initialTipo = useMemo(() => {
    if (!Array.isArray(treinosPlanejados) || treinosPlanejados.length === 0) return "";
    return treinosPlanejados[0]?.tipo || "";
  }, [treinosPlanejados]);

  const [outras, setOutras] = useState("");
  const [frequencia, setFrequencia] = useState(initialFreq);
  const [tipoTreino, setTipoTreino] = useState(initialTipo);

  function toggleComum(label) {
    const set = new Set(limitacoes || []);
    if (set.has(label)) set.delete(label); else set.add(label);
    onChange({ limitacoes: Array.from(set) });
  }

  function applyOutrasOnSubmit(currentLimitacoes) {
    const outraTrim = outras.trim();
    if (!outraTrim) return currentLimitacoes;
    if (currentLimitacoes.includes(outraTrim)) return currentLimitacoes;
    return [...currentLimitacoes, outraTrim];
  }

  function buildTreinos() {
    if (!frequencia || frequencia === "nao") return [];
    const t = (tipoTreino || "").trim();
    if (t) return [{ tipo: t, frequencia }];
    return [{ frequencia }];
  }

  function handleSubmit() {
    const finalLimitacoes = applyOutrasOnSubmit(limitacoes || []);
    onChange({ limitacoes: finalLimitacoes, treinos_planejados: buildTreinos() });
    onSubmit();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "24px", background: "var(--pt-color-bg)" }}>
      <div style={{ width: "100%", maxWidth: "380px", display: "flex", flexDirection: "column", gap: "14px" }}>
        <p style={{ color: "var(--pt-color-text-muted)", fontSize: "13px", textAlign: "center", marginBottom: 0 }}>Passo 3 de 3</p>
        <h1 style={{ fontFamily: "var(--pt-font-heading)", color: "var(--pt-color-text)", fontSize: "1.35rem", textAlign: "center", margin: "0 0 4px 0" }}>Restricoes e rotina de treino</h1>
        <p style={{ color: "var(--pt-color-text-muted)", fontSize: "13px", textAlign: "center", marginBottom: "4px" }}>Marque o que se aplica. Tudo isso pode ser ajustado depois pelo chat.</p>

        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
          <legend style={{ fontFamily: "var(--pt-font-body)", color: "var(--pt-color-text-muted)", fontSize: "11.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>
            Restricoes alimentares ou de saude
          </legend>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 10px" }}>
            {COMUNS.map(label => {
              const checked = (limitacoes || []).includes(label);
              return (
                <label key={label} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderRadius: "10px", border: `1px solid ${checked ? "var(--pt-color-primary)" : "var(--pt-color-border)"}`, background: checked ? "var(--pt-color-primary-light)" : "var(--pt-color-surface)", cursor: "pointer", fontFamily: "var(--pt-font-body)", fontSize: "13px", color: "var(--pt-color-text)" }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleComum(label)}
                    style={{ accentColor: "var(--pt-color-primary)" }}
                  />
                  {label}
                </label>
              );
            })}
          </div>
          <input
            type="text"
            value={outras}
            onChange={(e) => setOutras(e.target.value)}
            placeholder="Outras restricoes (opcional)"
            style={{ marginTop: "8px", width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--pt-color-border)", background: "var(--pt-color-surface)", fontFamily: "var(--pt-font-body)", fontSize: "13px", color: "var(--pt-color-text)", outline: "none" }}
          />
        </fieldset>

        <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
          <legend style={{ fontFamily: "var(--pt-font-body)", color: "var(--pt-color-text-muted)", fontSize: "11.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>
            Treina regularmente?
          </legend>
          <div role="radiogroup" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {FREQUENCIAS.map(opt => {
              const selected = frequencia === opt.value;
              return (
                <label key={opt.value} style={{ padding: "10px 12px", borderRadius: "10px", border: `1.5px solid ${selected ? "var(--pt-color-primary)" : "var(--pt-color-border)"}`, background: selected ? "var(--pt-color-primary-light)" : "var(--pt-color-surface)", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", fontFamily: "var(--pt-font-body)", fontSize: "13.5px", color: "var(--pt-color-text)" }}>
                  <input
                    type="radio"
                    name="frequencia"
                    value={opt.value}
                    checked={selected}
                    onChange={() => setFrequencia(opt.value)}
                    style={{ accentColor: "var(--pt-color-primary)" }}
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
          {frequencia && frequencia !== "nao" && (
            <input
              type="text"
              value={tipoTreino}
              onChange={(e) => setTipoTreino(e.target.value)}
              placeholder="Tipo principal (musculacao, corrida, pilates...)"
              style={{ marginTop: "8px", width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--pt-color-border)", background: "var(--pt-color-surface)", fontFamily: "var(--pt-font-body)", fontSize: "13px", color: "var(--pt-color-text)", outline: "none" }}
            />
          )}
        </fieldset>

        {error && <p style={{ color: "var(--pt-color-danger)", fontSize: "13px", margin: 0 }}>{error}</p>}

        <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
          <button type="button" onClick={onBack} disabled={saving} style={{ flex: "0 0 auto", padding: "12px 14px", borderRadius: "12px", border: "1px solid var(--pt-color-border)", background: "transparent", color: "var(--pt-color-text-muted)", fontFamily: "var(--pt-font-body)", fontSize: "14px", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1 }}>
            Voltar
          </button>
          <button type="button" onClick={onSkip} disabled={saving} style={{ flex: "1", padding: "12px", borderRadius: "12px", border: "1px solid var(--pt-color-border)", background: "var(--pt-color-surface)", color: "var(--pt-color-text-muted)", fontFamily: "var(--pt-font-body)", fontSize: "14px", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.6 : 1 }}>
            Pular
          </button>
          <button type="button" onClick={handleSubmit} disabled={saving} style={{ flex: "1.4", padding: "12px", borderRadius: "12px", border: "none", background: "var(--pt-color-primary)", color: "#FFF", fontFamily: "var(--pt-font-body)", fontWeight: 700, fontSize: "15px", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Salvando..." : "Comecar"}
          </button>
        </div>
      </div>
    </div>
  );
}
