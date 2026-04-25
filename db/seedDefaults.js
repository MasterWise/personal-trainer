import { stmts } from "./index.js";
import { getEmptyUserDefaults, getSeedUserDefaults } from "./defaultDocuments.js";

export function seedUserDefaults(userId) {
  const now = new Date().toISOString();

  const defaults = getSeedUserDefaults();

  for (const { key, content } of defaults) {
    stmts.upsertDoc.run(userId, key, content, now);
  }

  console.log(`[Seed] Documentos padrao criados para usuario ${userId}`);
}

export function seedEmptyDefaults(userId) {
  const now = new Date().toISOString();

  const emptyDocs = getEmptyUserDefaults();

  for (const { key, content } of emptyDocs) {
    stmts.upsertDoc.run(userId, key, content, now);
  }

  console.log(`[Seed] Documentos vazios criados para usuario ${userId}`);
}

export function clearUserDocuments(userId) {
  const now = new Date().toISOString();

  const emptyDocs = getEmptyUserDefaults();

  for (const { key, content } of emptyDocs) {
    stmts.upsertDoc.run(userId, key, content, now);
  }

  console.log(`[Clear] Documentos limpos para usuario ${userId}`);
}
