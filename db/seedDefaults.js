import { stmts } from "./index.js";
import {
  INIT_MICRO, INIT_MEM, INIT_HIST, INIT_PLANO, INIT_PROGRESSO,
  INIT_CAL, INIT_TREINOS, INIT_PERFIL, INIT_MACRO,
} from "../src/data/constants.js";

export function seedUserDefaults(userId) {
  const now = new Date().toISOString();

  const defaults = [
    { key: "micro", content: INIT_MICRO },
    { key: "mem", content: INIT_MEM },
    { key: "hist", content: INIT_HIST },
    { key: "plano", content: INIT_PLANO },
    { key: "progresso", content: INIT_PROGRESSO },
    { key: "cal", content: INIT_CAL },
    { key: "treinos", content: INIT_TREINOS },
    { key: "perfil", content: INIT_PERFIL },
    { key: "macro", content: INIT_MACRO },
  ];

  for (const { key, content } of defaults) {
    stmts.upsertDoc.run(userId, key, content, now);
  }

  console.log(`[Seed] Documentos padrao criados para usuario ${userId}`);
}

export function clearUserDocuments(userId) {
  const now = new Date().toISOString();

  const emptyDocs = [
    { key: "micro", content: "" },
    { key: "mem", content: "" },
    { key: "hist", content: "" },
    { key: "plano", content: JSON.stringify({ date: "", meta: {}, grupos: [] }) },
    { key: "progresso", content: "[]" },
    { key: "cal", content: JSON.stringify({ meta_diaria: { kcal: 1800, proteina_g: 100, carbo_g: 200, gordura_g: 60, fibra_g: 25 }, dias: {} }) },
    { key: "treinos", content: JSON.stringify({ planejados: {}, registros: [] }) },
    { key: "perfil", content: "{}" },
    { key: "macro", content: "" },
  ];

  for (const { key, content } of emptyDocs) {
    stmts.upsertDoc.run(userId, key, content, now);
  }

  console.log(`[Clear] Documentos limpos para usuario ${userId}`);
}
