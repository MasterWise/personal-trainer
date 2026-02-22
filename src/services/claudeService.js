import { post } from "./api.js";

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    updates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          file: {
            type: "string",
            enum: ["micro", "memoria", "historico", "plano", "marcos", "calorias", "treinos"],
          },
          action: {
            type: "string",
            enum: ["append", "replace_all", "add_marco"],
          },
          content: { type: "string" },
          requiresPermission: { type: "boolean" },
          permissionMessage: { type: "string" },
        },
        required: ["file", "action", "content", "requiresPermission", "permissionMessage"],
        additionalProperties: false,
      },
    },
  },
  required: ["reply", "updates"],
  additionalProperties: false,
};

export async function sendMessage(messages, systemPrompt, options = {}) {
  const payload = {
    model: options.model || "claude-sonnet-4-6",
    max_tokens: options.maxTokens || 8000,
    messages,
    output_config: {
      format: {
        type: "json_schema",
        schema: RESPONSE_SCHEMA,
      },
    },
  };

  if (systemPrompt) payload.system = systemPrompt;

  if (options.thinking) {
    payload.thinking = {
      type: "enabled",
      budget_tokens: options.thinkingBudget || 5000,
    };
  }

  return post("/claude", payload);
}
