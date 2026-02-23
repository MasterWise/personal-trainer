import { describe, it, expect } from "vitest";
import {
  ClaudeResponseParseError,
  parseClaudeStructuredResponse,
} from "../../src/services/claudeResponseParser.js";

describe("parseClaudeStructuredResponse", () => {
  it("aceita resposta com thinking + text (json string)", () => {
    const payload = {
      stop_reason: "end_turn",
      content: [
        { type: "thinking", thinking: "..." },
        { type: "text", text: JSON.stringify({ reply: "Oi", updates: [] }) },
      ],
    };

    const parsed = parseClaudeStructuredResponse(payload);
    expect(parsed.reply).toBe("Oi");
    expect(parsed.updates).toEqual([]);
    expect(parsed.meta.contentTypes).toEqual(["thinking", "text"]);
    expect(parsed.meta.sourceType).toBe("text");
  });

  it("aceita resposta com output_json", () => {
    const payload = {
      stop_reason: "end_turn",
      content: [
        {
          type: "output_json",
          json: { reply: "Pode sim", updates: [{ file: "micro" }] },
        },
      ],
    };

    const parsed = parseClaudeStructuredResponse(payload);
    expect(parsed.reply).toBe("Pode sim");
    expect(parsed.updates).toEqual([{ file: "micro" }]);
    expect(parsed.meta.sourceType).toBe("output_json");
  });

  it("falha com NO_TEXT_BLOCK quando nao ha bloco suportado", () => {
    const payload = {
      stop_reason: "end_turn",
      content: [{ type: "thinking", thinking: "..." }],
    };

    expect(() => parseClaudeStructuredResponse(payload)).toThrowError(ClaudeResponseParseError);

    try {
      parseClaudeStructuredResponse(payload);
    } catch (error) {
      expect(error.code).toBe("NO_TEXT_BLOCK");
      expect(error.meta.contentTypes).toEqual(["thinking"]);
    }
  });

  it("classifica json truncado quando stop_reason = max_tokens", () => {
    const payload = {
      stop_reason: "max_tokens",
      content: [
        { type: "thinking", thinking: "..." },
        { type: "text", text: "{\"reply\":\"Oi\"" },
      ],
    };

    try {
      parseClaudeStructuredResponse(payload);
      throw new Error("era esperado erro");
    } catch (error) {
      expect(error).toBeInstanceOf(ClaudeResponseParseError);
      expect(error.code).toBe("TRUNCATED_JSON");
      expect(error.meta.stopReason).toBe("max_tokens");
      expect(error.meta.sourceType).toBe("text");
    }
  });

  it("falha com INVALID_SCHEMA quando reply nao e string", () => {
    const payload = {
      stop_reason: "end_turn",
      content: [
        { type: "text", text: JSON.stringify({ reply: null, updates: [] }) },
      ],
    };

    try {
      parseClaudeStructuredResponse(payload);
      throw new Error("era esperado erro");
    } catch (error) {
      expect(error).toBeInstanceOf(ClaudeResponseParseError);
      expect(error.code).toBe("INVALID_SCHEMA");
    }
  });
});

