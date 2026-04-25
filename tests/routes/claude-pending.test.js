import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { setupTestEnv, cleanupTestEnv } from "../setup/test-env.js";

let app, token;
const originalFetch = globalThis.fetch;

beforeAll(async () => {
  setupTestEnv();
  process.env.RATE_LIMIT_CLAUDE_MAX = "1000";
  process.env.RATE_LIMIT_GLOBAL_MAX = "1000";
  const { createApp } = await import("../../app.js");
  app = await createApp({ enableSpa: false });

  const { default: supertest } = await import("supertest");
  await supertest(app)
    .post("/api/auth/setup")
    .send({ name: "PendingUser", password: "test123" });

  const loginRes = await supertest(app)
    .post("/api/auth/login")
    .send({ name: "PendingUser", password: "test123" });

  token = loginRes.body.token;
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

const gatewayResponse = {
  id: "msg_pending_001",
  model: "claude-sonnet-4-20250514",
  content: [{ type: "text", text: "Resposta do gateway" }],
  usage: { input_tokens: 10, output_tokens: 5 },
};

describe("POST /api/claude salva resposta pendente", () => {
  let request;

  beforeAll(async () => {
    const supertest = await import("supertest");
    request = supertest.default;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("salva resposta em pending_ai_responses apos sucesso do gateway", async () => {
    globalThis.fetch = mockFetchResponse(200, gatewayResponse);

    await request(app)
      .post("/api/claude")
      .set("Authorization", `Bearer ${token}`)
      .send({ messages: [{ role: "user", content: "salva pendente?" }] });

    const listRes = await request(app)
      .get("/api/claude/pending")
      .set("Authorization", `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.items.length).toBeGreaterThan(0);
  });

  it("retorna _responseId no response body", async () => {
    globalThis.fetch = mockFetchResponse(200, gatewayResponse);

    const res = await request(app)
      .post("/api/claude")
      .set("Authorization", `Bearer ${token}`)
      .send({ messages: [{ role: "user", content: "preciso de _responseId" }] });

    expect(res.status).toBe(200);
    expect(typeof res.body._responseId).toBe("string");
    expect(res.body._responseId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it("nao salva pendente quando gateway retorna erro 500", async () => {
    globalThis.fetch = mockFetchResponse(500, { error: "internal error" });

    // Capture pending count before the failing call
    const beforeRes = await request(app)
      .get("/api/claude/pending")
      .set("Authorization", `Bearer ${token}`);
    const countBefore = beforeRes.body.items.length;

    await request(app)
      .post("/api/claude")
      .set("Authorization", `Bearer ${token}`)
      .send({ messages: [{ role: "user", content: "gateway vai falhar" }] });

    const afterRes = await request(app)
      .get("/api/claude/pending")
      .set("Authorization", `Bearer ${token}`);

    expect(afterRes.body.items.length).toBe(countBefore);
  });
});

describe("GET /api/claude/pending", () => {
  let request;

  beforeAll(async () => {
    const supertest = await import("supertest");
    request = supertest.default;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("retorna 401 sem token", async () => {
    const res = await request(app).get("/api/claude/pending");
    expect(res.status).toBe(401);
  });

  it("retorna items vazio quando nao ha pendentes", async () => {
    // Use a fresh user (via invite) so there are no pre-existing pending items
    const inviteRes = await request(app)
      .post("/api/admin/invites")
      .set("Authorization", `Bearer ${token}`)
      .send({ ttlHours: 1 });
    const { code } = inviteRes.body;

    const registerRes = await request(app)
      .post("/api/auth/register")
      .send({ name: "EmptyPendingUser", password: "test123", invite: code });

    const freshToken = registerRes.body.token;

    const res = await request(app)
      .get("/api/claude/pending")
      .set("Authorization", `Bearer ${freshToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it("retorna pendentes do usuario em ordem cronologica", async () => {
    // Use a dedicated user (via invite) to keep state predictable
    const inviteRes = await request(app)
      .post("/api/admin/invites")
      .set("Authorization", `Bearer ${token}`)
      .send({ ttlHours: 1 });
    const { code } = inviteRes.body;

    const registerRes = await request(app)
      .post("/api/auth/register")
      .send({ name: "OrderUser", password: "test123", invite: code });

    const orderToken = registerRes.body.token;

    globalThis.fetch = mockFetchResponse(200, {
      ...gatewayResponse,
      id: "msg_order_1",
    });
    await request(app)
      .post("/api/claude")
      .set("Authorization", `Bearer ${orderToken}`)
      .send({ messages: [{ role: "user", content: "primeira mensagem" }] });

    globalThis.fetch = mockFetchResponse(200, {
      ...gatewayResponse,
      id: "msg_order_2",
    });
    await request(app)
      .post("/api/claude")
      .set("Authorization", `Bearer ${orderToken}`)
      .send({ messages: [{ role: "user", content: "segunda mensagem" }] });

    const res = await request(app)
      .get("/api/claude/pending")
      .set("Authorization", `Bearer ${orderToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(2);

    const [first, second] = res.body.items;
    expect(new Date(first.created_at).getTime()).toBeLessThanOrEqual(
      new Date(second.created_at).getTime()
    );
  });

  it("nao retorna itens ja confirmados", async () => {
    globalThis.fetch = mockFetchResponse(200, gatewayResponse);

    const postRes = await request(app)
      .post("/api/claude")
      .set("Authorization", `Bearer ${token}`)
      .send({ messages: [{ role: "user", content: "vou confirmar este" }] });

    const responseId = postRes.body._responseId;
    expect(typeof responseId).toBe("string");

    await request(app)
      .post(`/api/claude/pending/${responseId}/ack`)
      .set("Authorization", `Bearer ${token}`);

    const listRes = await request(app)
      .get("/api/claude/pending")
      .set("Authorization", `Bearer ${token}`);

    const found = listRes.body.items.find((item) => item.id === responseId);
    expect(found).toBeUndefined();
  });
});

describe("GET /api/claude/pending/:id", () => {
  let request;

  beforeAll(async () => {
    const supertest = await import("supertest");
    request = supertest.default;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("retorna 404 para id inexistente", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";

    const res = await request(app)
      .get(`/api/claude/pending/${fakeId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it("retorna resposta completa com response_raw", async () => {
    globalThis.fetch = mockFetchResponse(200, gatewayResponse);

    const postRes = await request(app)
      .post("/api/claude")
      .set("Authorization", `Bearer ${token}`)
      .send({ messages: [{ role: "user", content: "quero response_raw" }] });

    const responseId = postRes.body._responseId;
    expect(typeof responseId).toBe("string");

    const res = await request(app)
      .get(`/api/claude/pending/${responseId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("response_raw");
    expect(res.body.id).toBe(responseId);
  });
});

describe("POST /api/claude/pending/:id/ack", () => {
  let request;

  beforeAll(async () => {
    const supertest = await import("supertest");
    request = supertest.default;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("retorna 401 sem token", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000001";

    const res = await request(app).post(`/api/claude/pending/${fakeId}/ack`);

    expect(res.status).toBe(401);
  });

  it("retorna 404 para id inexistente", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000002";

    const res = await request(app)
      .post(`/api/claude/pending/${fakeId}/ack`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it("confirma resposta e retorna ok", async () => {
    globalThis.fetch = mockFetchResponse(200, gatewayResponse);

    const postRes = await request(app)
      .post("/api/claude")
      .set("Authorization", `Bearer ${token}`)
      .send({ messages: [{ role: "user", content: "confirmar esta resposta" }] });

    const responseId = postRes.body._responseId;
    expect(typeof responseId).toBe("string");

    const ackRes = await request(app)
      .post(`/api/claude/pending/${responseId}/ack`)
      .set("Authorization", `Bearer ${token}`);

    expect(ackRes.status).toBe(200);
    expect(ackRes.body.ok).toBe(true);
  });

  it("idempotente: ackar duas vezes retorna ok", async () => {
    globalThis.fetch = mockFetchResponse(200, gatewayResponse);

    const postRes = await request(app)
      .post("/api/claude")
      .set("Authorization", `Bearer ${token}`)
      .send({ messages: [{ role: "user", content: "ackar duas vezes" }] });

    const responseId = postRes.body._responseId;
    expect(typeof responseId).toBe("string");

    const ack1 = await request(app)
      .post(`/api/claude/pending/${responseId}/ack`)
      .set("Authorization", `Bearer ${token}`);

    const ack2 = await request(app)
      .post(`/api/claude/pending/${responseId}/ack`)
      .set("Authorization", `Bearer ${token}`);

    expect(ack1.status).toBe(200);
    expect(ack1.body.ok).toBe(true);
    expect(ack2.status).toBe(200);
    expect(ack2.body.ok).toBe(true);
  });
});
