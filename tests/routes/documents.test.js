import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupTestEnv, setupTestEnv } from "../setup/test-env.js";

let app;
let token;

beforeAll(async () => {
  setupTestEnv();
  const { createApp } = await import("../../app.js");
  app = await createApp({ enableSpa: false });

  const { default: supertest } = await import("supertest");
  const res = await supertest(app)
    .post("/api/auth/setup")
    .send({ name: "Renata", password: "teste123" });
  token = res.body.token;
});

afterAll(() => {
  cleanupTestEnv();
});

describe("Documents routes", () => {
  it("lista os documentos padrao do usuario autenticado", async () => {
    const { default: supertest } = await import("supertest");
    const res = await supertest(app)
      .get("/api/documents")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body.documents).sort()).toEqual([
      "cal",
      "hist",
      "macro",
      "mem",
      "micro",
      "perfil",
      "plano",
      "progresso",
      "treinos",
    ]);
  });

  it("atualiza e consulta um documento por chave", async () => {
    const { default: supertest } = await import("supertest");
    const updatedContent = "# MICRO\n\nLinha atualizada";

    const updateRes = await supertest(app)
      .put("/api/documents/micro")
      .set("Authorization", `Bearer ${token}`)
      .send({ content: updatedContent });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body).toMatchObject({
      key: "micro",
      content: updatedContent,
    });
    expect(updateRes.body.updatedAt).toBeTypeOf("string");

    const getRes = await supertest(app)
      .get("/api/documents/micro")
      .set("Authorization", `Bearer ${token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body).toMatchObject({
      key: "micro",
      content: updatedContent,
    });
  });

  it("faz batch upsert de multiplos documentos", async () => {
    const { default: supertest } = await import("supertest");

    const batchRes = await supertest(app)
      .put("/api/documents")
      .set("Authorization", `Bearer ${token}`)
      .send([
        { key: "macro", content: "Macro revisado" },
        { key: "mem", content: "Memoria revisada" },
      ]);

    expect(batchRes.status).toBe(200);
    expect(batchRes.body).toMatchObject({ ok: true, updated: 2 });

    const listRes = await supertest(app)
      .get("/api/documents")
      .set("Authorization", `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.documents.macro).toBe("Macro revisado");
    expect(listRes.body.documents.mem).toBe("Memoria revisada");
  });

  it("rejeita batch com body fora do formato esperado", async () => {
    const { default: supertest } = await import("supertest");

    const res = await supertest(app)
      .put("/api/documents")
      .set("Authorization", `Bearer ${token}`)
      .send({ key: "micro", content: "invalido" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("array");
  });

  it("reset limpa os docs e restore recria o estado padrao", async () => {
    const { default: supertest } = await import("supertest");

    const resetRes = await supertest(app)
      .post("/api/documents/reset")
      .set("Authorization", `Bearer ${token}`);

    expect(resetRes.status).toBe(200);
    expect(resetRes.body).toMatchObject({ ok: true });

    const afterReset = await supertest(app)
      .get("/api/documents")
      .set("Authorization", `Bearer ${token}`);

    expect(afterReset.status).toBe(200);
    expect(afterReset.body.documents).toMatchObject({
      micro: "",
      mem: "",
      hist: "",
      plano: "{}",
      progresso: "[]",
      cal: expect.any(String),
      treinos: expect.any(String),
      perfil: "{}",
      macro: "",
    });

    const restoreRes = await supertest(app)
      .post("/api/documents/restore")
      .set("Authorization", `Bearer ${token}`);

    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body).toMatchObject({ ok: true });

    const afterRestore = await supertest(app)
      .get("/api/documents")
      .set("Authorization", `Bearer ${token}`);

    expect(afterRestore.status).toBe(200);
    expect(afterRestore.body.documents.micro).toContain("MICRO");
    expect(afterRestore.body.documents.plano).toContain("grupos");
  });
});
