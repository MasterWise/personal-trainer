import { describe, expect, it } from "vitest";
import { buildResponseSchemaForInteraction } from "../../src/services/claudeSchema.js";

describe("claude schema reinforcement", () => {
  it("em conversa de plano exige planScopeDate e targetDate fixos", () => {
    const schema = buildResponseSchemaForInteraction({
      conversationType: "plan",
      planDate: "27/02/2026",
    });

    expect(schema.required).toContain("planScopeDate");
    expect(schema.properties.planScopeDate).toEqual({
      type: "string",
      enum: ["27/02/2026"],
    });

    expect(schema.properties.updates.items.required).toContain("targetDate");
    expect(schema.properties.updates.items.properties.targetDate).toEqual({
      type: "string",
      enum: ["27/02/2026"],
    });
    expect(schema.properties.updates.items.properties.action.enum).toContain("append_coach_note");
    expect(schema.properties.updates.items.properties.permissionGroupId).toEqual({ type: ["string", "null"] });
    expect(schema.properties.updates.items.properties.permissionPrompt.required).toEqual([
      "title",
      "message",
      "approveLabel",
      "rejectLabel",
      "details",
    ]);
    expect(Array.isArray(schema.properties.updates.items.allOf)).toBe(true);
  });

  it("em conversa geral não obriga targetDate/planScopeDate", () => {
    const schema = buildResponseSchemaForInteraction({ conversationType: "general" });

    expect(schema.required).not.toContain("planScopeDate");
    expect(schema.properties.updates.items.required).not.toContain("targetDate");
    expect(schema.properties.updates.items.properties.targetDate).toEqual({
      type: ["string", "null"],
      pattern: "^\\d{2}/\\d{2}/\\d{4}$",
    });
  });

  it("em geração automática de plano permite replace_all para file=plano", () => {
    const schema = buildResponseSchemaForInteraction({
      conversationType: "plan",
      planDate: "27/02/2026",
      autoAction: "generate_plan",
    });

    expect(schema.required).toContain("planScopeDate");
    expect(schema.properties.updates.items.required).toContain("targetDate");
    expect(schema.properties.updates.items.allOf).toBeUndefined();
  });
});
