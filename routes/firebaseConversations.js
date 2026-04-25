import { Router } from "express";
import { firebaseAuthMiddleware } from "../middleware/firebaseAuth.js";
import { firebaseConversationsRepository } from "../firebase/repositories.js";

const PLAN_DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/;

function normalizePlanDate(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return PLAN_DATE_RE.test(trimmed) ? trimmed : null;
}

function handleRouteError(res, label, error) {
  console.error(label, error);
  res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : "Erro ao processar conversa" });
}

export default function firebaseConversationRoutes() {
  const router = Router();

  router.get("/api/conversations", firebaseAuthMiddleware, async (req, res) => {
    try {
      res.json(await firebaseConversationsRepository.listArchived(req.user.uid));
    } catch (error) {
      handleRouteError(res, "[Firebase Conversations][GET list]", error);
    }
  });

  router.get("/api/conversations/current", firebaseAuthMiddleware, async (req, res) => {
    try {
      const current = await firebaseConversationsRepository.getCurrent(req.user.uid);
      if (!current) {
        return res.json({
          id: null,
          messages: [],
          type: "general",
          planDate: null,
          planVersion: null,
          planThreadKey: null,
          originAction: null,
          isLatestPlanVersion: true,
        });
      }

      const latestPlan = current.type === "plan" && current.planDate
        ? await firebaseConversationsRepository.getLatestPlan(req.user.uid, current.planDate)
        : null;
      const isLatestPlanVersion = current.type === "plan" ? latestPlan?.id === current.id : true;
      res.json({ ...current, isLatestPlanVersion });
    } catch (error) {
      handleRouteError(res, "[Firebase Conversations][GET current]", error);
    }
  });

  router.put("/api/conversations/current", firebaseAuthMiddleware, async (req, res) => {
    try {
      const { conversationId, messages, meta, cliSessionId } = req.body || {};
      if (!Array.isArray(messages)) {
        return res.status(400).json({ error: "Campo 'messages' deve ser um array" });
      }
      const saved = await firebaseConversationsRepository.saveCurrent(req.user.uid, {
        conversationId,
        messages,
        meta,
        cliSessionId,
      });
      res.json({
        ok: true,
        id: saved.id,
        type: saved.type,
        planDate: saved.planDate,
        planVersion: saved.planVersion,
        planThreadKey: saved.planThreadKey,
        originAction: saved.originAction,
      });
    } catch (error) {
      handleRouteError(res, "[Firebase Conversations][PUT current]", error);
    }
  });

  router.post("/api/conversations/archive", firebaseAuthMiddleware, async (req, res) => {
    try {
      const archivedId = await firebaseConversationsRepository.archiveCurrent(req.user.uid);
      if (!archivedId) return res.status(404).json({ error: "Nenhuma conversa atual para arquivar" });
      res.json({ ok: true, archivedId });
    } catch (error) {
      handleRouteError(res, "[Firebase Conversations][POST archive]", error);
    }
  });

  router.post("/api/conversations/activate", firebaseAuthMiddleware, async (req, res) => {
    try {
      const convoId = String(req.body?.id || "").trim();
      if (!convoId) return res.status(400).json({ error: "Campo 'id' e obrigatorio" });
      const conversation = await firebaseConversationsRepository.activate(req.user.uid, convoId);
      if (!conversation) return res.status(404).json({ error: "Conversa nao encontrada" });
      const latestPlan = conversation.type === "plan" && conversation.planDate
        ? await firebaseConversationsRepository.getLatestPlan(req.user.uid, conversation.planDate)
        : null;
      res.json({
        ok: true,
        conversation,
        isLatestPlanVersion: conversation.type === "plan" ? latestPlan?.id === conversation.id : true,
      });
    } catch (error) {
      handleRouteError(res, "[Firebase Conversations][POST activate]", error);
    }
  });

  router.post("/api/conversations/plan/start", firebaseAuthMiddleware, async (req, res) => {
    try {
      const conversation = await firebaseConversationsRepository.startPlan(req.user.uid, {
        planDate: req.body?.planDate,
        mode: String(req.body?.mode || "").trim(),
      });
      res.json({ ok: true, conversation });
    } catch (error) {
      handleRouteError(res, "[Firebase Conversations][POST plan/start]", error);
    }
  });

  router.get("/api/conversations/plan/latest", firebaseAuthMiddleware, async (req, res) => {
    try {
      const planDate = normalizePlanDate(req.query?.date);
      if (!planDate) return res.status(400).json({ error: "Parametro 'date' invalido (use DD/MM/YYYY)" });
      const conversation = await firebaseConversationsRepository.getLatestPlan(req.user.uid, planDate);
      if (!conversation) return res.json({ exists: false });
      res.json({ exists: true, conversation, isLatestPlanVersion: true });
    } catch (error) {
      handleRouteError(res, "[Firebase Conversations][GET plan/latest]", error);
    }
  });

  router.get("/api/conversations/plan/history", firebaseAuthMiddleware, async (req, res) => {
    try {
      const planDate = normalizePlanDate(req.query?.date);
      if (!planDate) return res.status(400).json({ error: "Parametro 'date' invalido (use DD/MM/YYYY)" });
      const items = await firebaseConversationsRepository.listPlanHistory(req.user.uid, planDate);
      const latestId = items[0]?.id || null;
      res.json({
        planDate,
        items: items.map((item) => ({ ...item, messages: undefined, isLatestVersion: item.id === latestId })),
      });
    } catch (error) {
      handleRouteError(res, "[Firebase Conversations][GET plan/history]", error);
    }
  });

  router.delete("/api/conversations/:id", firebaseAuthMiddleware, async (req, res) => {
    try {
      const deleted = await firebaseConversationsRepository.delete(req.user.uid, req.params.id);
      if (!deleted) return res.status(404).json({ error: "Conversa nao encontrada" });
      res.json({ ok: true });
    } catch (error) {
      handleRouteError(res, "[Firebase Conversations][DELETE]", error);
    }
  });

  return router;
}
