import { useState } from "react";
import Tela1Nome from "./Tela1Nome.jsx";
import Tela2Objetivo from "./Tela2Objetivo.jsx";
import Tela3Restricoes from "./Tela3Restricoes.jsx";

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
  if (data.meta_descricao && data.meta_descricao.trim()) out.meta_descricao = data.meta_descricao.trim();
  if (Array.isArray(data.limitacoes) && data.limitacoes.length) out.limitacoes = data.limitacoes;
  if (Array.isArray(data.treinos_planejados) && data.treinos_planejados.length) out.treinos_planejados = data.treinos_planejados;
  return out;
}

export default function OnboardingFlow({ onSave, initialName }) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState({
    nome: deriveDefaultName(initialName),
    objetivo: "",
    meta_descricao: "",
    limitacoes: [],
    treinos_planejados: [],
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
      treinosPlanejados={data.treinos_planejados}
      onChange={update}
      onSkip={() => handleSave({ limitacoes: [], treinos_planejados: [] })}
      onSubmit={() => handleSave()}
      onBack={() => setStep(2)}
      saving={saving}
      error={error}
    />
  );
}
