import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupTestEnv, cleanupTestEnv } from "../setup/test-env.js";

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

describe("Conversations - plan versioning", () => {
  const planDate = "23/02/2026";

  it("cria conversa de plano v1", async () => {
    const { default: supertest } = await import("supertest");
    const res = await supertest(app)
      .post("/api/conversations/plan/start")
      .set("Authorization", `Bearer ${token}`)
      .send({ planDate, mode: "generate" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.conversation).toMatchObject({
      type: "plan",
      planDate,
      planVersion: 1,
      originAction: "generate_plan",
    });
    expect(Array.isArray(res.body.conversation.messages)).toBe(true);
  });

  it("salva mensagens na conversa atual de plano mantendo metadata", async () => {
    const { default: supertest } = await import("supertest");
    const saveRes = await supertest(app)
      .put("/api/conversations/current")
      .set("Authorization", `Bearer ${token}`)
      .send({
        messages: [{ role: "user", content: "Gerar plano para hoje" }],
        meta: { type: "plan", planDate, planVersion: 1, originAction: "generate_plan" },
      });

    expect(saveRes.status).toBe(200);
    expect(saveRes.body.ok).toBe(true);

    const currentRes = await supertest(app)
      .get("/api/conversations/current")
      .set("Authorization", `Bearer ${token}`);

    expect(currentRes.status).toBe(200);
    expect(currentRes.body).toMatchObject({
      type: "plan",
      planDate,
      planVersion: 1,
      isLatestPlanVersion: true,
    });
    expect(currentRes.body.messages).toHaveLength(1);
  });

  it("cria nova versão v2 e lista histórico ordenado", async () => {
    const { default: supertest } = await import("supertest");

    const newPlanRes = await supertest(app)
      .post("/api/conversations/plan/start")
      .set("Authorization", `Bearer ${token}`)
      .send({ planDate, mode: "new_plan" });

    expect(newPlanRes.status).toBe(200);
    expect(newPlanRes.body.conversation).toMatchObject({
      type: "plan",
      planDate,
      planVersion: 2,
      originAction: "new_plan",
    });

    const historyRes = await supertest(app)
      .get(`/api/conversations/plan/history?date=${encodeURIComponent(planDate)}`)
      .set("Authorization", `Bearer ${token}`);

    expect(historyRes.status).toBe(200);
    expect(historyRes.body.planDate).toBe(planDate);
    expect(historyRes.body.items).toHaveLength(2);
    expect(historyRes.body.items[0].planVersion).toBe(2);
    expect(historyRes.body.items[0].isLatestVersion).toBe(true);
    expect(historyRes.body.items[1].planVersion).toBe(1);
    expect(historyRes.body.items[1].isLatestVersion).toBe(false);
  });

  it("ativar versão antiga marca isLatestPlanVersion=false", async () => {
    const { default: supertest } = await import("supertest");

    const historyRes = await supertest(app)
      .get(`/api/conversations/plan/history?date=${encodeURIComponent(planDate)}`)
      .set("Authorization", `Bearer ${token}`);
    const oldVersion = historyRes.body.items.find((item) => item.planVersion === 1);

    const activateRes = await supertest(app)
      .post("/api/conversations/activate")
      .set("Authorization", `Bearer ${token}`)
      .send({ id: oldVersion.id });

    expect(activateRes.status).toBe(200);
    expect(activateRes.body.ok).toBe(true);
    expect(activateRes.body.isLatestPlanVersion).toBe(false);
    expect(activateRes.body.conversation.planVersion).toBe(1);

    const currentRes = await supertest(app)
      .get("/api/conversations/current")
      .set("Authorization", `Bearer ${token}`);

    expect(currentRes.status).toBe(200);
    expect(currentRes.body.planVersion).toBe(1);
    expect(currentRes.body.isLatestPlanVersion).toBe(false);
  });
});
