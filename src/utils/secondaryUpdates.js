import { FILE_TO_TAB, TAB_ICONS, TAB_LABELS } from "../data/constants.js";

const SAUDE_GENERIC_ICON = "🍎";
const SAUDE_GENERIC_LABEL = "Saúde";

/**
 * Separa os grupos de revisão em dois baldes:
 *  - planoGroups: revisões do file "plano" (mantêm o card rico atual).
 *  - secondaryGroups: tudo o mais (vai pro badge inline + dropdown).
 *
 * Recebe a saída de groupRevisionsByType(...).
 */
export function partitionPlanoVsSecondary(groups) {
  const planoGroups = [];
  const secondaryGroups = [];
  if (!Array.isArray(groups)) return { planoGroups, secondaryGroups };
  for (const group of groups) {
    if (!group || typeof group !== "object") continue;
    if (group.file === "plano") planoGroups.push(group);
    else secondaryGroups.push(group);
  }
  return { planoGroups, secondaryGroups };
}

/**
 * Dedupe de ícones para o badge inline.
 *  - Files que vão para a aba "caderno" (memoria, historico, micro) ganham
 *    ícone próprio cada um, porque cada um pousa em uma sub-aba diferente.
 *  - Files da aba "saude" (calorias, treinos, medidas) colapsam em um único
 *    ícone genérico 🍎 (todos vão para a mesma aba).
 *  - Demais files (progresso, etc.) usam o próprio ícone da aba.
 *
 * Retorna [{ icon, label, file }] na ordem de primeira ocorrência.
 */
export function uniqueIconsByDestination(groups) {
  const seen = new Set();
  const result = [];
  if (!Array.isArray(groups)) return result;

  for (const group of groups) {
    const file = group?.file;
    if (!file) continue;
    const tab = FILE_TO_TAB[file];
    if (!tab) continue;

    let dedupeKey;
    let icon;
    let label;

    if (tab === "caderno") {
      // Cada file do caderno vai para sub-aba diferente — mantém ícones distintos.
      dedupeKey = `caderno:${file}`;
      icon = TAB_ICONS[file] || "📄";
      label = TAB_LABELS[file] || file;
    } else if (tab === "saude") {
      // Saúde colapsa em um único ícone genérico.
      dedupeKey = "saude";
      icon = SAUDE_GENERIC_ICON;
      label = SAUDE_GENERIC_LABEL;
    } else {
      // progresso, e quaisquer outros — uma entrada por aba.
      dedupeKey = `tab:${tab}`;
      icon = TAB_ICONS[file] || "📄";
      label = TAB_LABELS[file] || file;
    }

    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    result.push({ icon, label, file });
  }
  return result;
}

/**
 * Helper trivial para tooltip do badge inteiro.
 * Ex.: "Coach atualizou: Anotações, Histórico, Perfil"
 */
export function buildBadgeTooltip(uniqueIcons) {
  if (!Array.isArray(uniqueIcons) || uniqueIcons.length === 0) return "";
  const labels = uniqueIcons.map((i) => i.label).filter(Boolean);
  if (labels.length === 0) return "Coach atualizou itens";
  return `Coach atualizou: ${labels.join(", ")}`;
}

// Reexporta para conveniência (testes, debug).
export const __TEST__ = { SAUDE_GENERIC_ICON, SAUDE_GENERIC_LABEL };
