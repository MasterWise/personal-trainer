import { describe, expect, it } from "vitest";
import { deriveHealthViewModel, rebuildHealthCacheDocs } from "../../src/utils/healthModel.js";

describe("health model", () => {
  it("deriva métricas do dia a partir do plano e do perfil", () => {
    const docs = {
      plano: JSON.stringify({
        "12/04/2026": {
          date: "12/04/2026",
          meta: { kcal: 1450, proteina_g: 115, carbo_g: 110, gordura_g: 45, fibra_g: 25 },
          grupos: [
            {
              nome: "Treino",
              itens: [
                { id: "t1", tipo: "treino", texto: "Pilates", treino_tipo: "Pilates", duracao_min: 60, checked: true },
              ],
            },
            {
              nome: "Almoço",
              itens: [
                {
                  id: "a1",
                  tipo: "alimento",
                  texto: "Frango",
                  checked: true,
                  nutri: { kcal: 200, proteina_g: 30, carbo_g: 0, gordura_g: 5, fibra_g: 0 },
                },
              ],
            },
          ],
        },
      }),
      perfil: JSON.stringify({
        treinos_planejados: [
          { dia: "dom", tipo: "Pilates", duracao: "1h", horario: "07:00" },
        ],
      }),
      treinos: JSON.stringify({
        registros: [
          { data: "12/04/2026", tipo: "Pilates", realizado: true, notas: "Fez completo" },
        ],
      }),
      cal: "{}",
    };

    const viewModel = deriveHealthViewModel({
      planoStr: docs.plano,
      perfilStr: docs.perfil,
      treinosStr: docs.treinos,
      calStr: docs.cal,
      selectedDate: "12/04/2026",
    });

    expect(viewModel.dayData.kcal_consumido).toBe(200);
    expect(viewModel.dayData.proteina_g).toBe(30);
    expect(viewModel.selectedPlannedWorkouts[0].label).toContain("Pilates");
    expect(viewModel.completedPlanItems).toHaveLength(1);
    expect(viewModel.complementaryLogs[0].notas).toBe("Fez completo");
  });

  it("reconstrói caches cal e treinos a partir do plano canônico", () => {
    const docs = {
      micro: "",
      mem: "",
      hist: "",
      progresso: "[]",
      macro: "",
      perfil: JSON.stringify({
        treinos_planejados: [
          { dia: "seg", tipo: "Pilates", duracao: "1h", horario: "07:00" },
        ],
      }),
      plano: JSON.stringify({
        "14/04/2026": {
          date: "14/04/2026",
          meta: { kcal: 1450, proteina_g: 115, carbo_g: 110, gordura_g: 45, fibra_g: 25 },
          grupos: [
            {
              nome: "Treino",
              itens: [{ id: "t1", tipo: "treino", texto: "Pilates", treino_tipo: "Pilates", duracao_min: 60, checked: true }],
            },
            {
              nome: "Almoço",
              itens: [{ id: "a1", tipo: "alimento", texto: "Frango", checked: true, nutri: { kcal: 180, proteina_g: 28, carbo_g: 0, gordura_g: 4, fibra_g: 0 } }],
            },
          ],
        },
      }),
      cal: "{}",
      treinos: "{}",
    };

    const rebuilt = rebuildHealthCacheDocs(docs);
    const cal = JSON.parse(rebuilt.cal);
    const treinos = JSON.parse(rebuilt.treinos);

    expect(cal.dias["14/04/2026"].kcal_consumido).toBe(180);
    expect(cal.dias["14/04/2026"].refeicoes).toEqual(["Frango (180kcal)"]);
    expect(treinos.planejados.seg).toContain("Pilates");
    expect(treinos.registros[0]).toMatchObject({
      data: "14/04/2026",
      tipo: "Pilates",
      realizado: true,
    });
  });
});
