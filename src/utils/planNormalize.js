/**
 * Normalize plan-day payloads so the rest of the app only ever sees `notaCoach`
 * (camelCase). Gemini Flash occasionally emits `nota_coach` (snake_case) inside
 * the JSON of `replace_all`, which leaves orphan keys on the persisted doc and
 * breaks both the UI (PlanoView reads `notaCoach`) and the
 * `buildCoachNoteUpdateFromReplaceAll` heuristic in `planUpdateGuard`.
 *
 * The function is pure and idempotent — safe to call on already-normalized
 * payloads or on `null/undefined`.
 */
export function normalizePlanDay(planDay) {
  if (!planDay || typeof planDay !== "object" || Array.isArray(planDay)) return planDay;
  if (!("nota_coach" in planDay)) return planDay;

  const clone = { ...planDay };
  const snakeValue = clone.nota_coach;
  delete clone.nota_coach;

  if (clone.notaCoach == null || clone.notaCoach === "") {
    clone.notaCoach = snakeValue;
  }
  return clone;
}

/**
 * Normalize note payloads from `patch_coach_note` / `append_coach_note` updates.
 * Accepts `nota`, `note` or `nota_coach` as the source field, leaving the rest
 * of the payload untouched. The downstream handler always reads `.nota`.
 */
export function normalizeNotePayload(noteData) {
  if (!noteData || typeof noteData !== "object" || Array.isArray(noteData)) return noteData;
  const nota = noteData.nota ?? noteData.note ?? noteData.nota_coach ?? "";
  return { ...noteData, nota };
}
