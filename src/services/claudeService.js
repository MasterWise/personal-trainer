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
            enum: ["micro", "memoria", "historico", "plano", "progresso", "calorias", "treinos"],
          },
          action: {
            type: "string",
            enum: [
              "append", 
              "replace_all", 
              "add_progresso", 
              "append_item", 
              "patch_item", 
              "delete_item", 
              "append_micro", 
              "patch_micro", 
              "update_calorias_day", 
              "log_treino_day", 
              "patch_coach_note"
            ],
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

/**
 * Send a message to Claude.
 * @param {Array} messages - the user/assistant conversation history
 * @param {string} systemInstructions - stable system instructions (goes in `system` field)
 * @param {string} systemContext - dynamic user context (injected as first assistant prefill message)
 * @param {Object} options - model, maxTokens, thinking config
 */
export async function sendMessage(messages, systemInstructions, systemContext, options = {}) {
  // Inject the context as an assistant prefill before the real conversation.
  // This follows Anthropic's recommendation: long data before instructions/queries.
  const fullMessages = systemContext
    ? [{ role: "assistant", content: systemContext }, ...messages]
    : messages;

  const payload = {
    model: options.model || "claude-3-7-sonnet-20250219",
    max_tokens: options.maxTokens || 32000,
    messages: fullMessages,
    output_config: {
      format: {
        type: "json_schema",
        schema: RESPONSE_SCHEMA,
      },
    },
  };

  if (systemInstructions) payload.system = systemInstructions;

  if (options.thinking) {
    payload.thinking = {
      type: "enabled",
      budget_tokens: options.thinkingBudget || 5000,
    };
  }

  return post("/claude", payload);
}
