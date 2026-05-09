import { useState } from "react";
import Tela1Nome from "./Tela1Nome.jsx";
import Tela2Objetivo from "./Tela2Objetivo.jsx";
import Tela3Restricoes from "./Tela3Restricoes.jsx";

const FREQ_LABELS = {
  "1-2x": "1-2x por semana",
  "3-5x": "3-5x por semana",
  "diario": "quase todos os dias",
};

function deriveDefaultName(initialName) {
  if (typeof initialName !== "string") return "";
  const trimmed = initialName.trim();
  if (!trimmed) return "";
  if (trimmed.includes("@")) return trimmed.split("@")[0];
  return trimmed.split(/\s+/)[0];
}

function buildPerfilPayload(data) {
  const out = { nome: data.nome.trim() };
  if (data.objetivo) out.objetivo = data.objetivo;

  // meta_descricao = texto livre + linha sobre frequencia/tipo de treino
  // (evita shape divergente em treinos_planejados, que e populado via chat).
  const metaParts = [];
  const trim = (data.meta_descricao || "").trim();
  if (trim) metaParts.push(trim);
  if (data.frequenciaTreino && data.frequenciaTreino !== "nao") {
    const freqLabel = FREQ_LABELS[data.frequenciaTreino] || data.frequenciaTreino;
    const tipoStr = (data.tipoTreino || "").trim();
    metaParts.push(`Treina atualmente ${freqLabel}${tipoStr ? ` (${tipoStr})` : ""}.`);
  } else if (data.frequenciaTreino === "nao") {
    metaParts.push("Hoje nao mantem rotina de treino.");
  }
  const meta = metaParts.join("\n\n");
  if (meta) out.meta_descricao = meta;

  if (Array.isArray(data.limitacoes) && data.limitacoes.length) out.limitacoes = data.limitacoes;
  return out;
}

export default function OnboardingFlow({ onSave, initialName }) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState({
    nome: deriveDefaultName(initialName),
    objetivo: "",
    meta_descricao: "",
    limitacoes: [],
    frequenciaTreino: "",
    tipoTreino: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function update(patch) {
    setData(prev => ({ ...prev, ...patch }));
  }

  async function handleSave(finalData) {
    const merged = finalData ? { ...data, ...finalData } : data;
    if (!merged.nome || !merged.nome.trim()) {
      setError("Informe como voce prefere ser chamada.");
      setStep(1);
      return;
    }
    setError("");
    setSaving(true);
    try {
      await onSave(JSON.stringify(buildPerfilPayload(merged), null, 2));
    } catch (err) {
      setError(err?.message || "Nao foi possivel salvar. Tente novamente.");
      setSaving(false);
    }
  }

  if (step === 1) {
    return (
      <Tela1Nome
        value={data.nome}
        onChange={(v) => update({ nome: v })}
        onNext={() => {
          if (!data.nome || !data.nome.trim()) {
            setError("Informe como voce prefere ser chamada.");
            return;
          }
          setError("");
          setStep(2);
        }}
        error={error}
      />
    );
  }

  if (step === 2) {
    return (
      <Tela2Objetivo
        objetivo={data.objetivo}
        metaDescricao={data.meta_descricao}
        onChange={update}
        onSkip={() => setStep(3)}
        onNext={() => setStep(3)}
        onBack={() => setStep(1)}
      />
    );
  }

  return (
    <Tela3Restricoes
      limitacoes={data.limitacoes}
      frequenciaTreino={data.frequenciaTreino}
      tipoTreino={data.tipoTreino}
      onChange={update}
      onSkip={() => handleSave()}
      onSubmit={() => handleSave()}
      onBack={() => setStep(2)}
      saving={saving}
      error={error}
    />
  );
}
