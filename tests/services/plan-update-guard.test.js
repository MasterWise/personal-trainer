import { describe, expect, it } from "vitest";
import { lockPlanUpdateToDate } from "../../src/utils/planUpdateGuard.js";

describe("planUpdateGuard", () => {
  it("mantém update inalterado quando não existe trava de data", () => {
    const update = {
      file: "plano",
      action: "append_item",
      content: JSON.stringify({ date: "22/02/2026", id: "a1" }),
    };

    expect(lockPlanUpdateToDate(update, null)).toEqual(update);
  });

  it("força replace_all para a data alvo quando payload é plano diário", () => {
    const update = {
      file: "plano",
      action: "replace_all",
      content: JSON.stringify({
        date: "22/02/2026",
        grupos: [{ nome: "Almoço", itens: [] }],
      }),
    };

    const guarded = lockPlanUpdateToDate(update, "27/02/2026");
    const parsed = JSON.parse(guarded.content);
    expect(parsed.date).toBe("27/02/2026");
    expect(guarded.targetDate).toBe("27/02/2026");
    expect(Array.isArray(parsed.grupos)).toBe(true);
  });

  it("em replace_all com dicionário de dias, seleciona a data alvo", () => {
    const update = {
      file: "plano",
      action: "replace_all",
      content: JSON.stringify({
        "26/02/2026": { date: "26/02/2026", grupos: [{ nome: "A", itens: [] }] },
        "27/02/2026": { date: "27/02/2026", grupos: [{ nome: "B", itens: [] }] },
      }),
    };

    const guarded = lockPlanUpdateToDate(update, "27/02/2026");
    const parsed = JSON.parse(guarded.content);
    expect(parsed.date).toBe("27/02/2026");
    expect(parsed.grupos[0].nome).toBe("B");
  });

  it("força content.date em ações granulares", () => {
    const update = {
      file: "plano",
      action: "patch_item",
      content: JSON.stringify({
        date: "22/02/2026",
        id: "a1",
        patch: { texto: "novo texto" },
      }),
    };

    const guarded = lockPlanUpdateToDate(update, "27/02/2026");
    const parsed = JSON.parse(guarded.content);
    expect(parsed.date).toBe("27/02/2026");
    expect(guarded.targetDate).toBe("27/02/2026");
    expect(parsed.id).toBe("a1");
  });

  it("retorna null quando replace_all não contém plano válido", () => {
    const update = {
      file: "plano",
      action: "replace_all",
      content: JSON.stringify({ qualquer: "coisa" }),
    };

    expect(lockPlanUpdateToDate(update, "27/02/2026")).toBeNull();
  });

  it("bloqueia replace_all de plano quando allowPlanReplaceAll=false", () => {
    const update = {
      file: "plano",
      action: "replace_all",
      content: JSON.stringify({
        date: "27/02/2026",
        grupos: [{ nome: "Almoço", itens: [] }],
      }),
    };

    const guarded = lockPlanUpdateToDate(update, "27/02/2026", "", { allowPlanReplaceAll: false });
    expect(guarded).toBeNull();
  });

  it("converte replace_all em patch_coach_note quando só a nota mudou", () => {
    const currentPlano = JSON.stringify({
      "27/02/2026": {
        date: "27/02/2026",
        meta: { kcal: 1450 },
        grupos: [{ nome: "Almoço", itens: [{ id: "a1", texto: "Frango", checked: false }] }],
        notaCoach: "Nota antiga",
      },
    });

    const update = {
      file: "plano",
      action: "replace_all",
      content: JSON.stringify({
        date: "27/02/2026",
        meta: { kcal: 1450 },
        grupos: [{ nome: "Almoço", itens: [{ id: "a1", texto: "Frango", checked: false }] }],
        notaCoach: "Nota nova",
      }),
    };

    const guarded = lockPlanUpdateToDate(update, "27/02/2026", currentPlano);
    expect(guarded.action).toBe("patch_coach_note");
    expect(guarded.targetDate).toBe("27/02/2026");
    expect(JSON.parse(guarded.content)).toEqual({
      date: "27/02/2026",
      nota: "Nota nova",
    });
  });

  it("converte replace_all em append_coach_note quando a nota só cresce no final", () => {
    const currentPlano = JSON.stringify({
      "27/02/2026": {
        date: "27/02/2026",
        meta: { kcal: 1450 },
        grupos: [{ nome: "Almoço", itens: [{ id: "a1", texto: "Frango", checked: false }] }],
        notaCoach: "Nota antiga",
      },
    });

    const update = {
      file: "plano",
      action: "replace_all",
      content: JSON.stringify({
        date: "27/02/2026",
        meta: { kcal: 1450 },
        grupos: [{ nome: "Almoço", itens: [{ id: "a1", texto: "Frango", checked: false }] }],
        notaCoach: "Nota antiga\nComplemento",
      }),
    };

    const guarded = lockPlanUpdateToDate(update, "27/02/2026", currentPlano);
    expect(guarded.action).toBe("append_coach_note");
    expect(guarded.targetDate).toBe("27/02/2026");
    expect(JSON.parse(guarded.content)).toEqual({
      date: "27/02/2026",
      nota: "Complemento",
    });
  });
});
