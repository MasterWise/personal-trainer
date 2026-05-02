import { useState } from "react";

function deriveDefaultName(initialName) {
  if (typeof initialName !== "string") return "";
  const trimmed = initialName.trim();
  if (!trimmed) return "";
  if (trimmed.includes("@")) return trimmed.split("@")[0];
  return trimmed.split(/\s+/)[0];
}

export default function OnboardingScreen({ onSave, initialName }) {
  const [nome, setNome] = useState(deriveDefaultName(initialName));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const value = nome.trim();
    if (!value) {
      setError("Informe como você prefere ser chamada.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await onSave(JSON.stringify({ nome: value }, null, 2));
    } catch (err) {
      setError(err?.message || "Não foi possível salvar. Tente novamente.");
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", padding: "24px", background: "var(--pt-color-bg)" }}>
      <div style={{ width: "64px", height: "64px", borderRadius: "20px", background: "linear-gradient(135deg, var(--pt-color-primary-light), var(--pt-color-primary))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", marginBottom: "20px", boxShadow: "0 6px 24px rgba(184,120,80,0.3)" }}>🌿</div>
      <h1 style={{ fontFamily: "var(--pt-font-heading)", color: "var(--pt-color-text)", marginBottom: "6px", fontSize: "1.5rem", textAlign: "center" }}>Como prefere ser chamada?</h1>
      <p style={{ color: "var(--pt-color-text-muted)", marginBottom: "24px", fontSize: "14px", textAlign: "center", maxWidth: "320px" }}>O resto a gente conversa pelo chat — seu coach vai te perguntar.</p>
      <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: "320px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Seu nome"
          autoFocus
          required
          style={{ padding: "12px 16px", borderRadius: "12px", border: "1px solid var(--pt-color-border)", background: "var(--pt-color-surface)", fontFamily: "var(--pt-font-body)", fontSize: "14px", color: "var(--pt-color-text)", outline: "none" }}
        />
        {error && <p style={{ color: "var(--pt-color-danger)", fontSize: "13px", margin: 0 }}>{error}</p>}
        <button type="submit" disabled={saving} style={{ padding: "12px", borderRadius: "12px", border: "none", background: "var(--pt-color-primary)", color: "#FFF", fontFamily: "var(--pt-font-body)", fontWeight: 700, fontSize: "15px", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
          {saving ? "Salvando..." : "Continuar"}
        </button>
      </form>
    </div>
  );
}
