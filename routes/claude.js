import { Router } from "express";
import crypto from "crypto";
import { authMiddleware } from "../middleware/auth.js";
import { createClaudeRateLimit } from "../middleware/security.js";
import { stmts } from "../db/index.js";

const AI_GATEWAY_URL = process.env.AI_GATEWAY_URL || "http://localhost:3500";
const REASONING_EFFORT = process.env.REASONING_EFFORT || null;
const MAX_INPUT_TOKENS = parseInt(process.env.MAX_INPUT_TOKENS || "0", 10) || null;
const MAX_OUTPUT_TOKENS = parseInt(process.env.MAX_OUTPUT_TOKENS || "0", 10) || null;

export default function claudeRoutes() {
  const router = Router();
  const claudeRateLimit = createClaudeRateLimit();

  router.post("/api/claude", authMiddleware, claudeRateLimit, async (req, res) => {
    const startTime = Date.now();
    const debugMode = req.headers["x-debug-log"] === "true";

    try {
      const { system, messages, output_config, _sessionId, _light_context } = req.body;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Campo "messages" e obrigatorio e deve ser um array' });
      }

      // Build gateway payload
      const gatewayPayload = {
        app: "personal-trainer",
        system,
        messages,
      };
      if (_sessionId) gatewayPayload._sessionId = _sessionId;
      if (_light_context) gatewayPayload._light_context = _light_context;

      // Extract output_schema from output_config (frontend sends output_config format)
      if (output_config?.format?.schema) {
        gatewayPayload.output_schema = output_config.format.schema;
      }

      // Override gateway app defaults with env vars (request > app config in cascade)
      if (REASONING_EFFORT) gatewayPayload.effort = REASONING_EFFORT;
      if (MAX_INPUT_TOKENS) gatewayPayload.max_input_tokens = MAX_INPUT_TOKENS;
      if (MAX_OUTPUT_TOKENS) gatewayPayload.max_tokens = MAX_OUTPUT_TOKENS;

      const GATEWAY_TIMEOUT_MS = parseInt(process.env.GATEWAY_TIMEOUT_MS || "180000", 10);

      let response = await fetch(`${AI_GATEWAY_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gatewayPayload),
        signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
      });

      // CLI session expired (gateway restarted or TTL eviction): retry without session.
      if (response.status === 410) {
        const errData = await response.json().catch(() => ({}));
        if (errData?.code === "CLI_SESSION_EXPIRED") {
          console.warn("[claude] CLI session expired, retrying without session");
          delete gatewayPayload._sessionId;
          delete gatewayPayload._light_context;
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
        if (debugMode && req.user?.id) {
          try {
            stmts.insertAiLog.run(
              crypto.randomUUID(), req.user.id, new Date().toISOString(),
              system || null, system?.length || 0,
              JSON.stringify(messages.map(m => ({ role: m.role, content: typeof m.content === "string" ? m.content.slice(0, 500) : "[complex]" }))),
              messages.length,
              null, 0, null,
              JSON.stringify(data), null, null, null, 0,
              null, null, null, durationMs,
              0, data.error || `HTTP ${response.status}`
            );
          } catch (e) { console.error("[Debug Log Error]", e); }
        }

        return res.status(response.status).json(data);
      }

      // Log success if debug mode
      if (debugMode && req.user?.id) {
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
            JSON.stringify(messages),
            messages.length,
            data.model || null, thinkingEnabled, null,
            JSON.stringify(data), data.id || null,
            replyText, updatesJson, updatesCount,
            usage.input_tokens || null, usage.output_tokens || null,
            (usage.input_tokens || 0) + (usage.output_tokens || 0), durationMs,
            1, null
          );
        } catch (e) { console.error("[Debug Log Error]", e); }
      }

      res.json(data);
    } catch (error) {
      console.error("[Server Error]", error);

      if (debugMode && req.user?.id) {
        try {
          stmts.insertAiLog.run(
            crypto.randomUUID(), req.user.id, new Date().toISOString(),
            null, 0, null, 0,
            null, 0, null,
            null, null, null, null, 0,
            null, null, null, Date.now() - startTime,
            0, error.message
          );
        } catch (e) { console.error("[Debug Log Error]", e); }
      }

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

  return router;
}
