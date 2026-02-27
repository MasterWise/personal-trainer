import { canAiMutatePlanItem } from "./planItemOwnership.js";

function safeParseJson(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizePlanoDict(planoValue, fallbackDate) {
  const parsed = safeParseJson(planoValue);
  if (!parsed || typeof parsed !== "object") return {};
  if (Array.isArray(parsed.grupos)) {
    const key = parsed.date || fallbackDate;
    return key ? { [key]: parsed } : {};
  }
  return parsed;
}

function findPlanItem(dayPlan, itemId) {
  if (!dayPlan || !Array.isArray(dayPlan.grupos) || !itemId) return null;
  for (const grupo of dayPlan.grupos) {
    if (!grupo || !Array.isArray(grupo.itens)) continue;
    const found = grupo.itens.find((item) => item?.id === itemId);
    if (found) return found;
  }
  return null;
}

function toDisplayText(item) {
  const text = String(item?.texto || item?.id || "item sem nome").trim();
  return text || "item sem nome";
}

function buildDefaultPermissionMessage(targetItem) {
  return `Este item já foi marcado por você (${toDisplayText(targetItem)}). Quer que eu altere mesmo assim?`;
}

function buildDetailLine(update, targetItem, payload, targetDate) {
  const text = toDisplayText(targetItem);
  if (update.action === "delete_item") {
    return `Remover "${text}" em ${targetDate}.`;
  }
  if (update.action === "patch_item") {
    if (payload?.patch?.checked === false) {
      return `Desmarcar "${text}" em ${targetDate}.`;
    }
    if (typeof payload?.patch?.texto === "string" && payload.patch.texto.trim()) {
      return `Atualizar "${text}" para "${payload.patch.texto.trim()}" em ${targetDate}.`;
    }
    return `Atualizar "${text}" em ${targetDate}.`;
  }
  return `Alterar "${text}" em ${targetDate}.`;
}

export function enforcePlanUserCheckedPermission(update, currentPlanoStr) {
  if (!update || typeof update !== "object") {
    return { update, requiresPermission: false };
  }
  if (update.file !== "plano") {
    return { update, requiresPermission: false };
  }
  if (!["patch_item", "delete_item"].includes(update.action)) {
    return { update, requiresPermission: false };
  }

  const payload = safeParseJson(update.content);
  if (!payload || typeof payload !== "object" || !payload.id) {
    return { update, requiresPermission: false };
  }

  const targetDate = update.targetDate || payload.date;
  if (!targetDate) {
    return { update, requiresPermission: false };
  }

  const planoDict = normalizePlanoDict(currentPlanoStr, targetDate);
  const dayPlan = planoDict?.[targetDate];
  const targetItem = findPlanItem(dayPlan, payload.id);
  if (!targetItem) {
    return { update, requiresPermission: false };
  }

  if (canAiMutatePlanItem(targetItem)) {
    return { update, requiresPermission: false };
  }

  const detail = buildDetailLine(update, targetItem, payload, targetDate);
  const nextUpdate = {
    ...update,
    requiresPermission: true,
    permissionType: typeof update.permissionType === "string" && update.permissionType.trim()
      ? update.permissionType
      : "plan_checked_item_mutation",
    permissionMessage: typeof update.permissionMessage === "string" && update.permissionMessage.trim()
      ? update.permissionMessage
      : buildDefaultPermissionMessage(targetItem),
  };

  return {
    update: nextUpdate,
    requiresPermission: true,
    info: {
      reason: "locked_user_checked_item",
      itemId: payload.id,
      itemText: toDisplayText(targetItem),
      targetDate,
      detail,
    },
  };
}
