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
 * Model, max_tokens, thinking, and effort are all configured server-side via env vars.
 */
export async function sendMessage(messages, systemInstructions, systemContext) {
  // Inject the context as an assistant prefill before the real conversation.
  // This follows Anthropic's recommendation: long data before instructions/queries.
  const fullMessages = systemContext
    ? [{ role: "assistant", content: systemContext }, ...messages]
    : messages;

  const payload = {
    messages: fullMessages,
    // JSON schema output format — the structured response we expect from Claude
    output_config: {
      format: {
        type: "json_schema",
        schema: RESPONSE_SCHEMA,
      },
    },
  };

  if (systemInstructions) payload.system = systemInstructions;

  return post("/claude", payload);
}
