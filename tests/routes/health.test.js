import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestEnv, cleanupTestEnv } from "../setup/test-env.js";

let app;
const originalFetch = globalThis.fetch;

beforeAll(async () => {
  setupTestEnv();
  globalThis.fetch = async () => ({ status: 200 });
  const { createApp } = await import("../../app.js");
  app = await createApp({ enableSpa: false });
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  cleanupTestEnv();
});

describe("GET /api/health", () => {
  it("retorna status ok", async () => {
    const { default: supertest } = await import("supertest");
    const res = await supertest(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
    expect(res.body.checks).toEqual({ sqlite: true, gateway: true });
    expect(res.body).toHaveProperty("timestamp");
  });
});

describe("GET /api/pt/health (rewrite)", () => {
  it("funciona com prefixo /api/pt", async () => {
    const { default: supertest } = await import("supertest");
    const res = await supertest(app).get("/api/pt/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
