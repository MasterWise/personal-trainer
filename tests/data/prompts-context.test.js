import { describe, expect, it } from "vitest";
import { buildRelevantPlanContext, buildSystemContext } from "../../src/data/prompts.js";

function makeDocs(planoDict) {
  return {
    plano: JSON.stringify(planoDict),
    progresso: "[]",
    cal: "{}",
    treinos: "{}",
    perfil: "{}",
    macro: "",
    micro: "",
    mem: "",
    hist: "",
  };
}

function addDays(dateStr, diff) {
  const [d, m, y] = dateStr.split("/").map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  dt.setDate(dt.getDate() + diff);
  return dt.toLocaleDateString("pt-BR");
}

function buildWindowedPlans(centerDate, pastCount, futureCount) {
  const dict = {};
  for (let i = pastCount; i >= 1; i -= 1) {
    const date = addDays(centerDate, -i);
    dict[date] = { date, grupos: [{ nome: `Passado ${i}`, itens: [] }] };
  }
  dict[centerDate] = { date: centerDate, grupos: [{ nome: "Plano alvo", itens: [] }] };
  for (let i = 1; i <= futureCount; i += 1) {
    const date = addDays(centerDate, i);
    dict[date] = { date, grupos: [{ nome: `Futuro ${i}`, itens: [] }] };
  }
  return dict;
}

describe("prompts plan context window", () => {
  it("chat geral usa hoje como referência e inclui janela de planos", () => {
    const today = new Date().toLocaleDateString("pt-BR");
    const docs = makeDocs(buildWindowedPlans(today, 3, 2));

    const relevant = buildRelevantPlanContext(docs, { conversationType: "general", planDate: addDays(today, 5) });
    expect(relevant.scope).toBe("today");
    expect(relevant.date).toBe(today);
    expect(relevant.status).toBe("exists");
    expect(relevant.content?.date).toBe(today);
    expect(relevant.pastPlansCount).toBe(3);
    expect(relevant.futurePlansCount).toBe(2);

    const ctx = buildSystemContext(docs, { conversationType: "general", planDate: addDays(today, 5) });
    expect(ctx).toContain("<plans_context_window>");
    expect(ctx).toContain("<past_plans_count>3</past_plans_count>");
    expect(ctx).toContain("<future_plans_count>2</future_plans_count>");
  });

  it("chat de plano limita a janela em 30 anteriores e 30 futuros", () => {
    const targetDate = "15/01/2026";
    const docs = makeDocs(buildWindowedPlans(targetDate, 35, 35));

    const relevant = buildRelevantPlanContext(docs, {
      conversationType: "plan",
      planDate: targetDate,
      planVersion: 2,
      originAction: "edit_plan",
    });

    expect(relevant.scope).toBe("target_date");
    expect(relevant.date).toBe(targetDate);
    expect(relevant.status).toBe("exists");
    expect(relevant.content?.date).toBe(targetDate);
    expect(relevant.pastPlansCount).toBe(30);
    expect(relevant.futurePlansCount).toBe(30);

    expect(relevant.pastPlans[0].date).toBe(addDays(targetDate, -30));
    expect(relevant.pastPlans[29].date).toBe(addDays(targetDate, -1));
    expect(relevant.futurePlans[0].date).toBe(addDays(targetDate, 1));
    expect(relevant.futurePlans[29].date).toBe(addDays(targetDate, 30));

    const outOfWindowPast = addDays(targetDate, -31);
    const outOfWindowFuture = addDays(targetDate, 31);
    const ctx = buildSystemContext(docs, { conversationType: "plan", planDate: targetDate });
    expect(ctx).toContain("<plans_context_window>");
    expect(ctx).toContain("<past_plans_count>30</past_plans_count>");
    expect(ctx).toContain("<future_plans_count>30</future_plans_count>");
    expect(ctx).toContain(addDays(targetDate, -30));
    expect(ctx).toContain(addDays(targetDate, 30));
    expect(ctx).not.toContain(outOfWindowPast);
    expect(ctx).not.toContain(outOfWindowFuture);
  });

  it("marca missing quando não há plano na data-alvo, mantendo janela vazia", () => {
    const targetDate = "22/02/2026";
    const docs = makeDocs({});

    const relevant = buildRelevantPlanContext(docs, { conversationType: "plan", planDate: targetDate });
    expect(relevant.status).toBe("missing");
    expect(relevant.content).toBeNull();
    expect(relevant.pastPlansCount).toBe(0);
    expect(relevant.futurePlansCount).toBe(0);

    const ctx = buildSystemContext(docs, { conversationType: "plan", planDate: targetDate });
    expect(ctx).toContain('<document id="plano_atual">');
    expect(ctx).toContain("{}");
    expect(ctx).toContain("<past_plans_count>0</past_plans_count>");
    expect(ctx).toContain("<future_plans_count>0</future_plans_count>");
  });
});
