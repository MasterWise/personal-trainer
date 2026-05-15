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

  it("rejeita replace_all quando payload diário aponta para outra data", () => {
    const update = {
      file: "plano",
      action: "replace_all",
      content: JSON.stringify({
        date: "22/02/2026",
        grupos: [{ nome: "Almoço", itens: [] }],
      }),
    };

    expect(lockPlanUpdateToDate(update, "27/02/2026")).toBeNull();
  });

  it("aceita replace_all quando payload diário já está na data alvo", () => {
    const update = {
      file: "plano",
      action: "replace_all",
      content: JSON.stringify({
        date: "27/02/2026",
        grupos: [{ nome: "Almoço", itens: [] }],
      }),
    };

    const guarded = lockPlanUpdateToDate(update, "27/02/2026");
    const parsed = JSON.parse(guarded.content);
    expect(parsed.date).toBe("27/02/2026");
    expect(guarded.targetDate).toBe("27/02/2026");
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

  it("detecta heurística note-only quando o JSON do plano emite nota_coach (snake_case)", () => {
    const currentPlano = JSON.stringify({
      "13/05/2026": {
        date: "13/05/2026",
        meta: { kcal: 1450 },
        grupos: [{ nome: "Almoço", itens: [{ id: "a1", texto: "Frango", checked: false }] }],
        notaCoach: "Nota antiga",
      },
    });

    const update = {
      file: "plano",
      action: "replace_all",
      content: JSON.stringify({
        date: "13/05/2026",
        meta: { kcal: 1450 },
        grupos: [{ nome: "Almoço", itens: [{ id: "a1", texto: "Frango", checked: false }] }],
        nota_coach: "Nota nova (snake)",
      }),
    };

    const guarded = lockPlanUpdateToDate(update, "13/05/2026", currentPlano);
    expect(guarded.action).toBe("patch_coach_note");
    expect(JSON.parse(guarded.content)).toEqual({
      date: "13/05/2026",
      nota: "Nota nova (snake)",
    });
  });

  it("ao autorizar replace_all, normaliza nota_coach (snake_case) para notaCoach no payload", () => {
    const update = {
      file: "plano",
      action: "replace_all",
      content: JSON.stringify({
        date: "13/05/2026",
        meta: { kcal: 1450 },
        grupos: [{ nome: "Almoço", itens: [] }],
        nota_coach: "Foco hoje",
      }),
    };

    const guarded = lockPlanUpdateToDate(update, "13/05/2026", "", { allowPlanReplaceAll: true });
    expect(guarded).not.toBeNull();
    const parsed = JSON.parse(guarded.content);
    expect(parsed.notaCoach).toBe("Foco hoje");
    expect(parsed).not.toHaveProperty("nota_coach");
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
