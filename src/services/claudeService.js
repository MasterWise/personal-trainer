import { post } from "./api.js";

const INTERACTION_CONTEXT_TIMEZONE = "America/Sao_Paulo";

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

function parseGmtOffsetToIso(offsetLabel) {
  const match = /^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/.exec(offsetLabel || "");
  if (!match) return "+00:00";

  const [, sign, hoursRaw, minutesRaw] = match;
  const hours = String(hoursRaw).padStart(2, "0");
  const minutes = String(minutesRaw || "00").padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

function getTimeZoneOffsetLabel(date, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longOffset",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(date);
    return parts.find((part) => part.type === "timeZoneName")?.value || "GMT+00:00";
  } catch {
    return "GMT+00:00";
  }
}

function formatNowIsoInTimeZone(date = new Date(), timeZone = INTERACTION_CONTEXT_TIMEZONE) {
  try {
    const parts = new Intl.DateTimeFormat("sv-SE", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(date);

    const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const offsetIso = parseGmtOffsetToIso(getTimeZoneOffsetLabel(date, timeZone));

    return `${byType.year}-${byType.month}-${byType.day}T${byType.hour}:${byType.minute}:${byType.second}${offsetIso}`;
  } catch {
    return date.toISOString();
  }
}

function indentMultiline(text, spaces = 4) {
  const pad = " ".repeat(spaces);
  return String(text)
    .split("\n")
    .map((line) => `${pad}${line}`)
    .join("\n");
}

function buildInteractionContextText(systemContext) {
  const nowIso = formatNowIsoInTimeZone(new Date(), INTERACTION_CONTEXT_TIMEZONE);
  const sections = [
    `<runtime_context>\n  timezone: ${INTERACTION_CONTEXT_TIMEZONE}\n  now: ${nowIso}\n</runtime_context>`,
  ];

  const memoryContext = String(systemContext || "").trim();
  if (memoryContext) {
    sections.push(`<memory_context>\n${indentMultiline(memoryContext, 2)}\n</memory_context>`);
  }

  return `<interaction_context>\n${indentMultiline(sections.join("\n\n"), 2)}\n</interaction_context>`;
}

function normalizeMessageContent(content) {
  if (Array.isArray(content)) return content;

  if (typeof content === "string") {
    return [{ type: "text", text: content }];
  }

  if (content == null) {
    return [{ type: "text", text: "" }];
  }

  return [{ type: "text", text: String(content) }];
}

function normalizeMessages(messages) {
  return (Array.isArray(messages) ? messages : []).map((message) => ({
    ...message,
    content: normalizeMessageContent(message.content),
  }));
}

/**
 * Send a message to Claude.
 * @param {Array} messages - the user/assistant conversation history
 * @param {string} systemInstructions - stable system instructions (goes in `system` field)
 * @param {string} systemContext - dynamic user context (injected in an assistant context message)
 * Model, max_tokens, thinking, and effort are all configured server-side via env vars.
 */
export async function sendMessage(messages, systemInstructions, systemContext) {
  const normalizedMessages = normalizeMessages(messages);

  // Add a contextual assistant message on every interaction (time + dynamic app context).
  // This keeps runtime context close to the user turn and makes future context additions easy.
  const interactionContextText = buildInteractionContextText(systemContext);
  const fullMessages = [
    { role: "assistant", content: [{ type: "text", text: interactionContextText }] },
    ...normalizedMessages,
  ];

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
