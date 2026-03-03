import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { setupTestEnv, cleanupTestEnv } from "../setup/test-env.js";

let app, token, stmts;
const originalFetch = globalThis.fetch;

beforeAll(async () => {
  setupTestEnv();
  // Disable rate limiting for tests
  process.env.RATE_LIMIT_CLAUDE_MAX = "1000";
  process.env.RATE_LIMIT_GLOBAL_MAX = "1000";
  const { createApp } = await import("../../app.js");
  app = await createApp({ enableSpa: false });

  // Create a test user and get a token
  const { default: supertest } = await import("supertest");
  await supertest(app)
    .post("/api/auth/setup")
    .send({ name: "TestUser", password: "test123" });

  const loginRes = await supertest(app)
    .post("/api/auth/login")
    .send({ name: "TestUser", password: "test123" });

  token = loginRes.body.token;

  // Get stmts reference for spy assertions
  const db = await import("../../db/index.js");
  stmts = db.stmts;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  cleanupTestEnv();
});

function mockFetchResponse(status, body) {
  return vi.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    })
  );
}

describe("POST /api/claude", () => {
  let request;

  beforeAll(async () => {
    const supertest = await import("supertest");
    request = supertest.default;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("retorna 401 sem token de autenticacao", async () => {
    const res = await request(app)
      .post("/api/claude")
      .send({ messages: [{ role: "user", content: "oi" }] });

    expect(res.status).toBe(401);
  });

  it("retorna 400 quando messages nao e fornecido", async () => {
    const res = await request(app)
      .post("/api/claude")
      .set("Authorization", `Bearer ${token}`)
      .send({ system: "test" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("messages");
  });

  it("retorna 400 quando messages nao e array", async () => {
    const res = await request(app)
      .post("/api/claude")
      .set("Authorization", `Bearer ${token}`)
      .send({ messages: "not an array" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("messages");
  });

  it("proxy para gateway e retorna 200 com resposta valida", async () => {
    const gatewayResponse = {
      id: "msg_123",
      model: "claude-sonnet-4-20250514",
      content: [{ type: "text", text: "Hello!" }],
      usage: { input_tokens: 10, output_tokens: 5 },
    };

    const mockFetch = mockFetchResponse(200, gatewayResponse);
    globalThis.fetch = mockFetch;

    const res = await request(app)
      .post("/api/claude")
      .set("Authorization", `Bearer ${token}`)
      .send({
        system: "You are helpful.",
        messages: [{ role: "user", content: "oi" }],
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(gatewayResponse);

    // Verify fetch was called with correct gateway URL and payload
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/chat");
    const body = JSON.parse(options.body);
    expect(body.app).toBe("personal-trainer");
    expect(body.system).toBe("You are helpful.");
    expect(body.messages).toEqual([{ role: "user", content: "oi" }]);
  });

  it("extrai output_schema de output_config no payload para o gateway", async () => {
    const gatewayResponse = {
      id: "msg_456",
      model: "claude-sonnet-4-20250514",
      content: [{ type: "text", text: "{}" }],
    };

    const mockFetch = mockFetchResponse(200, gatewayResponse);
    globalThis.fetch = mockFetch;

    const outputSchema = {
      type: "object",
      properties: { reply: { type: "string" } },
    };

    const res = await request(app)
      .post("/api/claude")
      .set("Authorization", `Bearer ${token}`)
      .send({
        messages: [{ role: "user", content: "test" }],
        output_config: { format: { schema: outputSchema } },
      });

    expect(res.status).toBe(200);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.output_schema).toEqual(outputSchema);
  });

  it("propaga status 429 do gateway", async () => {
    const errorBody = { error: "rate_limit_exceeded" };
    globalThis.fetch = mockFetchResponse(429, errorBody);

    const res = await request(app)
      .post("/api/claude")
      .set("Authorization", `Bearer ${token}`)
      .send({ messages: [{ role: "user", content: "oi" }] });

    expect(res.status).toBe(429);
    expect(res.body.error).toBe("rate_limit_exceeded");
  });

  it("propaga status 500 do gateway", async () => {
    const errorBody = { error: "internal error" };
    globalThis.fetch = mockFetchResponse(500, errorBody);

    const res = await request(app)
      .post("/api/claude")
      .set("Authorization", `Bearer ${token}`)
      .send({ messages: [{ role: "user", content: "oi" }] });

    expect(res.status).toBe(500);
  });

  it("retorna 502 quando gateway esta offline (TypeError de fetch)", async () => {
    const fetchError = new TypeError("fetch failed");
    fetchError.cause = { code: "ECONNREFUSED" };
    globalThis.fetch = vi.fn(() => Promise.reject(fetchError));

    const res = await request(app)
      .post("/api/claude")
      .set("Authorization", `Bearer ${token}`)
      .send({ messages: [{ role: "user", content: "oi" }] });

    expect(res.status).toBe(502);
    expect(res.body.error).toContain("indisponivel");
  });

  it("retorna 504 quando ocorre timeout (AbortError)", async () => {
    const timeoutError = new DOMException("The operation was aborted", "TimeoutError");
    globalThis.fetch = vi.fn(() => Promise.reject(timeoutError));

    const res = await request(app)
      .post("/api/claude")
      .set("Authorization", `Bearer ${token}`)
      .send({ messages: [{ role: "user", content: "oi" }] });

    expect(res.status).toBe(504);
    expect(res.body.error).toContain("Timeout");
  });

  it("chama insertAiLog em debug mode (sucesso)", async () => {
    const gatewayResponse = {
      id: "msg_789",
      model: "claude-sonnet-4-20250514",
      content: [{ type: "text", text: "Resposta" }],
      usage: { input_tokens: 10, output_tokens: 5 },
    };

    globalThis.fetch = mockFetchResponse(200, gatewayResponse);
    const spy = vi.spyOn(stmts.insertAiLog, "run");

    const res = await request(app)
      .post("/api/claude")
      .set("Authorization", `Bearer ${token}`)
      .set("x-debug-log", "true")
      .send({
        system: "System prompt",
        messages: [{ role: "user", content: "oi" }],
      });

    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledOnce();

    // Verify the success flag (20th argument, index 19) is 1
    const args = spy.mock.calls[0];
    expect(args[19]).toBe(1); // success = 1
    expect(args[20]).toBeNull(); // error_message = null

    spy.mockRestore();
  });

  it("chama insertAiLog em debug mode (erro do gateway)", async () => {
    const errorBody = { error: "server_error" };
    globalThis.fetch = mockFetchResponse(500, errorBody);
    const spy = vi.spyOn(stmts.insertAiLog, "run");

    const res = await request(app)
      .post("/api/claude")
      .set("Authorization", `Bearer ${token}`)
      .set("x-debug-log", "true")
      .send({
        messages: [{ role: "user", content: "oi" }],
      });

    expect(res.status).toBe(500);
    expect(spy).toHaveBeenCalledOnce();

    // Verify the success flag is 0 on error
    const args = spy.mock.calls[0];
    expect(args[19]).toBe(0); // success = 0

    spy.mockRestore();
  });

  it("nao chama insertAiLog sem header x-debug-log", async () => {
    const gatewayResponse = { id: "msg_no_debug", content: [] };
    globalThis.fetch = mockFetchResponse(200, gatewayResponse);
    const spy = vi.spyOn(stmts.insertAiLog, "run");

    const res = await request(app)
      .post("/api/claude")
      .set("Authorization", `Bearer ${token}`)
      .send({ messages: [{ role: "user", content: "oi" }] });

    expect(res.status).toBe(200);
    expect(spy).not.toHaveBeenCalled();

    spy.mockRestore();
  });

  it("envia payload sem output_schema quando output_config nao tem format.schema", async () => {
    const gatewayResponse = { id: "msg_no_schema", content: [] };
    const mockFetch = mockFetchResponse(200, gatewayResponse);
    globalThis.fetch = mockFetch;

    const res = await request(app)
      .post("/api/claude")
      .set("Authorization", `Bearer ${token}`)
      .send({
        messages: [{ role: "user", content: "test" }],
        output_config: { format: {} },
      });

    expect(res.status).toBe(200);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.output_schema).toBeUndefined();
  });
});
