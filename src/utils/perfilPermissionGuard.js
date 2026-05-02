function safeParseJson(value) {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractFields(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (payload.fields && typeof payload.fields === "object" && !Array.isArray(payload.fields)) {
    return payload.fields;
  }
  return payload;
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    return value
      .map((item) => (item && typeof item === "object" ? JSON.stringify(item) : String(item)))
      .join(", ");
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

const FIELD_LABELS = {
  nome: "Nome",
  idade: "Idade",
  cidade: "Cidade",
  peso_kg: "Peso (kg)",
  gordura_pct: "Gordura (%)",
  meta_peso_min: "Meta peso mín",
  meta_peso_max: "Meta peso máx",
  meta_gordura_pct: "Meta gordura (%)",
  meta_ano: "Ano da meta",
  meta_descricao: "Objetivo",
  objetivo_semanal: "Foco semanal",
  tmb_kcal: "TMB (kcal)",
  agua_litros: "Água (L/dia)",
  macros_alvo: "Metas nutricionais",
  limitacoes: "Limitações",
  treinos_planejados: "Treinos planejados",
  habitos: "Hábitos",
  notas_livres: "Notas livres",
  preferencias_alimentares: "Preferências alimentares",
};

function labelForField(key) {
  return FIELD_LABELS[key] || key;
}

function valuesAreEqual(a, b) {
  if (a === b) return true;
  if (a == null && b == null) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function buildDiff(currentPerfilStr, fields) {
  const current = safeParseJson(currentPerfilStr) || {};
  const diff = [];
  for (const [key, nextValue] of Object.entries(fields)) {
    const prevValue = current[key];
    if (valuesAreEqual(prevValue, nextValue)) continue;
    diff.push({
      key,
      label: labelForField(key),
      before: formatValue(prevValue),
      after: formatValue(nextValue),
    });
  }
  return diff;
}

function buildDetails(diff) {
  return diff.map((entry) => `${entry.label}: ${entry.before} → ${entry.after}`);
}

function buildDefaultPrompt(diff) {
  const details = buildDetails(diff);
  return {
    title: "Atualizar seu perfil?",
    message: diff.length > 1
      ? "A Coach quer atualizar estes campos do seu perfil:"
      : "A Coach quer atualizar seu perfil:",
    approveLabel: "Sim, atualizar",
    rejectLabel: "Não, manter",
    details: details.length > 0 ? details : ["(nenhuma mudança detectada)"],
    approvedFeedback: "✓ Perfil atualizado.",
    rejectedFeedback: "Ok, mantive seu perfil como estava.",
  };
}

function mergePromptCard(aiPrompt, defaults) {
  if (!aiPrompt || typeof aiPrompt !== "object") return defaults;
  return {
    title: typeof aiPrompt.title === "string" && aiPrompt.title.trim() ? aiPrompt.title : defaults.title,
    message: typeof aiPrompt.message === "string" && aiPrompt.message.trim() ? aiPrompt.message : defaults.message,
    approveLabel: typeof aiPrompt.approveLabel === "string" && aiPrompt.approveLabel.trim() ? aiPrompt.approveLabel : defaults.approveLabel,
    rejectLabel: typeof aiPrompt.rejectLabel === "string" && aiPrompt.rejectLabel.trim() ? aiPrompt.rejectLabel : defaults.rejectLabel,
    details: Array.isArray(aiPrompt.details) && aiPrompt.details.length > 0
      ? aiPrompt.details.filter((line) => typeof line === "string" && line.trim()).map((line) => line.trim())
      : defaults.details,
    approvedFeedback: typeof aiPrompt.approvedFeedback === "string" && aiPrompt.approvedFeedback.trim() ? aiPrompt.approvedFeedback : defaults.approvedFeedback,
    rejectedFeedback: typeof aiPrompt.rejectedFeedback === "string" && aiPrompt.rejectedFeedback.trim() ? aiPrompt.rejectedFeedback : defaults.rejectedFeedback,
  };
}

export function enforcePerfilPermission(update, currentPerfilStr) {
  if (!update || typeof update !== "object" || update.file !== "perfil") {
    return { update, requiresPermission: false };
  }

  const payload = safeParseJson(update.content);
  const fields = update.action === "patch_perfil"
    ? extractFields(payload)
    : (payload && typeof payload === "object" && !Array.isArray(payload) ? payload : null);

  // No usable fields → drop silently. Otherwise the user would see an empty card
  // ("nenhuma mudança detectada") and approving would do nothing because the
  // DocsContext handler bails out on invalid content.
  if (!fields || typeof fields !== "object" || Array.isArray(fields) || Object.keys(fields).length === 0) {
    console.warn("[perfilPermissionGuard] update sem fields validos — descartado", { action: update.action });
    return { update: null, requiresPermission: false, info: { reason: "perfil_invalid_payload" } };
  }

  const diff = buildDiff(currentPerfilStr, fields);
  const defaults = buildDefaultPrompt(diff);
  const merged = mergePromptCard(update.permissionPrompt, defaults);

  const nextUpdate = {
    ...update,
    requiresPermission: true,
    permissionType: typeof update.permissionType === "string" && update.permissionType.trim()
      ? update.permissionType
      : "perfil_mutation",
    permissionMessage: typeof update.permissionMessage === "string" && update.permissionMessage.trim()
      ? update.permissionMessage
      : merged.message,
    permissionPrompt: merged,
  };

  return {
    update: nextUpdate,
    requiresPermission: true,
    info: {
      reason: "perfil_mutation",
      changedFields: diff.map((entry) => entry.key),
      diff,
    },
  };
}
