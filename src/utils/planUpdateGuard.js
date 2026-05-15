import { normalizePlanDay } from "./planNormalize.js";

function safeParseJson(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

// Surface silent drops via console.warn. Without this, a regression in the
// recovery pipeline (e.g. hardcoded allowPlanReplaceAll:false) discards
// legitimate updates with zero visible signal.
function dropUpdate(reason, update) {
  console.warn("[planUpdateGuard] update descartado", {
    reason,
    file: update?.file ?? null,
    action: update?.action ?? null,
    targetDate: update?.targetDate ?? null,
  });
  return null;
}

function isPlanDayObject(value) {
  return !!value && typeof value === "object" && Array.isArray(value.grupos);
}

function pickPlanDayFromPayload(payload, preferredDate) {
  if (isPlanDayObject(payload)) {
    if (!preferredDate) return payload;
    if (!payload.date || payload.date === preferredDate) return payload;
    return null;
  }

  if (!payload || typeof payload !== "object") return null;

  if (preferredDate && isPlanDayObject(payload[preferredDate])) {
    return payload[preferredDate];
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
    if (!dayPlan) return dropUpdate("replace_all_payload_invalid_or_date_mismatch", update);

    // Normalize snake_case `nota_coach` -> `notaCoach` before comparing.
    // Without this, the diff against the current plan becomes structural and
    // the note-only heuristic below can no longer detect "only the note changed".
    const normalizedPlan = normalizePlanDay({
      ...dayPlan,
      date: planDateLock,
    });

    const currentPlanoDict = parsePlanoDict(currentPlanoStr, planDateLock);
    const currentPlanForDate = isPlanDayObject(currentPlanoDict?.[planDateLock])
      ? normalizePlanDay(currentPlanoDict[planDateLock])
      : null;
    const coachNoteOnlyUpdate = buildCoachNoteUpdateFromReplaceAll({
      update,
      planDateLock,
      currentPlan: currentPlanForDate,
      incomingPlan: normalizedPlan,
    });
    if (coachNoteOnlyUpdate) return coachNoteOnlyUpdate;

    if (!allowPlanReplaceAll) return dropUpdate("replace_all_not_authorized", update);

    return {
      ...update,
      targetDate: planDateLock,
      content: toJsonString(normalizedPlan),
    };
  }

  if (["append_item", "patch_item", "delete_item", "patch_coach_note", "append_coach_note"].includes(update.action)) {
    const payload = safeParseJson(update.content);
    if (!payload || typeof payload !== "object") return dropUpdate("granular_payload_invalid", update);

    return {
      ...update,
      targetDate: planDateLock,
      content: toJsonString({ ...payload, date: planDateLock }),
    };
  }

  return update;
}
