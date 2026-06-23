import { describe, expect, it } from "vitest";
import {
  estimateMediaUsageFromMessages,
  sanitizeMessagesForStorage,
  validateClaudeMessagesDoNotEmbedMedia,
  validateMediaPolicy,
} from "../../firebase/media.js";
import { redactSensitive } from "../../firebase/payload.js";

describe("firebase/media", () => {
  it("rejeita midia inline no payload do chat", () => {
    expect(() => validateClaudeMessagesDoNotEmbedMedia([
      { role: "user", content: [{ type: "image", source: { type: "base64", media_type: "image/png", data: "abc" } }] },
    ])).toThrow(/mediaRef|inline/i);
  });

  it("permite blocos por mediaRef", () => {
    expect(() => validateClaudeMessagesDoNotEmbedMedia([
      { role: "user", content: [{ type: "media", kind: "image", mediaRef: "m1", mimeType: "image/webp" }] },
    ])).not.toThrow();
  });
  it("limita quantidade de anexos por request", () => {
    expect(() => validateMediaPolicy([
      {
        role: "user",
        content: [
          { type: "media", kind: "image", mediaRef: "m1" },
          { type: "media", kind: "image", mediaRef: "m2" },
          { type: "media", kind: "image", mediaRef: "m3" },
          { type: "media", kind: "image", mediaRef: "m4" },
        ],
      },
    ])).toThrow(/limite/i);
  });

  it("sanitiza anexos antes de persistir historico/pending", () => {
    const result = sanitizeMessagesForStorage([
      {
        role: "user",
        content: [
          { type: "text", text: "analise" },
          { type: "media", kind: "image", mediaRef: "m1", mimeType: "image/webp", dataUrl: "data:image/webp;base64,abc" },
        ],
        attachments: [{ kind: "image", mediaRef: "m1", mimeType: "image/webp", previewUrl: "blob:local" }],
      },
    ]);

    const serialized = JSON.stringify(result);
    expect(serialized).toContain("m1");
    expect(serialized).not.toContain("base64");
    expect(serialized).not.toContain("blob:local");
  });

  it("estima tokens e custo de midia", () => {
    const result = estimateMediaUsageFromMessages([
      {
        role: "user",
        content: [
          { type: "media", kind: "image", mediaRef: "img", durationMs: null },
          { type: "media", kind: "audio", mediaRef: "aud", durationMs: 6100 },
        ],
      },
    ]);

    expect(result.imageTokens).toBe(280);
    expect(result.audioSeconds).toBe(7);
    expect(result.audioTokens).toBe(224);
    expect(result.mediaInputCostMicros).toBe(Math.ceil(280 * 0.5 + 224));
  });

  it("redige dados de midia sensiveis em logs", () => {
    const redacted = redactSensitive({ fileData: { fileUri: "gs://bucket/private.wav", mimeType: "audio/wav" }, dataUrl: "data:audio/wav;base64,abc" });
    expect(redacted).not.toContain("gs://bucket");
    expect(redacted).not.toContain("base64");
    expect(redacted).toContain("[REDACTED]");
  });
});