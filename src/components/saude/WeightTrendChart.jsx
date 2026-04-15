import React from "react";

/**
 * Simple SVG line chart for weight trend visualization.
 * No external dependencies — pure SVG.
 */
export default function WeightTrendChart({ entries, metaMin, metaMax, theme }) {
  const c = theme.colors;
  if (!entries || entries.length < 2) {
    return (
      <p style={{ fontFamily: theme.font, color: c.textMuted, fontSize: "12px", textAlign: "center", padding: "16px 0" }}>
        Precisa de ao menos 2 medições para gerar o gráfico.
      </p>
    );
  }

  const W = 300, H = 140, PAD = { top: 16, right: 16, bottom: 28, left: 36 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const weights = entries.map(e => e.peso_kg);
  const allVals = [...weights];
  if (metaMin) allVals.push(metaMin);
  if (metaMax) allVals.push(metaMax);
  const yMin = Math.floor(Math.min(...allVals) - 2);
  const yMax = Math.ceil(Math.max(...allVals) + 2);
  const yRange = yMax - yMin || 1;

  const toX = (i) => PAD.left + (i / (entries.length - 1)) * plotW;
  const toY = (v) => PAD.top + plotH - ((v - yMin) / yRange) * plotH;

  const points = entries.map((e, i) => ({ x: toX(i), y: toY(e.peso_kg), ...e }));
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  // Y-axis ticks (4-5)
  const yTicks = [];
  const yStep = Math.ceil(yRange / 4);
  for (let v = yMin; v <= yMax; v += yStep) yTicks.push(v);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      {/* Goal range band */}
      {metaMin != null && metaMax != null && (
        <rect
          x={PAD.left} y={toY(metaMax)}
          width={plotW} height={toY(metaMin) - toY(metaMax)}
          fill={c.ok || "#5A9A5A"} opacity="0.10" rx="3"
        />
      )}

      {/* Grid lines + Y labels */}
      {yTicks.map(v => (
        <g key={v}>
          <line x1={PAD.left} y1={toY(v)} x2={W - PAD.right} y2={toY(v)}
            stroke={c.border || "#ddd"} strokeWidth="0.5" />
          <text x={PAD.left - 6} y={toY(v) + 3}
            fill={c.textMuted || "#999"} fontSize="8" fontFamily={theme.font} textAnchor="end">
            {v}
          </text>
        </g>
      ))}

      {/* Line */}
      <path d={linePath} fill="none" stroke={c.primary || "#B87850"} strokeWidth="2" strokeLinejoin="round" />

      {/* Points + X labels */}
      {points.map((p, i) => {
        const isLast = i === points.length - 1;
        const label = (p.data || "").split("/").slice(0, 2).join("/");
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={isLast ? 4 : 2.5}
              fill={isLast ? c.primary || "#B87850" : c.surface || "#fff"}
              stroke={c.primary || "#B87850"} strokeWidth={isLast ? 2 : 1.5} />
            {(i === 0 || isLast || i % Math.max(1, Math.floor(entries.length / 5)) === 0) && (
              <text x={p.x} y={H - 6}
                fill={c.textMuted || "#999"} fontSize="7" fontFamily={theme.font} textAnchor="middle">
                {label}
              </text>
            )}
          </g>
        );
      })}

      {/* Meta labels */}
      {metaMin != null && (
        <text x={W - PAD.right + 2} y={toY(metaMin) + 3}
          fill={c.ok || "#5A9A5A"} fontSize="7" fontFamily={theme.font} fontStyle="italic">
          meta
        </text>
      )}
    </svg>
  );
}
