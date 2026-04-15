import { describe, it, expect } from "vitest";
import { evaluateAdherenceTriggers } from "../../src/utils/adherenceTriggers.js";

describe("evaluateAdherenceTriggers", () => {
  const baseVM = { treinosFeitos: 0, treinosPlanejados: 4 };

  it("detects high adherence (>=90%)", () => {
    const vm = { ...baseVM, treinosFeitos: 4, treinosPlanejados: 4 };
    const triggers = evaluateAdherenceTriggers(vm, [], []);
    expect(triggers).toHaveLength(1);
    expect(triggers[0].type).toBe("Conquista");
    expect(triggers[0].title).toContain("alta adesão");
  });

  it("detects low adherence (<50%)", () => {
    const vm = { ...baseVM, treinosFeitos: 1, treinosPlanejados: 4 };
    const triggers = evaluateAdherenceTriggers(vm, [], []);
    expect(triggers).toHaveLength(1);
    expect(triggers[0].type).toBe("Dificuldade");
  });

  it("detects new lowest weight", () => {
    const medidas = [
      { data: "01/04/2026", peso_kg: 60.5 },
      { data: "08/04/2026", peso_kg: 59.8 },
      { data: "15/04/2026", peso_kg: 58.9 },
    ];
    const triggers = evaluateAdherenceTriggers(baseVM, medidas, []);
    const weightTrigger = triggers.find(t => t.title === "Novo menor peso!");
    expect(weightTrigger).toBeTruthy();
    expect(weightTrigger.context).toContain("58.9");
  });

  it("skips weight trigger when not new low", () => {
    const medidas = [
      { data: "01/04/2026", peso_kg: 58.0 },
      { data: "08/04/2026", peso_kg: 59.8 },
    ];
    const triggers = evaluateAdherenceTriggers(baseVM, medidas, []);
    expect(triggers.find(t => t.title === "Novo menor peso!")).toBeUndefined();
  });

  it("deduplicates — skips if progresso already exists", () => {
    const vm = { ...baseVM, treinosFeitos: 4, treinosPlanejados: 4 };
    const todayLabel = new Date().toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
    const existing = [{ date: todayLabel, type: "Conquista", context: "Adesão semanal: 4/4 treinos" }];
    const triggers = evaluateAdherenceTriggers(vm, [], existing);
    expect(triggers).toHaveLength(0);
  });

  it("returns empty when no triggers met", () => {
    const vm = { ...baseVM, treinosFeitos: 2, treinosPlanejados: 4 };
    const triggers = evaluateAdherenceTriggers(vm, [], []);
    expect(triggers).toHaveLength(0);
  });

  it("handles zero planned workouts", () => {
    const vm = { treinosFeitos: 0, treinosPlanejados: 0 };
    const triggers = evaluateAdherenceTriggers(vm, [], []);
    expect(triggers).toHaveLength(0);
  });
});
