import { afterEach, describe, expect, it } from "vitest";
import { buildGatewayPayload, extractStructuredResponse, limitFirestoreText, redactSensitive } from "../../firebase/payload.js";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("firebase/payload", () => {
  it("monta payload do gateway sem model quando AI_MODEL nao esta definido", () => {
    delete process.env.AI_MODEL;
    process.env.REASONING_EFFORT = "low";

    const payload = buildGatewayPayload({
      system: "sistema",
      messages: [{ role: "user", content: "oi" }],
      output_config: { format: { schema: { type: "object" } } },
      interaction_context: "contexto",
    });

    expect(payload).toMatchObject({
      app: "personal-trainer",
      system: "sistema",
      messages: [{ role: "user", content: "oi" }],
      effort: "low",
      output_schema: { type: "object" },
      interaction_context: "contexto",
    });
    expect(payload).not.toHaveProperty("model");
  });

  it("usa AI_MODEL explicito quando configurado", () => {
    process.env.AI_MODEL = "gemini-3-flash";

    const payload = buildGatewayPayload({
      messages: [{ role: "user", content: "oi" }],
    });

    expect(payload.model).toBe("gemini-3-flash");
  });

  it("extrai reply e updates de output_json", () => {
    const result = extractStructuredResponse({
      content: [{ type: "output_json", json: { reply: "feito", updates: [{ file: "plano" }] } }],
    });

    expect(result.replyText).toBe("feito");
    expect(result.updatesJson).toBe(JSON.stringify([{ file: "plano" }]));
    expect(result.updatesCount).toBe(1);
  });

  it("trunca texto grande para respeitar limite de documento Firestore", () => {
    const result = limitFirestoreText("abcdef", 3);

    expect(result).toEqual({ text: "abc", truncated: true, originalLength: 6 });
  });

  it("redige chaves sensiveis antes de gravar logs", () => {
    const result = redactSensitive({ Authorization: "Bearer abc", nested: { apiKey: "secret", ok: true } });

    expect(result).toContain("[REDACTED]");
    expect(result).not.toContain("Bearer abc");
    expect(result).not.toContain("secret");
  });
});
