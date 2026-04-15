import { describe, it, expect } from "vitest";
import { diffPerfil, buildMedidaFromDiff, buildProgressoFromDiff } from "../../src/utils/perfilDiff.js";

describe("diffPerfil", () => {
  const basePerfil = {
    peso_kg: 60.5,
    gordura_pct: 21.4,
    tmb_kcal: 1397,
    meta_peso_min: 55,
    meta_peso_max: 58,
    meta_gordura_pct: 18,
    meta_ano: 2027,
    meta_descricao: "Fortalecer core",
    objetivo_semanal: "Definição",
    limitacoes: ["Hipermobilidade"],
    treinos_planejados: [{ dia: "seg", tipo: "Pilates" }],
  };

  it("detects body field changes", () => {
    const next = { ...basePerfil, peso_kg: 58.9, gordura_pct: 20.1 };
    const diff = diffPerfil(basePerfil, next);
    expect(diff.bodyChanged).toBe(true);
    expect(diff.bodyDelta.peso_kg).toEqual({ from: 60.5, to: 58.9 });
    expect(diff.bodyDelta.gordura_pct).toEqual({ from: 21.4, to: 20.1 });
    expect(diff.metaChanged).toBe(false);
  });

  it("detects meta field changes", () => {
    const next = { ...basePerfil, meta_peso_max: 57, meta_ano: 2026 };
    const diff = diffPerfil(basePerfil, next);
    expect(diff.metaChanged).toBe(true);
    expect(diff.metaDelta.meta_peso_max).toEqual({ from: 58, to: 57 });
    expect(diff.metaDelta.meta_ano).toEqual({ from: 2027, to: 2026 });
    expect(diff.bodyChanged).toBe(false);
  });

  it("detects limitation changes", () => {
    const next = { ...basePerfil, limitacoes: ["Hipermobilidade", "Joelho esquerdo"] };
    const diff = diffPerfil(basePerfil, next);
    expect(diff.limitacoesChanged).toBe(true);
  });

  it("detects treinos changes", () => {
    const next = { ...basePerfil, treinos_planejados: [{ dia: "seg", tipo: "Musculação" }] };
    const diff = diffPerfil(basePerfil, next);
    expect(diff.treinosChanged).toBe(true);
  });

  it("returns all false when nothing changed", () => {
    const diff = diffPerfil(basePerfil, { ...basePerfil });
    expect(diff.bodyChanged).toBe(false);
    expect(diff.metaChanged).toBe(false);
    expect(diff.limitacoesChanged).toBe(false);
    expect(diff.treinosChanged).toBe(false);
  });

  it("ignores null/empty new values", () => {
    const next = { ...basePerfil, peso_kg: null, gordura_pct: "" };
    const diff = diffPerfil(basePerfil, next);
    expect(diff.bodyChanged).toBe(false);
  });

  it("handles string vs number comparison (tolerance)", () => {
    const next = { ...basePerfil, peso_kg: "60.5" };
    const diff = diffPerfil(basePerfil, next);
    expect(diff.bodyChanged).toBe(false);
  });

  it("detects change above tolerance threshold (0.01)", () => {
    const next = { ...basePerfil, peso_kg: 60.52 };
    const diff = diffPerfil(basePerfil, next);
    expect(diff.bodyChanged).toBe(true);
  });

  it("ignores sub-threshold change (0.005)", () => {
    const next = { ...basePerfil, peso_kg: 60.505 };
    const diff = diffPerfil(basePerfil, next);
    expect(diff.bodyChanged).toBe(false);
  });
});

describe("buildMedidaFromDiff", () => {
  it("creates medida from body delta", () => {
    const bodyDelta = { peso_kg: { from: 60.5, to: 58.9 }, gordura_pct: { from: 21.4, to: 20.1 } };
    const medida = buildMedidaFromDiff({}, bodyDelta);
    expect(medida.peso_kg).toBe(58.9);
    expect(medida.gordura_pct).toBe(20.1);
    expect(medida.metodo).toBe("perfil");
    expect(medida.data).toBeTruthy();
  });
});

describe("buildProgressoFromDiff", () => {
  it("creates progresso for meta changes", () => {
    const diff = {
      metaChanged: true,
      metaDelta: { meta_peso_max: { from: 58, to: 57 } },
      limitacoesChanged: false,
    };
    const entries = buildProgressoFromDiff(diff);
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe("Mudança de fase");
    expect(entries[0].context).toContain("57");
  });

  it("creates progresso for limitation changes", () => {
    const diff = { metaChanged: false, metaDelta: {}, limitacoesChanged: true };
    const entries = buildProgressoFromDiff(diff);
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe("Dificuldade");
  });

  it("creates both when meta and limitations change", () => {
    const diff = {
      metaChanged: true,
      metaDelta: { meta_ano: { from: 2027, to: 2026 } },
      limitacoesChanged: true,
    };
    const entries = buildProgressoFromDiff(diff);
    expect(entries).toHaveLength(2);
  });

  it("returns empty array when nothing changed", () => {
    const diff = { metaChanged: false, metaDelta: {}, limitacoesChanged: false };
    const entries = buildProgressoFromDiff(diff);
    expect(entries).toHaveLength(0);
  });
});
