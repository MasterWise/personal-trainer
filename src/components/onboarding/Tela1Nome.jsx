export default function Tela1Nome({ value, onChange, onNext, error }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    onNext();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "24px", background: "var(--pt-color-bg)" }}>
      <div style={{ width: "64px", height: "64px", borderRadius: "20px", background: "linear-gradient(135deg, var(--pt-color-primary-light), var(--pt-color-primary))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", marginBottom: "20px", boxShadow: "0 6px 24px rgba(184,120,80,0.3)" }}>🌿</div>
      <h1 style={{ fontFamily: "var(--pt-font-heading)", color: "var(--pt-color-text)", marginBottom: "6px", fontSize: "1.5rem", textAlign: "center" }}>Como prefere ser chamada?</h1>
      <p style={{ color: "var(--pt-color-text-muted)", marginBottom: "8px", fontSize: "13px", textAlign: "center" }}>Passo 1 de 3</p>
      <p style={{ color: "var(--pt-color-text-muted)", marginBottom: "24px", fontSize: "14px", textAlign: "center", maxWidth: "320px" }}>Em 3 telas rapidas a gente entende o seu objetivo e suas restricoes. O resto a gente conversa pelo chat.</p>
      <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: "320px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Seu nome"
          autoFocus
          required
          style={{ padding: "12px 16px", borderRadius: "12px", border: "1px solid var(--pt-color-border)", background: "var(--pt-color-surface)", fontFamily: "var(--pt-font-body)", fontSize: "14px", color: "var(--pt-color-text)", outline: "none" }}
        />
        {error && <p style={{ color: "var(--pt-color-danger)", fontSize: "13px", margin: 0 }}>{error}</p>}
        <button type="submit" style={{ padding: "12px", borderRadius: "12px", border: "none", background: "var(--pt-color-primary)", color: "#FFF", fontFamily: "var(--pt-font-body)", fontWeight: 700, fontSize: "15px", cursor: "pointer" }}>
          Continuar
        </button>
      </form>
    </div>
  );
}
