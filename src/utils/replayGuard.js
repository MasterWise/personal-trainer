/**
 * Pre-screening utility for replaying AI document mutations.
 * Checks if a mutation has already been applied to prevent duplicates
 * on non-idempotent operations (append, add_progresso, log_treino_day, etc.).
 *
 * Idempotent by nature (safe to replay): replace_all, patch_coach_note,
 * delete_item, add_medida (built-in dedup), patch_item (merge-safe).
 *
 * Non-idempotent (need pre-screen): add_progresso, append, append_micro,
 * append_item, append_coach_note, log_treino_day.
 */

/**
 * Check if a single update has already been applied to the current docs.
 * @param {object} update - The update object { file, action, content, ... }
 * @param {object} currentDocs - The current document state keyed by doc_key
 * @returns {boolean} true if the update appears to already be applied
 */
export function isUpdateAlreadyApplied(update, currentDocs) {
  if (!update || !update.action) return false;

  const { file, action, content } = update;

  switch (action) {
    // ── Idempotent by nature: always safe to replay ──
    case "replace_all":
    case "patch_coach_note":
    case "delete_item":
    case "add_medida":
    case "patch_item":
    case "update_calorias_day":
      return false;

    // ── add_progresso: check if entry with same title+type+context exists ──
    case "add_progresso": {
      if (!content || typeof content !== "object") return false;
      try {
        const arr = JSON.parse(currentDocs.progresso || "[]");
        if (!Array.isArray(arr)) return false;
        return arr.some(p =>
          p.title === content.title &&
          p.type === content.type &&
          p.context === content.context
        );
      } catch {
        return false;
      }
    }

    // ── append / append_micro: check if text is already at the end of doc ──
    case "append":
    case "append_micro": {
      if (typeof content !== "string" || !content.trim()) return false;
      const docKey = file;
      const docStr = String(currentDocs[docKey] || "");
      return docStr.includes(content.trim());
    }

    // ── append_item: check if item with same id already exists in the group ──
    case "append_item": {
      if (!content || typeof content !== "object") return false;
      try {
        const plano = JSON.parse(currentDocs.plano || "{}");
        const targetDate = update.targetDate || update.date;
        const dayPlan = plano[targetDate];
        if (!dayPlan?.grupos) return false;
        const targetGroup = update.grupo || content.grupo;
        for (const g of dayPlan.grupos) {
          if (g.nome === targetGroup && Array.isArray(g.itens)) {
            if (content.id && g.itens.some(item => item.id === content.id)) return true;
            // Also check by nome (content description) for items without stable IDs
            if (content.nome && g.itens.some(item => item.nome === content.nome)) return true;
          }
        }
      } catch { /* parse error */ }
      return false;
    }

    // ── append_coach_note: check if note text is already a substring ──
    case "append_coach_note": {
      if (typeof content !== "string" || !content.trim()) return false;
      try {
        const plano = JSON.parse(currentDocs.plano || "{}");
        const targetDate = update.targetDate || update.date;
        const dayPlan = plano[targetDate];
        if (!dayPlan?.notaCoach) return false;
        return dayPlan.notaCoach.includes(content.trim());
      } catch {
        return false;
      }
    }

    // ── log_treino_day: check if entry with same data + tipo exists ──
    case "log_treino_day": {
      if (!content || typeof content !== "object") return false;
      try {
        const treinos = JSON.parse(currentDocs.treinos || "{}");
        const registros = treinos.registros || [];
        if (!Array.isArray(registros)) return false;
        return registros.some(r =>
          r.data === content.data &&
          r.tipo === content.tipo
        );
      } catch {
        return false;
      }
    }

    default:
      return false;
  }
}

/**
 * Filter updates that have NOT already been applied.
 * @param {Array} updates - Array of update objects
 * @param {object} currentDocs - Current document state
 * @returns {Array} updates that should be applied
 */
export function filterUnappliedUpdates(updates, currentDocs) {
  if (!Array.isArray(updates)) return [];
  return updates.filter(u => !isUpdateAlreadyApplied(u, currentDocs));
}
