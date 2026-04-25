import {
  INIT_MICRO, INIT_MEM, INIT_HIST, INIT_PLANO, INIT_PROGRESSO,
  INIT_CAL, INIT_TREINOS, INIT_PERFIL, INIT_MACRO, INIT_MEDIDAS,
} from "../src/data/constants.js";

export function getSeedUserDefaults() {
  return [
    { key: "micro", content: INIT_MICRO },
    { key: "mem", content: INIT_MEM },
    { key: "hist", content: INIT_HIST },
    { key: "plano", content: INIT_PLANO },
    { key: "progresso", content: INIT_PROGRESSO },
    { key: "cal", content: INIT_CAL },
    { key: "treinos", content: INIT_TREINOS },
    { key: "perfil", content: INIT_PERFIL },
    { key: "macro", content: INIT_MACRO },
    { key: "medidas", content: INIT_MEDIDAS },
  ];
}

export function getEmptyUserDefaults() {
  return [
    { key: "micro", content: "" },
    { key: "mem", content: "" },
    { key: "hist", content: "" },
    { key: "plano", content: "{}" },
    { key: "progresso", content: "[]" },
    { key: "cal", content: JSON.stringify({ meta_diaria: { kcal: 1800, proteina_g: 100, carbo_g: 200, gordura_g: 60, fibra_g: 25 }, dias: {} }) },
    { key: "treinos", content: JSON.stringify({ planejados: {}, registros: [] }) },
    { key: "perfil", content: "{}" },
    { key: "macro", content: "" },
    { key: "medidas", content: "[]" },
  ];
}
