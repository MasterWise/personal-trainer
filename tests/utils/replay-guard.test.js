import { describe, it, expect } from "vitest";
import { isUpdateAlreadyApplied, filterUnappliedUpdates } from "../../src/utils/replayGuard.js";

describe("isUpdateAlreadyApplied", () => {
  it("returns false for replace_all (always safe to replay)", () => {
    const update = { action: "replace_all", file: "plano", content: "anything" };
    expect(isUpdateAlreadyApplied(update, {})).toBe(false);
  });

  it("returns false for add_medida (built-in dedup)", () => {
    const update = { action: "add_medida", file: "medidas", content: { peso_kg: 70 } };
    expect(isUpdateAlreadyApplied(update, {})).toBe(false);
  });

  it("detects duplicate add_progresso by title+type+context", () => {
    const existing = [
      { title: "Novo menor peso!", type: "Conquista", context: "58.9 kg" },
    ];
    const currentDocs = { progresso: JSON.stringify(existing) };
    const update = {
      action: "add_progresso",
      file: "progresso",
      content: { title: "Novo menor peso!", type: "Conquista", context: "58.9 kg" },
    };
    expect(isUpdateAlreadyApplied(update, currentDocs)).toBe(true);
  });

  it("returns false for add_progresso when no match", () => {
    const existing = [
      { title: "Novo menor peso!", type: "Conquista", context: "58.9 kg" },
    ];
    const currentDocs = { progresso: JSON.stringify(existing) };
    const update = {
      action: "add_progresso",
      file: "progresso",
      content: { title: "Novo menor peso!", type: "Conquista", context: "57.5 kg" },
    };
    expect(isUpdateAlreadyApplied(update, currentDocs)).toBe(false);
  });

  it("detects duplicate append when text is already in doc", () => {
    const currentDocs = { diario: "Treino concluído com sucesso hoje." };
    const update = {
      action: "append",
      file: "diario",
      content: "Treino concluído com sucesso hoje.",
    };
    expect(isUpdateAlreadyApplied(update, currentDocs)).toBe(true);
  });

  it("returns false for append when text is not in doc", () => {
    const currentDocs = { diario: "Treino de ontem registrado." };
    const update = {
      action: "append",
      file: "diario",
      content: "Novo treino registrado hoje.",
    };
    expect(isUpdateAlreadyApplied(update, currentDocs)).toBe(false);
  });

  it("detects duplicate append_item by item id in plano grupo", () => {
    const plano = {
      "2026-04-15": {
        grupos: [
          {
            nome: "Peito",
            itens: [
              { id: "ex-001", nome: "Supino reto", series: 3, reps: 10 },
            ],
          },
        ],
      },
    };
    const currentDocs = { plano: JSON.stringify(plano) };
    const update = {
      action: "append_item",
      file: "plano",
      targetDate: "2026-04-15",
      grupo: "Peito",
      content: { id: "ex-001", nome: "Supino reto", series: 3, reps: 10 },
    };
    expect(isUpdateAlreadyApplied(update, currentDocs)).toBe(true);
  });
});

describe("filterUnappliedUpdates", () => {
  it("filters out already-applied updates and keeps new ones", () => {
    const existing = [
      { title: "Novo menor peso!", type: "Conquista", context: "58.9 kg" },
    ];
    const currentDocs = {
      progresso: JSON.stringify(existing),
      diario: "Texto já existente no diário.",
    };

    const updates = [
      // duplicate — should be filtered out
      {
        action: "add_progresso",
        file: "progresso",
        content: { title: "Novo menor peso!", type: "Conquista", context: "58.9 kg" },
      },
      // duplicate append — should be filtered out
      {
        action: "append",
        file: "diario",
        content: "Texto já existente no diário.",
      },
      // new entry — should pass through
      {
        action: "add_progresso",
        file: "progresso",
        content: { title: "Alta adesão semanal", type: "Conquista", context: "4/4 treinos" },
      },
      // idempotent — always passes through
      {
        action: "replace_all",
        file: "plano",
        content: "novo plano completo",
      },
    ];

    const result = filterUnappliedUpdates(updates, currentDocs);
    expect(result).toHaveLength(2);
    expect(result[0].content.title).toBe("Alta adesão semanal");
    expect(result[1].action).toBe("replace_all");
  });
});
