import { Router } from "express";
import crypto from "crypto";
import { authMiddleware } from "../middleware/auth.js";
import { createClaudeRateLimit } from "../middleware/security.js";
import { stmts } from "../db/index.js";

const AI_GATEWAY_URL = process.env.AI_GATEWAY_URL || "http://localhost:3500";
const AI_MODEL = process.env.AI_MODEL || "claude-cli-sonnet";
const REASONING_EFFORT = process.env.REASONING_EFFORT || "low";
const MAX_INPUT_TOKENS = parseInt(process.env.MAX_INPUT_TOKENS || "0", 10) || null;
const MAX_OUTPUT_TOKENS = parseInt(process.env.MAX_OUTPUT_TOKENS || "0", 10) || null;
const ALLOW_DEBUG_AI_LOGS = process.env.ALLOW_DEBUG_AI_LOGS === "true";

const REDACT_KEYS = new Set(["password", "authorization", "Authorization", "_sessionId", "secret", "token", "api_key", "apiKey", "cookie"]);

function redactSensitive(value) {
  return JSON.stringify(value, (key, current) => {
    if (REDACT_KEYS.has(key)) {
      return "[REDACTED]";
    }
    return current;
  });
}

export default function claudeRoutes() {
  const router = Router();
  const claudeRateLimit = createClaudeRateLimit();

  router.post("/api/claude", authMiddleware, claudeRateLimit, async (req, res) => {
    const startTime = Date.now();
    const debugMode = req.headers["x-debug-log"] === "true";
    const allowDetailedDebug = debugMode && (process.env.NODE_ENV !== "production" || ALLOW_DEBUG_AI_LOGS);

    try {
      const { system, messages, output_config, _sessionId, interaction_context, conversationId } = req.body;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Campo "messages" e obrigatorio e deve ser um array' });
      }
      if (messages.length > 100) {
        return res.status(400).json({ error: "Limite de 100 mensagens por request" });
      }

      // Build gateway payload
      const gatewayPayload = {
        app: "personal-trainer",
        model: AI_MODEL,
        system,
        messages,
      };
      if (_sessionId) gatewayPayload._sessionId = _sessionId;
      if (interaction_context) gatewayPayload.interaction_context = interaction_context;

      // Extract output_schema from output_config (frontend sends output_config format)
      if (output_config?.format?.schema) {
        gatewayPayload.output_schema = output_config.format.schema;
      }

      // Override gateway app defaults with env vars (request > app config in cascade)
      if (REASONING_EFFORT) gatewayPayload.effort = REASONING_EFFORT;
      if (MAX_INPUT_TOKENS) gatewayPayload.max_input_tokens = MAX_INPUT_TOKENS;
      if (MAX_OUTPUT_TOKENS) gatewayPayload.max_output_tokens = MAX_OUTPUT_TOKENS;

      const GATEWAY_TIMEOUT_MS = parseInt(process.env.GATEWAY_TIMEOUT_MS || "500000", 10);

      // ── Response Inbox: register in-flight request BEFORE calling gateway ──
      // This lets the frontend know a response is being generated (survives page refresh)
      const inFlightId = crypto.randomUUID();
      const inFlightNow = new Date();
      const lastUserMsg = [...messages].reverse().find(m => m?.role === "user");
      try {
        stmts.insertPendingResponse.run(
          inFlightId, req.user.id, conversationId || null, _sessionId || null,
          lastUserMsg ? JSON.stringify(lastUserMsg) : null,
          '{}', null, null, 'in_flight',
          inFlightNow.toISOString(),
          new Date(inFlightNow.getTime() + 86400000).toISOString()
        );
      } catch (e) {
        console.error("[InFlight Save Error]", e);
      }

      let response = await fetch(`${AI_GATEWAY_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gatewayPayload),
        signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
      });

      // CLI session expired (gateway restarted or TTL eviction): retry as first turn.
      // Keep _sessionId so the new session is stored under the original key (next turn
      // finds it → isResume=true). Add _sessionExpiredRetry to bypass expiry check.
      if (response.status === 410 && !gatewayPayload._sessionExpiredRetry) {
        const errData = await response.json().catch(() => ({}));
        if (errData?.code === "CLI_SESSION_EXPIRED") {
          console.warn("[claude] CLI session expired, retrying as first turn");
          delete gatewayPayload.interaction_context;
          gatewayPayload._sessionExpiredRetry = true;
          await new Promise(r => setTimeout(r, 500));
          response = await fetch(`${AI_GATEWAY_URL}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(gatewayPayload),
            signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
          });
        }
      }

      const durationMs = Date.now() - startTime;
      const data = await response.json();

      if (!response.ok) {
        // Log error if debug mode
        if (allowDetailedDebug && req.user?.id) {
          try {
            stmts.insertAiLog.run(
              crypto.randomUUID(), req.user.id, new Date().toISOString(),
              system || null, system?.length || 0,
              redactSensitive(messages),
              messages.length,
              null, 0, null,
              redactSensitive(data), null, null, null, 0,
              null, null, null, durationMs,
              0, data.error || `HTTP ${response.status}`,
              redactSensitive(gatewayPayload)
            );
          } catch (e) { console.error("[Debug Log Error]", e); }
        }

        // Mark in-flight as failed for gateway errors
        try {
          stmts.failPendingResponse.run(
            JSON.stringify(data), new Date().toISOString(),
            inFlightId, req.user.id
          );
        } catch { /* ignore */ }

        return res.status(response.status).json(data);
      }

      // Log success if debug mode
      if (allowDetailedDebug && req.user?.id) {
        try {
          let replyText = null;
          let updatesJson = null;
          let updatesCount = 0;

          // Try to parse structured response for logging
          const content = Array.isArray(data?.content) ? data.content : [];
          const outputJsonBlock = content.find(b => b?.type === "output_json");
          const textBlock = content.find(b => b?.type === "text")?.text;

          if (outputJsonBlock) {
            const json = outputJsonBlock.json;
            if (json && typeof json === "object") {
              replyText = json.reply || null;
              updatesJson = JSON.stringify(json.updates || []);
              updatesCount = (json.updates || []).length;
            }
          } else if (textBlock) {
            try {
              const parsed = JSON.parse(textBlock);
              replyText = parsed.reply || null;
              updatesJson = JSON.stringify(parsed.updates || []);
              updatesCount = (parsed.updates || []).length;
            } catch { /* structured parse failed */ }
          }

          const usage = data.usage || {};
          const thinkingEnabled = data.content?.some(b => b?.type === "thinking") ? 1 : 0;

          stmts.insertAiLog.run(
            crypto.randomUUID(), req.user.id, new Date().toISOString(),
            system || null, system?.length || 0,
            redactSensitive(messages),
            messages.length,
            data.model || null, thinkingEnabled, null,
            redactSensitive(data), data.id || null,
            replyText, updatesJson, updatesCount,
            usage.input_tokens || null, usage.output_tokens || null,
            (usage.input_tokens || 0) + (usage.output_tokens || 0), durationMs,
            1, null,
            redactSensitive(gatewayPayload)
          );
        } catch (e) { console.error("[Debug Log Error]", e); }
      }

      // ── Response Inbox: complete in_flight → pending with actual response ──
      try {
        let pendingReplyText = null;
        let pendingUpdatesJson = null;
        const pendingContent = Array.isArray(data?.content) ? data.content : [];
        const pendingOutputJson = pendingContent.find(b => b?.type === "output_json");
        const pendingTextBlock = pendingContent.find(b => b?.type === "text")?.text;
        if (pendingOutputJson?.json) {
          pendingReplyText = pendingOutputJson.json.reply || null;
          pendingUpdatesJson = JSON.stringify(pendingOutputJson.json.updates || []);
        } else if (pendingTextBlock) {
          try {
            const parsedText = JSON.parse(pendingTextBlock);
            pendingReplyText = parsedText.reply || null;
            pendingUpdatesJson = JSON.stringify(parsedText.updates || []);
          } catch { /* not structured JSON */ }
        }

        stmts.completePendingResponse.run(
          JSON.stringify(data), pendingReplyText, pendingUpdatesJson,
          inFlightId, req.user.id
        );
      } catch (e) {
        console.error("[Pending Complete Error]", e);
      }

      res.json({ ...data, _responseId: inFlightId });
    } catch (error) {
      console.error("[Server Error]", error);

      if (allowDetailedDebug && req.user?.id) {
        try {
          stmts.insertAiLog.run(
            crypto.randomUUID(), req.user.id, new Date().toISOString(),
            null, 0, null, 0,
            null, 0, null,
            null, null, null, null, 0,
            null, null, null, Date.now() - startTime,
            0, error.message,
            null
          );
        } catch (e) { console.error("[Debug Log Error]", e); }
      }

      // Mark in-flight request as failed so frontend stops showing loading
      try {
        stmts.failPendingResponse.run(
          JSON.stringify({ error: error.message }),
          new Date().toISOString(),
          inFlightId, req.user.id
        );
      } catch { /* ignore cleanup error */ }

      // Timeout from AbortSignal.timeout()
      if (error?.name === "TimeoutError" || error?.name === "AbortError") {
        return res.status(504).json({
          error: "Timeout ao aguardar resposta do AI Gateway",
          message: error.message,
        });
      }

      // Network errors (connection refused, DNS failure, etc.)
      if (error?.cause?.code === "ECONNREFUSED" || error?.cause?.code === "ENOTFOUND" ||
          (error?.name === "TypeError" && error?.message?.includes("fetch"))) {
        return res.status(502).json({
          error: "AI Gateway indisponivel",
          message: error.message,
        });
      }

      res.status(500).json({
        error: "Erro interno do servidor",
        message: error.message,
      });
    }
  });

  // --- AI Logs routes ---

  router.get("/api/ai-logs", authMiddleware, (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const logs = stmts.listAiLogs.all(req.user.id, Math.min(limit, 200));
      res.json(logs);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get("/api/ai-logs/:id", authMiddleware, (req, res) => {
    try {
      const log = stmts.getAiLog.get(req.params.id, req.user.id);
      if (!log) return res.status(404).json({ error: "Log não encontrado" });
      res.json(log);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.delete("/api/ai-logs", authMiddleware, (req, res) => {
    try {
      stmts.deleteAiLogs.run(req.user.id);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- Response Inbox routes ---

  router.get("/api/claude/pending", authMiddleware, (req, res) => {
    try {
      // Piggyback cleanup of expired processed entries
      try { stmts.cleanupExpiredPending.run(new Date().toISOString()); } catch { /* ignore */ }

      const rows = stmts.listPendingByUser.all(req.user.id);
      res.json({ items: rows });
    } catch (e) {
      console.error("[Pending Error][GET]", e);
      res.status(500).json({ error: "Erro ao buscar respostas pendentes" });
    }
  });

  router.get("/api/claude/pending/:id", authMiddleware, (req, res) => {
    try {
      const row = stmts.getPendingById.get(req.params.id, req.user.id);
      if (!row) return res.status(404).json({ error: "Resposta pendente nao encontrada" });
      res.json(row);
    } catch (e) {
      console.error("[Pending Error][GET :id]", e);
      res.status(500).json({ error: e.message });
    }
  });

  router.post("/api/claude/pending/:id/ack", authMiddleware, (req, res) => {
    try {
      const result = stmts.ackPendingResponse.run(
        new Date().toISOString(),
        req.params.id,
        req.user.id
      );
      if (result.changes === 0) {
        // Already processed or not found — idempotent
        const existing = stmts.getPendingById.get(req.params.id, req.user.id);
        if (!existing) return res.status(404).json({ error: "Nao encontrado" });
        return res.json({ ok: true, status: existing.status });
      }
      res.json({ ok: true, status: "processed" });
    } catch (e) {
      console.error("[Pending Error][POST ack]", e);
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}
