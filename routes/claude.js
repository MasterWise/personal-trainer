import { Router } from "express";
import crypto from "crypto";
import { authMiddleware } from "../middleware/auth.js";
import { createClaudeRateLimit } from "../middleware/security.js";
import { stmts } from "../db/index.js";

function getContentTypes(data) {
  if (!Array.isArray(data?.content)) return [];
  return data.content
    .map((block) => (block && typeof block === "object" ? block.type : null))
    .filter(Boolean);
}

function getOutputJsonValue(block) {
  if (!block || typeof block !== "object") return undefined;
  if (block.json !== undefined) return block.json;
  if (block.data !== undefined) return block.data;
  if (block.value !== undefined) return block.value;
  if (block.output !== undefined) return block.output;
  return undefined;
}

function parseStructuredResponsePayload(data) {
  const content = Array.isArray(data?.content) ? data.content : [];
  const outputJsonBlock = content.find((block) => block?.type === "output_json");

  if (outputJsonBlock) {
    const rawValue = getOutputJsonValue(outputJsonBlock);
    if (typeof rawValue === "string") return JSON.parse(rawValue);
    if (rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)) return rawValue;
    throw new Error("Bloco output_json sem payload suportado");
  }

  const textBlock = content.find((block) => block?.type === "text")?.text;
  if (!textBlock) {
    throw new Error("Bloco text ausente na resposta da Anthropic");
  }

  return JSON.parse(textBlock);
}

function hasStructuredOutputContent(data) {
  const content = Array.isArray(data?.content) ? data.content : [];
  return content.some((block) => {
    if (!block || typeof block !== "object") return false;
    if (block.type === "output_json") return true;
    if (block.type === "text" && typeof block.text === "string" && block.text.trim()) return true;
    return false;
  });
}

function isThinkingOnlyStructuredResponse(data) {
  const contentTypes = getContentTypes(data);
  if (!contentTypes.includes("thinking")) return false;
  if (hasStructuredOutputContent(data)) return false;
  return true;
}

function buildNoThinkingRetryPayload(payload) {
  const retryPayload = JSON.parse(JSON.stringify(payload));
  delete retryPayload.thinking;

  if (retryPayload.output_config && typeof retryPayload.output_config === "object") {
    delete retryPayload.output_config.effort;
    if (Object.keys(retryPayload.output_config).length === 0) {
      delete retryPayload.output_config;
    }
  }

  return retryPayload;
}

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
    const CLAUDE_REQUEST_TIMEOUT_MS = parseInt(process.env.CLAUDE_REQUEST_TIMEOUT_MS || "120000", 10);
    const CLAUDE_DISABLE_THINKING_FOR_STRUCTURED_OUTPUT =
      process.env.CLAUDE_DISABLE_THINKING_FOR_STRUCTURED_OUTPUT === "true";

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

      const structuredOutputRequested = !!output_config;
      const effectiveThinkingConfig =
        structuredOutputRequested && CLAUDE_DISABLE_THINKING_FOR_STRUCTURED_OUTPUT
          ? null
          : thinkingConfig;

      // Build effort config (merged into output_config) only when thinking is enabled
      const baseOutputConfig = output_config || {};
      const finalOutputConfig = effectiveThinkingConfig && CLAUDE_THINKING_TYPE === "adaptive"
        ? { ...baseOutputConfig, effort: CLAUDE_EFFORT }
        : baseOutputConfig;
      const thinkingEnabled = effectiveThinkingConfig ? 1 : 0;
      const thinkingBudget = null;

      const payload = {
        model: model || CLAUDE_MODEL,
        max_tokens: max_tokens || CLAUDE_MAX_OUTPUT_TOKENS,
        messages,
      };

      if (system) payload.system = system;
      if (effectiveThinkingConfig) payload.thinking = effectiveThinkingConfig;
      if (Object.keys(finalOutputConfig).length > 0) payload.output_config = finalOutputConfig;

      console.log(`[${new Date().toISOString()}] Chamada a API Claude:`, {
        model: payload.model,
        max_tokens: payload.max_tokens,
        thinking: effectiveThinkingConfig ? CLAUDE_THINKING_TYPE : "disabled",
        effort: effectiveThinkingConfig && CLAUDE_THINKING_TYPE === "adaptive" ? CLAUDE_EFFORT : "n/a",
        systemLength: system?.length || 0,
        messagesCount: messages.length,
        structuredOutput: structuredOutputRequested,
        thinkingSuppressedForStructuredOutput:
          structuredOutputRequested && !!thinkingConfig && !effectiveThinkingConfig,
        requestTimeoutMs: CLAUDE_REQUEST_TIMEOUT_MS,
        debugLog: debugMode,
      });


      const callAnthropic = (bodyPayload) => fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify(bodyPayload),
        signal: AbortSignal.timeout(CLAUDE_REQUEST_TIMEOUT_MS),
      });

      let response = await callAnthropic(payload);

      let durationMs = Date.now() - startTime;

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
              payload.model, thinkingEnabled, thinkingBudget,
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

      let data = await response.json();
      let contentTypes = getContentTypes(data);
      let retriedWithoutThinking = false;

      if (output_config && payload.thinking && isThinkingOnlyStructuredResponse(data)) {
        const retryPayload = buildNoThinkingRetryPayload(payload);
        console.warn("[Claude Retry] Resposta somente com thinking em structured output; repetindo sem thinking.", {
          model: payload.model,
          stop_reason: data.stop_reason,
          content_types: contentTypes,
        });

        const retryResponse = await callAnthropic(retryPayload);

        if (retryResponse.ok) {
          data = await retryResponse.json();
          contentTypes = getContentTypes(data);
          retriedWithoutThinking = true;
          durationMs = Date.now() - startTime;
        } else {
          const retryError = await retryResponse.json().catch(() => ({}));
          console.error("[Claude Retry Error]", retryResponse.status, retryError);
        }
      }

      console.log(`[${new Date().toISOString()}] Resposta recebida:`, {
        id: data.id,
        model: data.model,
        stop_reason: data.stop_reason,
        content_types: contentTypes,
        retried_without_thinking: retriedWithoutThinking,
        usage: data.usage,
        durationMs,
      });

      // Log success if debug mode
      if (debugMode && req.user && req.user.id) {
        try {
          let replyText = null;
          let updatesJson = null;
          let updatesCount = 0;

          try {
            const parsed = parseStructuredResponsePayload(data);
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
            data.model || payload.model, thinkingEnabled, thinkingBudget,
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

      const timeoutCode = error?.cause?.code;
      if (timeoutCode === "UND_ERR_HEADERS_TIMEOUT" || error?.name === "AbortError" || error?.name === "TimeoutError") {
        return res.status(504).json({
          error: "Timeout ao aguardar resposta da Anthropic",
          message: error.message
        });
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
