import { Router } from "express";
import crypto from "crypto";
import { authMiddleware } from "../middleware/auth.js";
import { createClaudeRateLimit } from "../middleware/security.js";
import { stmts } from "../db/index.js";

export default function claudeRoutes() {
  const router = Router();
  const claudeRateLimit = createClaudeRateLimit();

  router.post("/api/claude", authMiddleware, claudeRateLimit, async (req, res) => {
    const startTime = Date.now();
    const debugMode = req.headers["x-debug-log"] === "true";

    // Read all Claude configuration from env vars
    const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
    const CLAUDE_MAX_OUTPUT_TOKENS = parseInt(process.env.CLAUDE_MAX_OUTPUT_TOKENS || "64000", 10);
    const CLAUDE_THINKING_TYPE = process.env.CLAUDE_THINKING_TYPE || "adaptive"; // "adaptive" | "disabled"
    const CLAUDE_EFFORT = process.env.CLAUDE_EFFORT || "high";               // "low" | "medium" | "high"

    try {
      const apiKey = process.env.ANTHROPIC_API_KEY;

      if (!apiKey) {
        return res.status(500).json({
          error: "API key da Anthropic nao configurada. Configure ANTHROPIC_API_KEY no arquivo .env"
        });
      }

      const { model, max_tokens, system, messages, output_config } = req.body;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Campo "messages" e obrigatorio e deve ser um array' });
      }

      // Build the thinking config using modern adaptive thinking for Sonnet 4.6
      // budget_tokens is deprecated on Sonnet 4.6 — use type: "adaptive" + effort instead
      const thinkingConfig = CLAUDE_THINKING_TYPE === "adaptive"
        ? { type: "adaptive" }
        : null;

      // Build effort config (merged into output_config)
      const baseOutputConfig = output_config || {};
      const finalOutputConfig = CLAUDE_THINKING_TYPE === "adaptive"
        ? { ...baseOutputConfig, effort: CLAUDE_EFFORT }
        : baseOutputConfig;

      const payload = {
        model: model || CLAUDE_MODEL,
        max_tokens: max_tokens || CLAUDE_MAX_OUTPUT_TOKENS,
        messages,
      };

      if (system) payload.system = system;
      if (thinkingConfig) payload.thinking = thinkingConfig;
      if (Object.keys(finalOutputConfig).length > 0) payload.output_config = finalOutputConfig;

      console.log(`[${new Date().toISOString()}] Chamada a API Claude:`, {
        model: payload.model,
        max_tokens: payload.max_tokens,
        thinking: CLAUDE_THINKING_TYPE,
        effort: CLAUDE_THINKING_TYPE === "adaptive" ? CLAUDE_EFFORT : "n/a",
        systemLength: system?.length || 0,
        messagesCount: messages.length,
        structuredOutput: !!output_config,
        debugLog: debugMode,
      });


      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify(payload)
      });

      const durationMs = Date.now() - startTime;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("[API Error]", response.status, errorData);

        // Log error if debug mode
        if (debugMode && req.user && req.user.id) {
          try {
            stmts.insertAiLog.run(
              crypto.randomUUID(), req.user.id, new Date().toISOString(),
              system || null, system?.length || 0,
              JSON.stringify(messages.map(m => ({ role: m.role, content: typeof m.content === "string" ? m.content.slice(0, 500) : "[complex]" }))),
              messages.length,
              payload.model, thinking ? 1 : 0, thinking?.budget_tokens || null,
              JSON.stringify(errorData), null, null, null, 0,
              null, null, null, durationMs,
              0, errorData.error?.message || `HTTP ${response.status}`
            );
          } catch (e) { console.error("[Debug Log Error]", e); }
        }

        return res.status(response.status).json({
          error: errorData.error?.message || "Erro ao chamar API da Anthropic",
          details: errorData
        });
      }

      const data = await response.json();

      console.log(`[${new Date().toISOString()}] Resposta recebida:`, {
        id: data.id,
        model: data.model,
        usage: data.usage,
        durationMs,
      });

      // Log success if debug mode
      if (debugMode && req.user && req.user.id) {
        try {
          const textBlock = data.content?.find(b => b.type === "text")?.text;
          let replyText = null;
          let updatesJson = null;
          let updatesCount = 0;

          try {
            const parsed = JSON.parse(textBlock || "{}");
            replyText = parsed.reply || null;
            updatesJson = JSON.stringify(parsed.updates || []);
            updatesCount = (parsed.updates || []).length;
          } catch { /* structured parse failed, store raw */ }

          const usage = data.usage || {};

          stmts.insertAiLog.run(
            crypto.randomUUID(), req.user.id, new Date().toISOString(),
            system || null, system?.length || 0,
            JSON.stringify(messages),
            messages.length,
            data.model || payload.model, thinking ? 1 : 0, thinking?.budget_tokens || null,
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

      // Log crash if debug mode
      if (debugMode && req.user && req.user.id) {
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

      res.status(500).json({
        error: "Erro interno do servidor",
        message: error.message
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
