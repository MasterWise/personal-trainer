import { describe, it, expect } from "vitest";
import { normalizePlanDay, normalizeNotePayload } from "../../src/utils/planNormalize.js";

describe("normalizePlanDay", () => {
  it("converte nota_coach (snake_case) em notaCoach quando nao houver camelCase", () => {
    const out = normalizePlanDay({ date: "13/05/2026", nota_coach: "Foco hoje", grupos: [] });
    expect(out.notaCoach).toBe("Foco hoje");
    expect(out).not.toHaveProperty("nota_coach");
  });

  it("preserva notaCoach existente e descarta nota_coach quando ambos estiverem presentes", () => {
    const out = normalizePlanDay({
      date: "13/05/2026",
      nota_coach: "antigo (snake)",
      notaCoach: "atual (camel)",
      grupos: [],
    });
    expect(out.notaCoach).toBe("atual (camel)");
    expect(out).not.toHaveProperty("nota_coach");
  });

  it("usa nota_coach quando notaCoach estiver vazio", () => {
    const out = normalizePlanDay({
      nota_coach: "vai virar canonico",
      notaCoach: "",
      grupos: [],
    });
    expect(out.notaCoach).toBe("vai virar canonico");
    expect(out).not.toHaveProperty("nota_coach");
  });

  it("preserva planos que ja estao em camelCase (no-op)", () => {
    const input = { date: "13/05/2026", notaCoach: "Foco hoje", grupos: [] };
    const out = normalizePlanDay(input);
    expect(out).toEqual(input);
  });

  it("passa null/undefined sem erro", () => {
    expect(normalizePlanDay(null)).toBeNull();
    expect(normalizePlanDay(undefined)).toBeUndefined();
  });

  it("nao quebra com arrays ou primitivos", () => {
    expect(normalizePlanDay([1, 2])).toEqual([1, 2]);
    expect(normalizePlanDay("string")).toBe("string");
  });
});

describe("normalizeNotePayload", () => {
  it("preserva nota como canonica", () => {
    const out = normalizeNotePayload({ nota: "minha nota", date: "13/05/2026" });
    expect(out.nota).toBe("minha nota");
    expect(out.date).toBe("13/05/2026");
  });

  it("aceita note (en) e mapeia para nota", () => {
    const out = normalizeNotePayload({ note: "english note" });
    expect(out.nota).toBe("english note");
  });

  it("aceita nota_coach (snake_case) e mapeia para nota", () => {
    const out = normalizeNotePayload({ nota_coach: "snake note" });
    expect(out.nota).toBe("snake note");
  });

  it("prioriza nota > note > nota_coach", () => {
    const out = normalizeNotePayload({ nota: "1", note: "2", nota_coach: "3" });
    expect(out.nota).toBe("1");
  });

  it("retorna nota vazia quando nenhuma das chaves existe", () => {
    const out = normalizeNotePayload({ date: "13/05/2026" });
    expect(out.nota).toBe("");
  });

  it("passa null/undefined sem erro", () => {
    expect(normalizeNotePayload(null)).toBeNull();
    expect(normalizeNotePayload(undefined)).toBeUndefined();
  });
});
