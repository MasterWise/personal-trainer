import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestEnv, cleanupTestEnv } from "../setup/test-env.js";

let app;

beforeAll(async () => {
  setupTestEnv();
  const { createApp } = await import("../../app.js");
  app = await createApp({ enableSpa: false });
});

afterAll(() => {
  cleanupTestEnv();
});

describe("Auth Flow", () => {
  let token;

  it("GET /api/auth/status — precisa de setup", async () => {
    const { default: supertest } = await import("supertest");
    const res = await supertest(app).get("/api/auth/status");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("needsSetup", true);
  });

  it("POST /api/auth/setup — cria primeiro usuario", async () => {
    const { default: supertest } = await import("supertest");
    const res = await supertest(app)
      .post("/api/auth/setup")
      .send({ name: "Renata", password: "teste123" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body.user).toHaveProperty("name", "Renata");
    token = res.body.token;
  });

  it("GET /api/auth/status — nao precisa mais de setup", async () => {
    const { default: supertest } = await import("supertest");
    const res = await supertest(app).get("/api/auth/status");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("needsSetup", false);
  });

  it("POST /api/auth/setup — falha se ja fez setup", async () => {
    const { default: supertest } = await import("supertest");
    const res = await supertest(app)
      .post("/api/auth/setup")
      .send({ name: "Outro", password: "teste456" });
    expect(res.status).toBe(400);
  });

  it("GET /api/auth/me — retorna dados do usuario", async () => {
    const { default: supertest } = await import("supertest");
    const res = await supertest(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toHaveProperty("name", "Renata");
  });

  it("POST /api/auth/login — login com credenciais corretas", async () => {
    const { default: supertest } = await import("supertest");
    const res = await supertest(app)
      .post("/api/auth/login")
      .send({ name: "Renata", password: "teste123" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
  });

  it("POST /api/auth/login — falha com senha errada", async () => {
    const { default: supertest } = await import("supertest");
    const res = await supertest(app)
      .post("/api/auth/login")
      .send({ name: "Renata", password: "errada" });
    expect(res.status).toBe(401);
  });

  it("POST /api/auth/logout — encerra sessao", async () => {
    const { default: supertest } = await import("supertest");
    const res = await supertest(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("ok", true);
  });

  it("GET /api/auth/me — falha apos logout", async () => {
    const { default: supertest } = await import("supertest");
    const res = await supertest(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
  });
});
