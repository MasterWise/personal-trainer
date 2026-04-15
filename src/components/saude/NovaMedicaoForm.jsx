import React, { useState } from "react";

export default function NovaMedicaoForm({ onSave, theme }) {
  const c = theme.colors;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ peso_kg: "", gordura_pct: "", tmb_kcal: "", metodo: "balanca", notas: "" });
  const [circOpen, setCircOpen] = useState(false);
  const [circ, setCirc] = useState({ cintura_cm: "", quadril_cm: "", braco_cm: "", coxa_cm: "" });

  const inputStyle = {
    width: "100%", padding: "8px 10px", border: `1px solid ${c.border}`,
    borderRadius: "10px", fontFamily: theme.font, fontSize: "13px",
    background: c.bg, color: c.text, boxSizing: "border-box",
  };
  const labelStyle = { fontFamily: theme.font, fontSize: "11px", color: c.textSecondary, fontWeight: "600", marginBottom: "4px", display: "block" };
  const fieldStyle = { marginBottom: "10px" };

  async function handleSave() {
    const medida = {};
    if (form.peso_kg) medida.peso_kg = parseFloat(form.peso_kg);
    if (form.gordura_pct) medida.gordura_pct = parseFloat(form.gordura_pct);
    if (form.tmb_kcal) medida.tmb_kcal = parseInt(form.tmb_kcal, 10);
    if (form.metodo) medida.metodo = form.metodo;
    if (form.notas.trim()) medida.notas = form.notas.trim();

    const circEntries = Object.entries(circ).filter(([, v]) => v);
    if (circEntries.length > 0) {
      medida.circunferencias = {};
      for (const [k, v] of circEntries) medida.circunferencias[k] = parseFloat(v);
    }

    // Validate circumferences
    if (circEntries.length > 0) {
      for (const [, v] of circEntries) {
        const val = parseFloat(v);
        if (val < 10 || val > 200) return;
      }
    }

    // Range validation
    if (medida.peso_kg && (medida.peso_kg <= 0 || medida.peso_kg > 300)) return;
    if (medida.gordura_pct && (medida.gordura_pct < 0 || medida.gordura_pct > 80)) return;
    if (medida.tmb_kcal && (medida.tmb_kcal <= 0 || medida.tmb_kcal > 10000)) return;

    if (!medida.peso_kg && !medida.gordura_pct) return; // at least one required
    await onSave(medida);
    setForm({ peso_kg: "", gordura_pct: "", tmb_kcal: "", metodo: "balanca", notas: "" });
    setCirc({ cintura_cm: "", quadril_cm: "", braco_cm: "", coxa_cm: "" });
    setOpen(false);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        width: "100%", padding: "10px", border: `1.5px dashed ${c.border}`,
        borderRadius: "12px", background: "transparent", fontFamily: theme.font,
        fontSize: "13px", color: c.textSecondary, cursor: "pointer",
      }}>
        📏 Registrar nova medição
      </button>
    );
  }

  return (
    <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: "14px", padding: "16px" }}>
      <p style={{ fontFamily: theme.headingFont, fontSize: "14px", fontWeight: "700", color: c.text, margin: "0 0 12px" }}>
        📏 Nova medição
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px" }}>
        <div style={fieldStyle}>
          <label style={labelStyle}>Peso (kg) *</label>
          <input type="number" step="0.1" value={form.peso_kg} onChange={e => setForm({...form, peso_kg: e.target.value})} style={inputStyle} placeholder="58.9" />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Gordura (%)</label>
          <input type="number" step="0.1" value={form.gordura_pct} onChange={e => setForm({...form, gordura_pct: e.target.value})} style={inputStyle} placeholder="20.1" />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>TMB (kcal)</label>
          <input type="number" value={form.tmb_kcal} onChange={e => setForm({...form, tmb_kcal: e.target.value})} style={inputStyle} placeholder="1410" />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Método</label>
          <select value={form.metodo} onChange={e => setForm({...form, metodo: e.target.value})} style={inputStyle}>
            <option value="balanca">Balança</option>
            <option value="balanca + fita">Balança + fita</option>
            <option value="bioimpedancia">Bioimpedância</option>
            <option value="DEXA">DEXA</option>
          </select>
        </div>
      </div>

      <button onClick={() => setCircOpen(!circOpen)} style={{
        background: "none", border: "none", fontFamily: theme.font, fontSize: "12px",
        color: c.textMuted, cursor: "pointer", padding: "4px 0", marginBottom: "8px",
      }}>
        {circOpen ? "▾" : "▸"} Circunferências (opcional)
      </button>

      {circOpen && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px", marginBottom: "10px" }}>
          {[["cintura_cm", "Cintura (cm)"], ["quadril_cm", "Quadril (cm)"], ["braco_cm", "Braço (cm)"], ["coxa_cm", "Coxa (cm)"]].map(([key, label]) => (
            <div key={key} style={fieldStyle}>
              <label style={labelStyle}>{label}</label>
              <input type="number" step="0.1" value={circ[key]} onChange={e => setCirc({...circ, [key]: e.target.value})} style={inputStyle} />
            </div>
          ))}
        </div>
      )}

      <div style={fieldStyle}>
        <label style={labelStyle}>Notas</label>
        <input type="text" value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} style={inputStyle} placeholder="Em jejum, pela manhã..." />
      </div>

      <div style={{ display: "flex", gap: "8px" }}>
        <button onClick={handleSave} style={{
          flex: 1, padding: "10px", background: c.primary, color: "#fff",
          border: "none", borderRadius: "10px", fontFamily: theme.font,
          fontSize: "13px", fontWeight: "600", cursor: "pointer",
        }}>
          Salvar
        </button>
        <button onClick={() => setOpen(false)} style={{
          padding: "10px 16px", background: c.bg, color: c.textMuted,
          border: `1px solid ${c.border}`, borderRadius: "10px",
          fontFamily: theme.font, fontSize: "13px", cursor: "pointer",
        }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
