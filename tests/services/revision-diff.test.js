import { describe, expect, it } from "vitest";
import { buildRevisionDiff } from "../../src/utils/revisionDiff.js";

describe("revision diff", () => {
  it("em append mostra apenas trecho adicionado", () => {
    const before = "# Memória\nlinha A";
    const after = `${before}\n\nlinha B`;
    const diff = buildRevisionDiff("append", before, after);

    expect(diff.hideBefore).toBe(true);
    expect(diff.afterDisplay).toBe("linha B");
  });

  it("em replace mostra só janela alterada", () => {
    const before = "abc\nvalor antigo\nxyz";
    const after = "abc\nvalor novo\nxyz";
    const diff = buildRevisionDiff("replace_all", before, after);

    expect(diff.hideBefore).toBe(false);
    expect(diff.beforeDisplay).toContain("valor antigo");
    expect(diff.afterDisplay).toContain("valor novo");
    expect(diff.beforeDisplay).toContain("…");
    expect(diff.afterDisplay).toContain("…");
  });

  it("em add_progresso oculta bloco antes", () => {
    const diff = buildRevisionDiff("add_progresso", "", "{\"title\":\"Novo\"}");
    expect(diff.hideBefore).toBe(true);
  });

  it("normaliza json antes de calcular diff", () => {
    const before = JSON.stringify({
      "22/02/2026": {
        date: "22/02/2026",
        meta: { kcal: 1450, proteina_g: 115, carbo_g: 110 },
      },
    });
    const after = JSON.stringify({
      "22/02/2026": {
        date: "22/02/2026",
        meta: { kcal: 1450, proteina_g: 115, carbo_g: 115 },
      },
    });

    const diff = buildRevisionDiff("replace_all", before, after);
    expect(diff.beforeDisplay).toContain('"carbo_g": 110');
    expect(diff.afterDisplay).toContain('"carbo_g": 115');
    expect(diff.beforeDisplay).not.toContain('\\"carbo_g\\"');
  });
});
