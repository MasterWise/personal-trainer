import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  buildResponseSchemaForInteraction: vi.fn(),
}));

vi.mock("../../src/services/api.js", () => ({
  post: mocks.post,
}));

vi.mock("../../src/services/claudeSchema.js", () => ({
  buildResponseSchemaForInteraction: mocks.buildResponseSchemaForInteraction,
}));

import { getAsyncClaudeResponse, sendMessage } from "../../src/services/claudeService.js";

beforeEach(() => {
  mocks.post.mockReset();
  mocks.buildResponseSchemaForInteraction.mockReset();
  mocks.post.mockResolvedValue({ ok: true });
  mocks.buildResponseSchemaForInteraction.mockReturnValue({ type: "object", properties: {} });
});

describe("sendMessage", () => {
  it("envia contexto completo na mensagem e contexto leve no payload do gateway", async () => {
    await sendMessage(
      [{ role: "user", content: "Quero ajustar o plano" }],
      "system prompt fixo",
      "memoria detalhada da usuaria",
      {
        conversationType: "plan",
        planDate: "12/04/2026",
        planVersion: 3,
        originAction: "edit_plan",
        autoAction: "generate_plan",
        planContext: {
          scope: "selected_day",
          date: "12/04/2026",
          status: "available",
          content: { date: "12/04/2026", grupos: [] },
        },
        _sessionId: "sessao-123",
      }
    );

    expect(mocks.buildResponseSchemaForInteraction).toHaveBeenCalledWith({
      conversationType: "plan",
      planDate: "12/04/2026",
      planVersion: 3,
      originAction: "edit_plan",
      autoAction: "generate_plan",
      planContext: {
        scope: "selected_day",
        date: "12/04/2026",
        status: "available",
        content: { date: "12/04/2026", grupos: [] },
      },
    });

    expect(mocks.post).toHaveBeenCalledTimes(1);
    const [endpoint, payload] = mocks.post.mock.calls[0];

    expect(endpoint).toBe("/claude");
    expect(payload.system).toBe("system prompt fixo");
    expect(payload._sessionId).toBe("sessao-123");
    expect(payload.output_config.format.schema).toEqual({ type: "object", properties: {} });

    expect(payload.messages).toHaveLength(2);
    expect(payload.messages[0].role).toBe("assistant");
    expect(payload.messages[0].content[0].text).toContain("<memory_context>");
    expect(payload.messages[0].content[0].text).toContain("<plan_context>");
    expect(payload.messages[0].content[0].text).toContain("memoria detalhada da usuaria");
    expect(payload.messages[1].content).toEqual([{ type: "text", text: "Quero ajustar o plano" }]);

    expect(payload.interaction_context).toContain("<runtime_context>");
    expect(payload.interaction_context).toContain("<conversation_context>");
    expect(payload.interaction_context).toContain("plan_date: 12/04/2026");
    expect(payload.interaction_context).not.toContain("<memory_context>");
    expect(payload.interaction_context).not.toContain("<plan_context>");
  });

  it("normaliza mensagens sem texto e omite campos opcionais ausentes", async () => {
    await sendMessage(
      [
        { role: "assistant", content: [{ type: "text", text: "contexto anterior" }] },
        { role: "user", content: null },
      ],
      "",
      "",
      { conversationType: "general" }
    );

    const [, payload] = mocks.post.mock.calls[0];

    expect(payload).not.toHaveProperty("system");
    expect(payload).not.toHaveProperty("_sessionId");
    expect(payload.messages[1].content).toEqual([{ type: "text", text: "contexto anterior" }]);
    expect(payload.messages[2].content).toEqual([{ type: "text", text: "" }]);
    expect(payload.interaction_context).toContain("conversation_type: general");
  });
});

describe("getAsyncClaudeResponse", () => {
  it("aceita contratos assincronos com responseId em status queued/in_flight", () => {
    expect(getAsyncClaudeResponse({ responseId: "r-1", status: "queued" })).toEqual({
      responseId: "r-1",
      status: "queued",
    });
    expect(getAsyncClaudeResponse({ _responseId: "r-2", status: "in_flight" })).toEqual({
      responseId: "r-2",
      status: "in_flight",
    });
  });

  it("normaliza status em caixa alta e ignora respostas nao assincronas", () => {
    expect(getAsyncClaudeResponse({ id: "r-3", status: "QUEUED" })).toEqual({
      responseId: "r-3",
      status: "queued",
    });
    expect(getAsyncClaudeResponse({ responseId: "r-4", status: "pending" })).toBeNull();
    expect(getAsyncClaudeResponse({ status: "queued" })).toBeNull();
  });
});
