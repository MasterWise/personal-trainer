export function normalizePromptCard(prompt, fallback = {}) {
  const detailsRaw = Array.isArray(prompt?.details)
    ? prompt.details
    : (Array.isArray(fallback.details) ? fallback.details : []);
  const details = detailsRaw
    .filter((line) => typeof line === "string")
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    title: String(prompt?.title || fallback.title || "Confirmação necessária"),
    message: String(prompt?.message || fallback.message || "Posso aplicar esta alteração?"),
    approveLabel: String(prompt?.approveLabel || fallback.approveLabel || "✓ Sim, aplicar"),
    rejectLabel: String(prompt?.rejectLabel || fallback.rejectLabel || "Não"),
    details,
    approvedFeedback: String(prompt?.approvedFeedback || fallback.approvedFeedback || "✓ Alterações aplicadas."),
    rejectedFeedback: String(prompt?.rejectedFeedback || fallback.rejectedFeedback || "Ok, mantive como estava."),
  };
}

function buildDefaultPromptFromEntries(entries) {
  const lockedEntries = entries.filter((entry) => entry?.info?.reason === "locked_user_checked_item");
  if (lockedEntries.length > 0) {
    const details = lockedEntries
      .map((entry) => entry?.info?.detail)
      .filter((line) => typeof line === "string" && line.trim());

    return normalizePromptCard(
      entries[0]?.update?.permissionPrompt,
      {
        title: "Alterar itens já concluídos por você?",
        message: "Esses itens estão marcados como realizados por você. Confirmar alteração/remoção?",
        approveLabel: "Sim, alterar itens",
        rejectLabel: "Não, manter",
        details,
        approvedFeedback: "✓ Alterações nos itens concluídos foram aplicadas.",
        rejectedFeedback: "Perfeito, mantive os itens concluídos sem alterações.",
      }
    );
  }

  const perfilEntries = entries.filter((entry) => entry?.info?.reason === "perfil_mutation");
  if (perfilEntries.length > 0) {
    const details = perfilEntries.flatMap((entry) => {
      const diff = Array.isArray(entry?.info?.diff) ? entry.info.diff : [];
      return diff.map((d) => `${d.label}: ${d.before} → ${d.after}`);
    }).filter(Boolean);

    return normalizePromptCard(
      perfilEntries[0]?.update?.permissionPrompt,
      {
        title: "Atualizar seu perfil?",
        message: details.length > 1
          ? "A Coach quer atualizar estes campos do seu perfil:"
          : "A Coach quer atualizar seu perfil:",
        approveLabel: "Sim, atualizar",
        rejectLabel: "Não, manter",
        details: details.length > 0 ? details : ["(nenhuma mudança detectada)"],
        approvedFeedback: "✓ Perfil atualizado.",
        rejectedFeedback: "Ok, mantive seu perfil como estava.",
      }
    );
  }

  const firstMessage = String(entries[0]?.update?.permissionMessage || "Posso aplicar esta alteração?");
  return normalizePromptCard(
    entries[0]?.update?.permissionPrompt,
    {
      message: firstMessage,
      details: [],
    }
  );
}

export function buildPermissionGroups(permissionEntries) {
  if (!Array.isArray(permissionEntries) || permissionEntries.length === 0) return [];

  const groups = new Map();
  permissionEntries.forEach((entry, index) => {
    const explicitGroup = typeof entry?.update?.permissionGroupId === "string"
      ? entry.update.permissionGroupId.trim()
      : "";
    const reason = entry?.info?.reason;
    let fallbackByReason;
    if (reason === "locked_user_checked_item") {
      fallbackByReason = `locked_user_checked_item:${entry?.info?.targetDate || "sem_data"}`;
    } else if (reason === "perfil_mutation") {
      fallbackByReason = "perfil_mutation";
    } else {
      fallbackByReason = `single:${index}`;
    }
    const groupKey = explicitGroup || fallbackByReason;

    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push(entry);
  });

  return Array.from(groups.values()).map((entries, index) => ({
    id: `${Date.now()}-${Math.random()}-${index}`,
    updates: entries.map((entry) => entry.update),
    prompt: buildDefaultPromptFromEntries(entries),
  }));
}
