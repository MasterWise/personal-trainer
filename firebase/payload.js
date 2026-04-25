const REDACT_KEYS = new Set(["password", "authorization", "Authorization", "_sessionId", "secret", "token", "api_key", "apiKey", "cookie"]);
const FIRESTORE_SAFE_TEXT_LIMIT = 850000;

export function redactSensitive(value) {
  return JSON.stringify(value, (key, current) => {
    if (REDACT_KEYS.has(key)) return "[REDACTED]";
    return current;
  });
}

export function limitFirestoreText(value, limit = FIRESTORE_SAFE_TEXT_LIMIT) {
  if (value == null) return { text: null, truncated: false };
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (text.length <= limit) return { text, truncated: false };
  return {
    text: text.slice(0, limit),
    truncated: true,
    originalLength: text.length,
  };
}

export function extractStructuredResponse(data) {
  let replyText = null;
  let updatesJson = null;
  let updatesCount = 0;
  const content = Array.isArray(data?.content) ? data.content : [];
  const outputJsonBlock = content.find((block) => block?.type === "output_json");
  const textBlock = content.find((block) => block?.type === "text")?.text;

  if (outputJsonBlock?.json && typeof outputJsonBlock.json === "object") {
    const updates = Array.isArray(outputJsonBlock.json.updates) ? outputJsonBlock.json.updates : [];
    replyText = outputJsonBlock.json.reply || null;
    updatesJson = JSON.stringify(updates);
    updatesCount = updates.length;
  } else if (textBlock) {
    try {
      const parsed = JSON.parse(textBlock);
      const updates = Array.isArray(parsed?.updates) ? parsed.updates : [];
      replyText = parsed?.reply || null;
      updatesJson = JSON.stringify(updates);
      updatesCount = updates.length;
    } catch {
      replyText = textBlock;
    }
  }

  return { replyText, updatesJson, updatesCount };
}

export function buildGatewayPayload(body) {
  const {
    system,
    messages,
    output_config,
    _sessionId,
    interaction_context,
  } = body;

  const payload = {
    app: "personal-trainer",
    system,
    messages,
  };

  if (process.env.AI_MODEL) payload.model = process.env.AI_MODEL;
  if (_sessionId) payload._sessionId = _sessionId;
  if (interaction_context) payload.interaction_context = interaction_context;
  if (output_config?.format?.schema) payload.output_schema = output_config.format.schema;

  const effort = process.env.REASONING_EFFORT || "low";
  const maxInput = Number.parseInt(process.env.MAX_INPUT_TOKENS || "0", 10) || null;
  const maxOutput = Number.parseInt(process.env.MAX_OUTPUT_TOKENS || "0", 10) || null;
  if (effort) payload.effort = effort;
  if (maxInput) payload.max_input_tokens = maxInput;
  if (maxOutput) payload.max_output_tokens = maxOutput;

  return payload;
}
