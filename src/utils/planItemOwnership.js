export function canAiMutatePlanItem(item) {
  if (!item || typeof item !== "object") return false;
  if (item.checked !== true) return true;
  return item.checked_source === "ai";
}

export function applyAiCheckedOwnership(item) {
  if (!item || typeof item !== "object") return item;
  if (item.checked === true) {
    item.checked_source = "ai";
  } else if ("checked_source" in item) {
    delete item.checked_source;
  }
  return item;
}

export function applyAiOwnershipToPlanDay(planDay) {
  if (!planDay || typeof planDay !== "object" || !Array.isArray(planDay.grupos)) return planDay;
  for (const group of planDay.grupos) {
    if (!group || !Array.isArray(group.itens)) continue;
    for (const item of group.itens) {
      applyAiCheckedOwnership(item);
    }
  }
  return planDay;
}
