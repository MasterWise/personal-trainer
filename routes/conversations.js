import { Router } from "express";
import { stmts } from "../db/index.js";
import { authMiddleware, generateId } from "../middleware/auth.js";

const PLAN_DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/;
const PLAN_START_MODES = new Set(["generate", "new_plan", "edit"]);

function normalizeConvoType(value) {
  return value === "plan" ? "plan" : "general";
}

function normalizePlanDate(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return PLAN_DATE_RE.test(trimmed) ? trimmed : null;
}

function normalizePlanVersion(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function getMessageText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === "string") return block;
        if (block?.type === "text") return String(block.text || "");
        if (block && typeof block === "object" && "text" in block) return String(block.text || "");
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  if (content == null) return "";
  return String(content);
}

function buildPreview(messages) {
  const firstUserMsg = (Array.isArray(messages) ? messages : []).find((m) => m?.role === "user");
  return getMessageText(firstUserMsg?.content).slice(0, 120);
}

function parseMessages(rawMessages) {
  if (!rawMessages) return [];
  try {
    const parsed = JSON.parse(rawMessages);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function serializeConversation(row, { includeMessages = true } = {}) {
  if (!row) return null;
  const payload = {
    id: row.id,
    preview: row.preview || "",
    messageCount: row.message_count || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at || null,
    isCurrent: !!row.is_current,
    type: normalizeConvoType(row.conversation_type),
    planDate: row.plan_date || null,
    planVersion: row.plan_version ?? null,
    planThreadKey: row.plan_thread_key || null,
    originAction: row.origin_action || null,
  };

  if (includeMessages) {
    payload.messages = parseMessages(row.messages);
  }

  return payload;
}

function saveConversationCurrent({
  convoId,
  userId,
  messages,
  createdAt,
  type,
  planDate,
  planVersion,
  planThreadKey,
  originAction,
  now,
}) {
  stmts.saveCurrent.run(
    convoId,
    userId,
    JSON.stringify(messages),
    buildPreview(messages),
    messages.length,
    createdAt,
    type,
    planDate,
    planVersion,
    planThreadKey,
    originAction,
    now,
  );
}

function resolveMetaInput(metaInput, current) {
  const currentType = normalizeConvoType(current?.conversation_type);
  const type = normalizeConvoType(metaInput?.type ?? currentType);
  const planDate = type === "plan"
    ? normalizePlanDate(metaInput?.planDate ?? current?.plan_date)
    : null;
  const planVersion = type === "plan"
    ? normalizePlanVersion(metaInput?.planVersion ?? current?.plan_version)
    : null;
  const planThreadKey = type === "plan"
    ? String(metaInput?.planThreadKey ?? current?.plan_thread_key ?? "").trim() || null
    : null;
  const originAction = type === "plan"
    ? String(metaInput?.originAction ?? current?.origin_action ?? "").trim() || null
    : null;

  return { type, planDate, planVersion, planThreadKey, originAction };
}

function getLatestPlanRowFor(row, userId) {
  if (!row) return null;
  if (normalizeConvoType(row.conversation_type) !== "plan") return null;
  if (!row.plan_date) return null;
  return stmts.getLatestPlanConversationByDate.get(userId, row.plan_date);
}

export default function conversationRoutes() {
  const router = Router();

  // Lista conversas arquivadas (somente gerais; histórico de planos tem rota própria)
  router.get("/api/conversations", authMiddleware, (req, res) => {
    try {
      const convos = stmts.listArchived.all(req.user.id);
      res.json(convos.map((row) => serializeConversation(row)));
    } catch (error) {
      console.error("[Conversations Error][GET list]", error);
      res.status(500).json({ error: "Erro ao listar conversas" });
    }
  });

  // Busca conversa atual
  router.get("/api/conversations/current", authMiddleware, (req, res) => {
    try {
      const current = stmts.getCurrent.get(req.user.id);
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

      const latestPlan = getLatestPlanRowFor(current, req.user.id);
      const isLatestPlanVersion = normalizeConvoType(current.conversation_type) === "plan"
        ? !!latestPlan && latestPlan.id === current.id
        : true;

      res.json({
        ...serializeConversation(current),
        isLatestPlanVersion,
      });
    } catch (error) {
      console.error("[Conversations Error][GET current]", error);
      res.status(500).json({ error: "Erro ao buscar conversa atual" });
    }
  });

  // Salva conversa atual
  router.put("/api/conversations/current", authMiddleware, (req, res) => {
    try {
      const { messages, meta } = req.body || {};
      if (!Array.isArray(messages)) {
        return res.status(400).json({ error: "Campo 'messages' deve ser um array" });
      }

      const userId = req.user.id;
      const now = new Date().toISOString();
      const current = stmts.getCurrent.get(userId);
      const convoId = current ? current.id : generateId();
      const createdAt = current?.created_at || now;
      const resolvedMeta = resolveMetaInput(meta || {}, current);

      saveConversationCurrent({
        convoId,
        userId,
        messages,
        createdAt,
        type: resolvedMeta.type,
        planDate: resolvedMeta.planDate,
        planVersion: resolvedMeta.planVersion,
        planThreadKey: resolvedMeta.planThreadKey,
        originAction: resolvedMeta.originAction,
        now,
      });

      res.json({
        ok: true,
        id: convoId,
        type: resolvedMeta.type,
        planDate: resolvedMeta.planDate,
        planVersion: resolvedMeta.planVersion,
        planThreadKey: resolvedMeta.planThreadKey,
        originAction: resolvedMeta.originAction,
      });
    } catch (error) {
      console.error("[Conversations Error][PUT current]", error);
      res.status(500).json({ error: "Erro ao salvar conversa" });
    }
  });

  // Arquiva conversa atual
  router.post("/api/conversations/archive", authMiddleware, (req, res) => {
    try {
      const userId = req.user.id;
      const current = stmts.getCurrent.get(userId);

      if (!current) {
        return res.status(404).json({ error: "Nenhuma conversa atual para arquivar" });
      }

      stmts.archiveCurrent.run(userId);
      res.json({ ok: true, archivedId: current.id });
    } catch (error) {
      console.error("[Conversations Error][POST archive]", error);
      res.status(500).json({ error: "Erro ao arquivar conversa" });
    }
  });

  // Ativa uma conversa existente como atual
  router.post("/api/conversations/activate", authMiddleware, (req, res) => {
    try {
      const convoId = String(req.body?.id || "").trim();
      if (!convoId) {
        return res.status(400).json({ error: "Campo 'id' é obrigatório" });
      }

      const userId = req.user.id;
      const existing = stmts.getConversationById.get(convoId, userId);
      if (!existing) {
        return res.status(404).json({ error: "Conversa não encontrada" });
      }

      const now = new Date().toISOString();
      stmts.clearCurrentForUser.run(userId);
      const result = stmts.activateConversation.run(now, convoId, userId);
      if (result.changes === 0) {
        return res.status(404).json({ error: "Conversa não encontrada" });
      }

      const current = stmts.getConversationById.get(convoId, userId);
      const latestPlan = getLatestPlanRowFor(current, userId);
      const isLatestPlanVersion = !!current && normalizeConvoType(current.conversation_type) === "plan"
        ? !!latestPlan && latestPlan.id === current.id
        : true;

      res.json({
        ok: true,
        conversation: serializeConversation(current),
        isLatestPlanVersion,
      });
    } catch (error) {
      console.error("[Conversations Error][POST activate]", error);
      res.status(500).json({ error: "Erro ao ativar conversa" });
    }
  });

  // Inicia uma conversa de plano (v1 ou nova versão)
  router.post("/api/conversations/plan/start", authMiddleware, (req, res) => {
    try {
      const planDate = normalizePlanDate(req.body?.planDate);
      const mode = String(req.body?.mode || "").trim();

      if (!planDate) {
        return res.status(400).json({ error: "Campo 'planDate' inválido (use DD/MM/YYYY)" });
      }
      if (!PLAN_START_MODES.has(mode)) {
        return res.status(400).json({ error: "Campo 'mode' inválido" });
      }

      const userId = req.user.id;
      const latest = stmts.getLatestPlanConversationByDate.get(userId, planDate);

      if (mode === "generate" && latest) {
        return res.status(409).json({ error: "Já existe conversa de plano para esta data" });
      }

      const now = new Date().toISOString();
      const convoId = generateId();
      const nextVersion = latest?.plan_version ? Number(latest.plan_version) + 1 : 1;
      const planThreadKey = latest?.plan_thread_key || generateId();
      const originAction = mode === "generate"
        ? "generate_plan"
        : mode === "new_plan"
          ? "new_plan"
          : "edit_plan";

      stmts.clearCurrentForUser.run(userId);
      saveConversationCurrent({
        convoId,
        userId,
        messages: [],
        createdAt: now,
        type: "plan",
        planDate,
        planVersion: nextVersion,
        planThreadKey,
        originAction,
        now,
      });

      const created = stmts.getConversationById.get(convoId, userId);
      res.json({
        ok: true,
        conversation: serializeConversation(created),
      });
    } catch (error) {
      console.error("[Conversations Error][POST plan/start]", error);
      res.status(500).json({ error: "Erro ao iniciar conversa de plano" });
    }
  });

  // Retorna a última versão da conversa de plano de uma data
  router.get("/api/conversations/plan/latest", authMiddleware, (req, res) => {
    try {
      const planDate = normalizePlanDate(req.query?.date);
      if (!planDate) {
        return res.status(400).json({ error: "Parâmetro 'date' inválido (use DD/MM/YYYY)" });
      }

      const row = stmts.getLatestPlanConversationByDate.get(req.user.id, planDate);
      if (!row) {
        return res.json({ exists: false });
      }

      res.json({
        exists: true,
        conversation: serializeConversation(row),
        isLatestPlanVersion: true,
      });
    } catch (error) {
      console.error("[Conversations Error][GET plan/latest]", error);
      res.status(500).json({ error: "Erro ao buscar última conversa de plano" });
    }
  });

  // Histórico de versões de plano por data
  router.get("/api/conversations/plan/history", authMiddleware, (req, res) => {
    try {
      const planDate = normalizePlanDate(req.query?.date);
      if (!planDate) {
        return res.status(400).json({ error: "Parâmetro 'date' inválido (use DD/MM/YYYY)" });
      }

      const rows = stmts.listPlanHistoryByDate.all(req.user.id, planDate);
      const latestId = rows[0]?.id || null;

      res.json({
        planDate,
        items: rows.map((row) => ({
          ...serializeConversation(row, { includeMessages: false }),
          isLatestVersion: row.id === latestId,
        })),
      });
    } catch (error) {
      console.error("[Conversations Error][GET plan/history]", error);
      res.status(500).json({ error: "Erro ao listar histórico de planos" });
    }
  });

  // Deleta conversa arquivada (ou versão de plano não atual)
  router.delete("/api/conversations/:id", authMiddleware, (req, res) => {
    try {
      const result = stmts.deleteConvo.run(req.params.id, req.user.id);
      if (result.changes === 0) {
        return res.status(404).json({ error: "Conversa nao encontrada" });
      }
      res.json({ ok: true });
    } catch (error) {
      console.error("[Conversations Error][DELETE]", error);
      res.status(500).json({ error: "Erro ao deletar conversa" });
    }
  });

  return router;
}
