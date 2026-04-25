import { Router } from "express";
import { firebaseAuthMiddleware } from "../middleware/firebaseAuth.js";
import { firebaseDocumentsRepository } from "../firebase/repositories.js";

const VALID_DOC_KEY = /^[a-z0-9_-]{1,50}$/;

export default function firebaseDocumentRoutes() {
  const router = Router();

  router.get("/api/documents", firebaseAuthMiddleware, async (req, res) => {
    try {
      res.json({ documents: await firebaseDocumentsRepository.list(req.user.uid) });
    } catch (error) {
      console.error("[Firebase Documents][GET all]", error);
      res.status(500).json({ error: "Erro ao buscar documentos" });
    }
  });

  router.post("/api/documents/reset", firebaseAuthMiddleware, async (req, res) => {
    try {
      await firebaseDocumentsRepository.reset(req.user.uid);
      res.json({ ok: true, currentConversationCleared: true });
    } catch (error) {
      console.error("[Firebase Documents][reset]", error);
      res.status(500).json({ error: "Erro ao limpar documentos" });
    }
  });

  router.post("/api/documents/restore", firebaseAuthMiddleware, async (req, res) => {
    try {
      await firebaseDocumentsRepository.restore(req.user.uid);
      res.json({ ok: true, currentConversationCleared: true });
    } catch (error) {
      console.error("[Firebase Documents][restore]", error);
      res.status(500).json({ error: "Erro ao restaurar documentos" });
    }
  });

  router.get("/api/documents/:key", firebaseAuthMiddleware, async (req, res) => {
    if (!VALID_DOC_KEY.test(req.params.key)) return res.status(400).json({ error: "doc_key invalido" });
    try {
      const doc = await firebaseDocumentsRepository.get(req.user.uid, req.params.key);
      if (!doc) return res.status(404).json({ error: "Documento nao encontrado" });
      res.json({ key: doc.key, content: doc.content, updatedAt: doc.updatedAt });
    } catch (error) {
      console.error("[Firebase Documents][GET one]", error);
      res.status(500).json({ error: "Erro ao buscar documento" });
    }
  });

  router.put("/api/documents/:key", firebaseAuthMiddleware, async (req, res) => {
    if (!VALID_DOC_KEY.test(req.params.key)) return res.status(400).json({ error: "doc_key invalido" });
    try {
      const { content } = req.body;
      if (content === undefined || content === null) {
        return res.status(400).json({ error: "Campo 'content' e obrigatorio" });
      }
      res.json(await firebaseDocumentsRepository.upsert(req.user.uid, req.params.key, content));
    } catch (error) {
      console.error("[Firebase Documents][PUT one]", error);
      res.status(500).json({ error: "Erro ao salvar documento" });
    }
  });

  router.put("/api/documents", firebaseAuthMiddleware, async (req, res) => {
    try {
      const docs = req.body;
      if (!Array.isArray(docs)) return res.status(400).json({ error: "Body deve ser um array de {key, content}" });
      const validated = docs.filter(({ key, content }) => VALID_DOC_KEY.test(String(key || "")) && content !== undefined && content !== null);
      if (validated.length === 0) return res.status(400).json({ error: "Nenhum documento valido enviado" });
      const results = await firebaseDocumentsRepository.upsertMany(req.user.uid, validated);
      res.json({ ok: true, updated: results.length, results });
    } catch (error) {
      console.error("[Firebase Documents][PUT batch]", error);
      res.status(500).json({ error: "Erro ao salvar documentos" });
    }
  });

  return router;
}
