import { describe, expect, it } from "vitest";
import { applyAiCheckedOwnership, applyAiOwnershipToPlanDay, canAiMutatePlanItem } from "../../src/utils/planItemOwnership.js";

describe("plan item ownership", () => {
  it("permite mutação em item não marcado", () => {
    expect(canAiMutatePlanItem({ id: "a1", checked: false })).toBe(true);
    expect(canAiMutatePlanItem({ id: "a2" })).toBe(true);
  });

  it("permite mutação em item marcado pela IA", () => {
    expect(canAiMutatePlanItem({ id: "a1", checked: true, checked_source: "ai" })).toBe(true);
  });

  it("bloqueia mutação em item marcado pelo usuário ou sem ownership explícita", () => {
    expect(canAiMutatePlanItem({ id: "a1", checked: true, checked_source: "user" })).toBe(false);
    expect(canAiMutatePlanItem({ id: "a2", checked: true })).toBe(false);
  });

  it("marca como IA quando item está checked", () => {
    const item = { id: "a1", checked: true };
    const next = applyAiCheckedOwnership(item);
    expect(next.checked_source).toBe("ai");
  });

  it("remove checked_source quando item fica unchecked", () => {
    const item = { id: "a1", checked: false, checked_source: "ai" };
    const next = applyAiCheckedOwnership(item);
    expect(next.checked_source).toBeUndefined();
  });

  it("aplica ownership em todos os itens marcados do dia", () => {
    const day = {
      date: "27/02/2026",
      grupos: [
        {
          nome: "Almoço",
          itens: [
            { id: "a1", checked: true },
            { id: "a2", checked: false, checked_source: "user" },
          ],
        },
      ],
    };

    const next = applyAiOwnershipToPlanDay(day);
    expect(next.grupos[0].itens[0].checked_source).toBe("ai");
    expect(next.grupos[0].itens[1].checked_source).toBeUndefined();
  });
});
