/**
 * Profile diff engine — detects changes in key fields to auto-create
 * medidas entries (body data) and progresso entries (goal changes).
 */

const BODY_FIELDS = ["peso_kg", "gordura_pct", "tmb_kcal"];
const META_FIELDS = [
  "meta_peso_min", "meta_peso_max", "meta_gordura_pct",
  "meta_ano", "meta_descricao", "objetivo_semanal",
];

/**
 * Compare two perfil objects and detect meaningful changes.
 */
export function diffPerfil(prevPerfil, nextPerfil) {
  const result = {
    bodyChanged: false,
    bodyDelta: {},
    metaChanged: false,
    metaDelta: {},
    limitacoesChanged: false,
    treinosChanged: false,
  };

  for (const field of BODY_FIELDS) {
    const prev = prevPerfil[field];
    const next = nextPerfil[field];
    if (next == null || next === "") continue;
    // Normalize to numbers to avoid string/number false positives
    const prevNum = Number(prev);
    const nextNum = Number(next);
    if (!isNaN(prevNum) && !isNaN(nextNum) && Math.abs(prevNum - nextNum) < 0.01) continue;
    if (prev !== next) {
      result.bodyChanged = true;
      result.bodyDelta[field] = { from: prev, to: nextNum };
    }
  }

  for (const field of META_FIELDS) {
    const prev = prevPerfil[field];
    const next = nextPerfil[field];
    if (next == null || next === "") continue;
    // Numeric meta fields: normalize; string fields: direct comparison
    const prevNum = Number(prev);
    const nextNum = Number(next);
    if (!isNaN(prevNum) && !isNaN(nextNum) && Math.abs(prevNum - nextNum) < 0.01) continue;
    if (String(prev) !== String(next)) {
      result.metaChanged = true;
      result.metaDelta[field] = { from: prev, to: next };
    }
  }

  result.limitacoesChanged =
    JSON.stringify(prevPerfil.limitacoes || []) !== JSON.stringify(nextPerfil.limitacoes || []);
  result.treinosChanged =
    JSON.stringify(prevPerfil.treinos_planejados || []) !== JSON.stringify(nextPerfil.treinos_planejados || []);

  return result;
}

/**
 * Build a medida entry from body field changes.
 */
export function buildMedidaFromDiff(nextPerfil, bodyDelta) {
  const medida = {
    data: new Date().toLocaleDateString("pt-BR"),
    metodo: "perfil",
    notas: "Atualizado via Perfil",
  };
  if (bodyDelta.peso_kg) medida.peso_kg = bodyDelta.peso_kg.to;
  if (bodyDelta.gordura_pct) medida.gordura_pct = bodyDelta.gordura_pct.to;
  if (bodyDelta.tmb_kcal) medida.tmb_kcal = bodyDelta.tmb_kcal.to;
  return medida;
}

/**
 * Build progresso entries from meta/limitation changes.
 */
export function buildProgressoFromDiff(diff) {
  const entries = [];

  if (diff.metaChanged) {
    const descriptions = Object.entries(diff.metaDelta)
      .map(([k, v]) => `${k}: ${v.from ?? "vazio"} → ${v.to}`)
      .join(", ");
    entries.push({
      title: "Ajuste de metas",
      type: "Mudança de fase",
      context: descriptions,
      significado: "Metas recalibradas com base em nova avaliação.",
    });
  }

  if (diff.limitacoesChanged) {
    entries.push({
      title: "Limitações atualizadas",
      type: "Dificuldade",
      context: "Limitações físicas ou restrições foram alteradas no perfil.",
      significado: "Plano deve ser ajustado para novas restrições.",
    });
  }

  return entries;
}
