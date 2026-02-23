const PARSE_ERROR_MESSAGES = {
  NO_TEXT_BLOCK: "A resposta da IA veio em um formato nao suportado. Tente novamente.",
  TRUNCATED_JSON: "A resposta foi interrompida antes de concluir. Tente novamente.",
  INVALID_JSON: "Erro ao processar resposta da IA.",
  INVALID_SCHEMA: "Erro ao processar resposta da IA.",
  INVALID_PAYLOAD: "Erro ao processar resposta da IA.",
};

export class ClaudeResponseParseError extends Error {
  constructor(code, meta = {}, cause = null) {
    super(PARSE_ERROR_MESSAGES[code] || PARSE_ERROR_MESSAGES.INVALID_JSON);
    this.name = "ClaudeResponseParseError";
    this.code = code;
    this.userMessage = PARSE_ERROR_MESSAGES[code] || PARSE_ERROR_MESSAGES.INVALID_JSON;
    this.meta = meta;
    if (cause) this.cause = cause;
  }
}

export function isClaudeResponseParseError(error) {
  return error instanceof ClaudeResponseParseError;
}

export function getClaudeResponseUserMessage(error) {
  if (isClaudeResponseParseError(error)) {
    return error.userMessage;
  }
  return error?.message || "Erro ao processar resposta da IA.";
}

function getContentBlocks(payload) {
  return Array.isArray(payload?.content) ? payload.content : [];
}

function getContentTypes(contentBlocks) {
  return contentBlocks
    .map((block) => (block && typeof block === "object" ? block.type : null))
    .filter(Boolean);
}

function getParseMeta(payload, contentBlocks) {
  return {
    stopReason: payload?.stop_reason ?? null,
    contentTypes: getContentTypes(contentBlocks),
  };
}

function getOutputJsonValue(block) {
  if (!block || typeof block !== "object") return undefined;

  if (block.json !== undefined) return block.json;
  if (block.data !== undefined) return block.data;
  if (block.value !== undefined) return block.value;
  if (block.output !== undefined) return block.output;

  return undefined;
}

function findStructuredSource(contentBlocks) {
  const outputJsonBlock = contentBlocks.find((block) => block?.type === "output_json");
  if (outputJsonBlock) {
    return {
      sourceType: "output_json",
      value: getOutputJsonValue(outputJsonBlock),
    };
  }

  const textBlock = contentBlocks.find(
    (block) => block?.type === "text" && typeof block.text === "string" && block.text.trim()
  );
  if (textBlock) {
    return {
      sourceType: "text",
      value: textBlock.text,
    };
  }

  return null;
}

function parseStructuredValue(source, meta) {
  if (!source) {
    throw new ClaudeResponseParseError("NO_TEXT_BLOCK", meta);
  }

  try {
    if (source.sourceType === "output_json") {
      if (typeof source.value === "string") {
        return JSON.parse(source.value);
      }
      if (source.value && typeof source.value === "object" && !Array.isArray(source.value)) {
        return source.value;
      }
      throw new Error("Bloco output_json sem payload suportado");
    }

    if (source.sourceType === "text") {
      return JSON.parse(source.value);
    }

    throw new Error(`Tipo de bloco nao suportado: ${source.sourceType}`);
  } catch (cause) {
    const code = meta.stopReason === "max_tokens" ? "TRUNCATED_JSON" : "INVALID_JSON";
    throw new ClaudeResponseParseError(code, { ...meta, sourceType: source.sourceType }, cause);
  }
}

function normalizeStructuredPayload(parsed, meta) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ClaudeResponseParseError("INVALID_SCHEMA", meta);
  }

  if (typeof parsed.reply !== "string") {
    throw new ClaudeResponseParseError("INVALID_SCHEMA", meta);
  }

  const updates = parsed.updates == null ? [] : parsed.updates;
  if (!Array.isArray(updates)) {
    throw new ClaudeResponseParseError("INVALID_SCHEMA", meta);
  }

  return {
    reply: parsed.reply,
    updates,
  };
}

export function parseClaudeStructuredResponse(payload) {
  if (!payload || typeof payload !== "object") {
    throw new ClaudeResponseParseError("INVALID_PAYLOAD", { stopReason: null, contentTypes: [] });
  }

  const contentBlocks = getContentBlocks(payload);
  const meta = getParseMeta(payload, contentBlocks);
  const source = findStructuredSource(contentBlocks);
  const parsed = parseStructuredValue(source, meta);
  const normalized = normalizeStructuredPayload(parsed, { ...meta, sourceType: source?.sourceType || null });

  return {
    ...normalized,
    meta: {
      ...meta,
      sourceType: source?.sourceType || null,
    },
  };
}

