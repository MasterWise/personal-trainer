import { Router } from "express";
import { firebaseAuthMiddleware } from "../middleware/firebaseAuth.js";
import { createFirebaseClaudeRateLimit } from "../firebase/rateLimit.js";
import { buildGatewayPayload } from "../firebase/payload.js";
import { enqueueClaudeTask } from "../firebase/tasks.js";
import { firebaseAiLogsRepository, firebasePendingRepository } from "../firebase/repositories.js";

export default function firebaseClaudeRoutes() {
  const router = Router();
  const claudeRateLimit = createFirebaseClaudeRateLimit();

  router.post("/api/claude", firebaseAuthMiddleware, claudeRateLimit, async (req, res) => {
    try {
      const { messages, _sessionId, conversationId } = req.body;
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Campo "messages" e obrigatorio e deve ser um array' });
      }
      if (messages.length > 100) {
        return res.status(400).json({ error: "Limite de 100 mensagens por request" });
      }

      const gatewayPayload = buildGatewayPayload(req.body);
      const pending = await firebasePendingRepository.createQueued(req.user.uid, {
        messages,
        conversationId,
        cliSessionId: _sessionId || null,
        requestPayload: { body: req.body, gatewayPayload },
      });

      let task = { mode: "disabled", taskName: null };
      try {
        task = await enqueueClaudeTask({ uid: req.user.uid, responseId: pending.responseId });
      } catch (error) {
        await firebasePendingRepository.fail(req.user.uid, pending.responseId, { error: error.message });
        throw error;
      }

      return res.status(202).json({
        responseId: pending.responseId,
        _responseId: pending.responseId,
        status: "queued",
        taskMode: task.mode,
      });
    } catch (error) {
      console.error("[Firebase Claude][POST]", error);
      res.status(500).json({ error: "Erro ao enfileirar resposta da IA", message: error.message });
    }
  });

  router.get("/api/ai-logs", firebaseAuthMiddleware, async (req, res) => {
    try {
      const limit = Number.parseInt(req.query.limit, 10) || 50;
      res.json(await firebaseAiLogsRepository.list(req.user.uid, limit));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get("/api/ai-logs/:id", firebaseAuthMiddleware, async (req, res) => {
    try {
      const log = await firebaseAiLogsRepository.get(req.user.uid, req.params.id);
      if (!log) return res.status(404).json({ error: "Log nao encontrado" });
      res.json(log);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.delete("/api/ai-logs", firebaseAuthMiddleware, async (req, res) => {
    try {
      await firebaseAiLogsRepository.deleteAll(req.user.uid);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get("/api/claude/pending", firebaseAuthMiddleware, async (req, res) => {
    try {
      res.json({ items: await firebasePendingRepository.list(req.user.uid) });
    } catch (error) {
      console.error("[Firebase Pending][GET]", error);
      res.status(500).json({ error: "Erro ao buscar respostas pendentes" });
    }
  });

  router.get("/api/claude/pending/:id", firebaseAuthMiddleware, async (req, res) => {
    try {
      const row = await firebasePendingRepository.get(req.user.uid, req.params.id);
      if (!row) return res.status(404).json({ error: "Resposta pendente nao encontrada" });
      res.json(row);
    } catch (error) {
      console.error("[Firebase Pending][GET :id]", error);
      res.status(500).json({ error: error.message });
    }
  });

  router.post("/api/claude/pending/:id/ack", firebaseAuthMiddleware, async (req, res) => {
    try {
      const status = await firebasePendingRepository.ack(req.user.uid, req.params.id);
      if (!status) return res.status(404).json({ error: "Nao encontrado" });
      res.json({ ok: true, status });
    } catch (error) {
      console.error("[Firebase Pending][POST ack]", error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
