import { Router } from "express";
import { stmts } from "../db/index.js";
import { authMiddleware } from "../middleware/auth.js";
import { clearUserDocuments, seedUserDefaults } from "../db/seedDefaults.js";

export default function documentRoutes() {
  const router = Router();

  // Lista todos os documentos do usuario
  router.get("/api/documents", authMiddleware, (req, res) => {
    try {
      const docs = stmts.getAllDocs.all(req.user.id);
      const documents = {};
      for (const doc of docs) {
        documents[doc.doc_key] = doc.content;
      }
      res.json({ documents });
    } catch (error) {
      console.error("[Documents Error][GET all]", error);
      res.status(500).json({ error: "Erro ao buscar documentos" });
    }
  });

  // Limpa todos os documentos do usuario (reset)
  router.post("/api/documents/reset", authMiddleware, (req, res) => {
    try {
      clearUserDocuments(req.user.id);
      res.json({ ok: true });
    } catch (error) {
      console.error("[Documents Error][reset]", error);
      res.status(500).json({ error: "Erro ao limpar documentos" });
    }
  });

  // Restaura dados padrao (Renata)
  router.post("/api/documents/restore", authMiddleware, (req, res) => {
    try {
      seedUserDefaults(req.user.id);
      res.json({ ok: true });
    } catch (error) {
      console.error("[Documents Error][restore]", error);
      res.status(500).json({ error: "Erro ao restaurar documentos" });
    }
  });

  // Busca um documento por chave
  router.get("/api/documents/:key", authMiddleware, (req, res) => {
    try {
      const doc = stmts.getDoc.get(req.user.id, req.params.key);
      if (!doc) {
        return res.status(404).json({ error: "Documento nao encontrado" });
      }
      res.json({
        key: doc.doc_key,
        content: doc.content,
        updatedAt: doc.updated_at,
      });
    } catch (error) {
      console.error("[Documents Error][GET one]", error);
      res.status(500).json({ error: "Erro ao buscar documento" });
    }
  });

  // Atualiza/cria um documento
  router.put("/api/documents/:key", authMiddleware, (req, res) => {
    try {
      const { content } = req.body;
      if (content === undefined || content === null) {
        return res.status(400).json({ error: "Campo 'content' e obrigatorio" });
      }

      const now = new Date().toISOString();
      stmts.upsertDoc.run(req.user.id, req.params.key, content, now);

      res.json({
        key: req.params.key,
        content,
        updatedAt: now,
      });
    } catch (error) {
      console.error("[Documents Error][PUT one]", error);
      res.status(500).json({ error: "Erro ao salvar documento" });
    }
  });

  // Batch upsert de multiplos documentos
  router.put("/api/documents", authMiddleware, (req, res) => {
    try {
      const docs = req.body;
      if (!Array.isArray(docs)) {
        return res.status(400).json({ error: "Body deve ser um array de {key, content}" });
      }

      const now = new Date().toISOString();
      const results = [];

      for (const { key, content } of docs) {
        if (!key || content === undefined || content === null) {
          continue;
        }
        stmts.upsertDoc.run(req.user.id, key, content, now);
        results.push({ key, updatedAt: now });
      }

      res.json({ ok: true, updated: results.length, results });
    } catch (error) {
      console.error("[Documents Error][PUT batch]", error);
      res.status(500).json({ error: "Erro ao salvar documentos" });
    }
  });

  return router;
}
