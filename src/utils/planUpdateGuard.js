function safeParseJson(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isPlanDayObject(value) {
  return !!value && typeof value === "object" && Array.isArray(value.grupos);
}

function pickPlanDayFromPayload(payload, preferredDate) {
  if (isPlanDayObject(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") return null;

  if (preferredDate && isPlanDayObject(payload[preferredDate])) {
    return payload[preferredDate];
  }

  for (const candidate of Object.values(payload)) {
    if (isPlanDayObject(candidate)) return candidate;
  }

  return null;
}

function toJsonString(value) {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function parsePlanoDict(planoStr, fallbackDate) {
  if (!planoStr) return {};
  const parsed = safeParseJson(planoStr);
  if (!parsed || typeof parsed !== "object") return {};
  if (isPlanDayObject(parsed)) {
    const dateKey = parsed.date || fallbackDate;
    return dateKey ? { [dateKey]: parsed } : {};
  }
  return parsed;
}

function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const key of Object.keys(value).sort()) {
    out[key] = sortKeysDeep(value[key]);
  }
  return out;
}

function serializeComparablePlan(plan) {
  if (!plan || typeof plan !== "object") return "";
  const clone = { ...plan };
  delete clone.date;
  delete clone.notaCoach;
  return JSON.stringify(sortKeysDeep(clone));
}

function buildCoachNoteUpdateFromReplaceAll({ update, planDateLock, currentPlan, incomingPlan }) {
  if (!currentPlan || !incomingPlan) return null;
  const currentComparable = serializeComparablePlan(currentPlan);
  const incomingComparable = serializeComparablePlan(incomingPlan);
  if (currentComparable !== incomingComparable) return null;

  const currentNote = String(currentPlan?.notaCoach || "");
  const nextNote = String(incomingPlan?.notaCoach || "");
  if (nextNote === currentNote) return null;

  if (currentNote && nextNote.startsWith(currentNote)) {
    const appended = nextNote.slice(currentNote.length).trim();
    if (appended) {
      return {
        ...update,
        action: "append_coach_note",
        targetDate: planDateLock,
        content: toJsonString({ date: planDateLock, nota: appended }),
      };
    }
  }

  return {
    ...update,
    action: "patch_coach_note",
    targetDate: planDateLock,
    content: toJsonString({ date: planDateLock, nota: nextNote }),
  };
}

export function lockPlanUpdateToDate(update, planDateLock, currentPlanoStr = "", options = {}) {
  const allowPlanReplaceAll = options?.allowPlanReplaceAll !== false;
  if (!update || typeof update !== "object") return update;
  if (!planDateLock || typeof planDateLock !== "string") return update;
  if (update.file !== "plano") return update;

  if (update.action === "replace_all") {
    const payload = safeParseJson(update.content);
    const dayPlan = pickPlanDayFromPayload(payload, planDateLock);
    if (!dayPlan) return null;

    const normalizedPlan = {
      ...dayPlan,
      date: planDateLock,
    };

    const currentPlanoDict = parsePlanoDict(currentPlanoStr, planDateLock);
    const currentPlanForDate = isPlanDayObject(currentPlanoDict?.[planDateLock])
      ? currentPlanoDict[planDateLock]
      : null;
    const coachNoteOnlyUpdate = buildCoachNoteUpdateFromReplaceAll({
      update,
      planDateLock,
      currentPlan: currentPlanForDate,
      incomingPlan: normalizedPlan,
    });
    if (coachNoteOnlyUpdate) return coachNoteOnlyUpdate;

    if (!allowPlanReplaceAll) return null;

    return {
      ...update,
      targetDate: planDateLock,
      content: toJsonString(normalizedPlan),
    };
  }

  if (["append_item", "patch_item", "delete_item", "patch_coach_note", "append_coach_note"].includes(update.action)) {
    const payload = safeParseJson(update.content);
    if (!payload || typeof payload !== "object") return null;

    return {
      ...update,
      targetDate: planDateLock,
      content: toJsonString({ ...payload, date: planDateLock }),
    };
  }

  return update;
}
