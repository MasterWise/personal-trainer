import { post } from "./api.js";
import { buildResponseSchemaForInteraction } from "./claudeSchema.js";

const INTERACTION_CONTEXT_TIMEZONE = "America/Sao_Paulo";

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

function buildConversationContextSection(interactionMeta = {}) {
  const lines = [
    `conversation_type: ${interactionMeta.conversationType === "plan" ? "plan" : "general"}`,
  ];

  if (interactionMeta.conversationType === "plan") {
    if (interactionMeta.planDate) lines.push(`plan_date: ${interactionMeta.planDate}`);
    if (Number.isInteger(interactionMeta.planVersion)) lines.push(`plan_version: ${interactionMeta.planVersion}`);
  }

  if (interactionMeta.originAction) {
    lines.push(`origin_action: ${interactionMeta.originAction}`);
  }

  return `<conversation_context>\n${indentMultiline(lines.join("\n"), 2)}\n</conversation_context>`;
}

function buildPlanContextSection(planContext = {}) {
  if (!planContext || typeof planContext !== "object") return null;

  const lines = [];
  if (planContext.scope) lines.push(`scope: ${planContext.scope}`);
  if (planContext.date) lines.push(`date: ${planContext.date}`);
  lines.push(`status: ${planContext.status || "missing"}`);
  if (Number.isInteger(planContext.pastPlansCount)) {
    lines.push(`past_plans_count: ${planContext.pastPlansCount}`);
  }
  if (Number.isInteger(planContext.futurePlansCount)) {
    lines.push(`future_plans_count: ${planContext.futurePlansCount}`);
  }

  if (planContext.content != null) {
    let contentText = "";
    try {
      contentText = JSON.stringify(planContext.content, null, 2);
    } catch {
      contentText = String(planContext.content);
    }

    return `<plan_context>\n${indentMultiline(lines.join("\n"), 2)}\n  <plan_json>\n${indentMultiline(contentText, 4)}\n  </plan_json>\n</plan_context>`;
  }

  return `<plan_context>\n${indentMultiline(lines.join("\n"), 2)}\n</plan_context>`;
}

function buildActionContextSection(interactionMeta = {}) {
  const autoAction = interactionMeta?.autoAction;
  if (!autoAction) return null;

  const lines = [];
  if (autoAction === "new_plan") {
    lines.push("kind: new_plan");
    lines.push("instruction: gerar uma nova versao completa do plano para a data-alvo");
  } else if (autoAction === "generate_plan") {
    lines.push("kind: generate_plan");
    lines.push("instruction: gerar o plano completo do dia para a data-alvo");
  } else {
    lines.push(`kind: ${String(autoAction)}`);
  }

  if (interactionMeta.planDate) {
    lines.push(`target_plan_date: ${interactionMeta.planDate}`);
  }
  if (Number.isInteger(interactionMeta.planVersion)) {
    lines.push(`target_plan_version: ${interactionMeta.planVersion}`);
  }
  if (interactionMeta.originAction) {
    lines.push(`origin_action: ${interactionMeta.originAction}`);
  }

  return `<action_context>\n${indentMultiline(lines.join("\n"), 2)}\n</action_context>`;
}

function buildInteractionContextText(systemContext, interactionMeta = {}) {
  const nowIso = formatNowIsoInTimeZone(new Date(), INTERACTION_CONTEXT_TIMEZONE);
  const sections = [
    `<runtime_context>\n  timezone: ${INTERACTION_CONTEXT_TIMEZONE}\n  now: ${nowIso}\n</runtime_context>`,
    buildConversationContextSection(interactionMeta),
  ];

  const actionContextSection = buildActionContextSection(interactionMeta);
  if (actionContextSection) sections.push(actionContextSection);

  const planContextSection = buildPlanContextSection(interactionMeta.planContext);
  if (planContextSection) sections.push(planContextSection);

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
 * @param {object} interactionMeta - contextual metadata for the current interaction/thread
 * Model, max_tokens, thinking, and effort are all configured server-side via env vars.
 */
export async function sendMessage(messages, systemInstructions, systemContext, interactionMeta = {}) {
  const normalizedMessages = normalizeMessages(messages);
  const responseSchema = buildResponseSchemaForInteraction(interactionMeta);

  // Add a contextual assistant message on every interaction (time + dynamic app context).
  // This keeps runtime context close to the user turn and makes future context additions easy.
  const interactionContextText = buildInteractionContextText(systemContext, interactionMeta);
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
        schema: responseSchema,
      },
    },
  };

  if (systemInstructions) payload.system = systemInstructions;

  return post("/claude", payload);
}
