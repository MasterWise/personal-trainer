import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { createClaudeRateLimit } from "../middleware/security.js";

export default function claudeRoutes() {
  const router = Router();
  const claudeRateLimit = createClaudeRateLimit();

  router.post("/api/claude", authMiddleware, claudeRateLimit, async (req, res) => {
    try {
      const apiKey = process.env.ANTHROPIC_API_KEY;

      if (!apiKey) {
        return res.status(500).json({
          error: "API key da Anthropic nao configurada. Configure ANTHROPIC_API_KEY no arquivo .env"
        });
      }

      const { model, max_tokens, system, messages, thinking, output_config } = req.body;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Campo "messages" e obrigatorio e deve ser um array' });
      }

      const payload = {
        model: model || "claude-sonnet-4-20250514",
        max_tokens: max_tokens || 4096,
        messages
      };

      if (system) {
        payload.system = system;
      }

      if (thinking) {
        payload.thinking = thinking;
      }

      if (output_config) {
        payload.output_config = output_config;
      }

      console.log(`[${new Date().toISOString()}] Chamada a API Claude:`, {
        model: payload.model,
        max_tokens: payload.max_tokens,
        systemLength: system?.length || 0,
        messagesCount: messages.length,
        thinking: !!thinking,
        structuredOutput: !!output_config,
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

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("[API Error]", response.status, errorData);
        return res.status(response.status).json({
          error: errorData.error?.message || "Erro ao chamar API da Anthropic",
          details: errorData
        });
      }

      const data = await response.json();

      console.log(`[${new Date().toISOString()}] Resposta recebida:`, {
        id: data.id,
        model: data.model,
        usage: data.usage
      });

      res.json(data);

    } catch (error) {
      console.error("[Server Error]", error);
      res.status(500).json({
        error: "Erro interno do servidor",
        message: error.message
      });
    }
  });

  return router;
}
