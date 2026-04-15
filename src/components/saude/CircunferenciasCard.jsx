import React from "react";

const LABELS = {
  cintura_cm: "Cintura",
  quadril_cm: "Quadril",
  braco_cm: "Braço",
  coxa_cm: "Coxa",
  panturrilha_cm: "Panturrilha",
  peito_cm: "Peito",
  pescoço_cm: "Pescoço",
};

export default function CircunferenciasCard({ latest, previous, theme }) {
  const c = theme.colors;
  if (!latest || Object.keys(latest).length === 0) return null;

  return (
    <div style={{ marginTop: "12px" }}>
      <p style={{ fontFamily: theme.font, fontSize: "12px", color: c.textSecondary, fontWeight: "600", margin: "0 0 8px" }}>
        📏 Circunferências
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "6px" }}>
        {Object.entries(latest).map(([key, val]) => {
          const label = LABELS[key] || key;
          const prevVal = previous?.[key];
          const delta = prevVal != null ? val - prevVal : null;
          return (
            <div key={key} style={{
              padding: "8px 10px", background: c.bg, borderRadius: "10px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontFamily: theme.font, fontSize: "12px", color: c.textSecondary }}>{label}</span>
              <span style={{ fontFamily: theme.font, fontSize: "13px", fontWeight: "600", color: c.text }}>
                {val}cm
                {delta != null && delta !== 0 && (
                  <span style={{ fontSize: "10px", marginLeft: "4px", color: delta < 0 ? (c.ok || "#5A9A5A") : (c.danger || "#C05A3A") }}>
                    {delta > 0 ? "↑" : "↓"}{Math.abs(delta).toFixed(1)}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
