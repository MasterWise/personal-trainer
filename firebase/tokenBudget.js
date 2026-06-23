import { getFirestore, FieldValue } from "./admin.js";

// ─── Config defaults ────────────────────────────────────────────────────────

const DEFAULT_DAILY = 500_000;     // ~$0,05 em gemini-3-flash (input/output blend)
const DEFAULT_MONTHLY = 5_000_000; // ~$0,50/mes/usuario teto
const DEFAULT_DAILY_COST_MICROS = 0; // 0 = sem cap por custo estimado
const DEFAULT_MONTHLY_COST_MICROS = 0;
const DEFAULT_ENABLED = true;

// TTL em segundos
const DAILY_TTL_SECONDS = 48 * 60 * 60;     // 48h apos periodStart
const MONTHLY_TTL_SECONDS = 35 * 24 * 60 * 60; // 35 dias apos periodStart

function getEnvNumber(key, fallback) {
  const raw = process.env[key];
  if (raw == null || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function getDailyCap() {
  return getEnvNumber("TOKEN_BUDGET_DAILY", DEFAULT_DAILY);
}

function getMonthlyCap() {
  return getEnvNumber("TOKEN_BUDGET_MONTHLY", DEFAULT_MONTHLY);
}

function getDailyCostCapMicros() {
  return getEnvNumber("TOKEN_BUDGET_DAILY_COST_MICROS", DEFAULT_DAILY_COST_MICROS);
}

function getMonthlyCostCapMicros() {
  return getEnvNumber("TOKEN_BUDGET_MONTHLY_COST_MICROS", DEFAULT_MONTHLY_COST_MICROS);
}

function isEnabled() {
  const raw = process.env.TOKEN_BUDGET_ENABLED;
  if (raw == null || raw === "") return DEFAULT_ENABLED;
  return raw === "true" || raw === "1";
}

// ─── Period keys (UTC) ──────────────────────────────────────────────────────

function pad2(n) { return String(n).padStart(2, "0"); }

function dailyKey(date = new Date()) {
  return `daily_${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}`;
}

function monthlyKey(date = new Date()) {
  return `monthly_${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}`;
}

function dailyPeriodStart(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0));
}

function monthlyPeriodStart(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0));
}

function nextDailyResetIso(date = new Date()) {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1, 0, 0, 0));
  return next.toISOString();
}

function nextMonthlyResetIso(date = new Date()) {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0));
  return next.toISOString();
}

// ─── Refs ───────────────────────────────────────────────────────────────────

function tokenBudgetRef(uid, periodKey) {
  return getFirestore().collection("users").doc(uid).collection("tokenBudgets").doc(periodKey);
}

function readNumber(snap, key) {
  return snap.exists ? Number(snap.data()?.[key] || 0) : 0;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Verifica se o usuario pode iniciar uma nova chamada IA.
 * Retorna {allowed, dailyUsed, monthlyUsed, dailyCap, monthlyCap, resetAt}.
 * Quando desabilitado por env, sempre allowed=true com counters zerados.
 */
export async function checkBudget(uid, pendingUsage = {}) {
  if (!isEnabled()) {
    return { allowed: true, enabled: false, dailyUsed: 0, monthlyUsed: 0, dailyCap: getDailyCap(), monthlyCap: getMonthlyCap(), resetAt: null };
  }
  const dailyCap = getDailyCap();
  const monthlyCap = getMonthlyCap();
  const dailyCostCapMicros = getDailyCostCapMicros();
  const monthlyCostCapMicros = getMonthlyCostCapMicros();
  const pendingTokens = Number(pendingUsage.totalTokens || pendingUsage.mediaInputTokens || pendingUsage.estimatedTokens || 0);
  const pendingCostMicros = Number(pendingUsage.estimatedCostMicros || pendingUsage.mediaInputCostMicros || 0);

  const [dailySnap, monthlySnap] = await Promise.all([
    tokenBudgetRef(uid, dailyKey()).get(),
    tokenBudgetRef(uid, monthlyKey()).get(),
  ]);

  const dailyUsed = readNumber(dailySnap, "totalTokens");
  const monthlyUsed = readNumber(monthlySnap, "totalTokens");
  const dailyCostUsedMicros = readNumber(dailySnap, "estimatedCostMicros");
  const monthlyCostUsedMicros = readNumber(monthlySnap, "estimatedCostMicros");

  if (dailyUsed + pendingTokens >= dailyCap) {
    return { allowed: false, enabled: true, reason: "daily", dailyUsed, monthlyUsed, dailyCap, monthlyCap, resetAt: nextDailyResetIso() };
  }
  if (monthlyUsed + pendingTokens >= monthlyCap) {
    return { allowed: false, enabled: true, reason: "monthly", dailyUsed, monthlyUsed, dailyCap, monthlyCap, resetAt: nextMonthlyResetIso() };
  }
  if (dailyCostCapMicros > 0 && dailyCostUsedMicros + pendingCostMicros >= dailyCostCapMicros) {
    return { allowed: false, enabled: true, reason: "daily_cost", dailyUsed, monthlyUsed, dailyCap, monthlyCap, dailyCostUsedMicros, monthlyCostUsedMicros, dailyCostCapMicros, monthlyCostCapMicros, resetAt: nextDailyResetIso() };
  }
  if (monthlyCostCapMicros > 0 && monthlyCostUsedMicros + pendingCostMicros >= monthlyCostCapMicros) {
    return { allowed: false, enabled: true, reason: "monthly_cost", dailyUsed, monthlyUsed, dailyCap, monthlyCap, dailyCostUsedMicros, monthlyCostUsedMicros, dailyCostCapMicros, monthlyCostCapMicros, resetAt: nextMonthlyResetIso() };
  }
  return { allowed: true, enabled: true, dailyUsed, monthlyUsed, dailyCap, monthlyCap, dailyCostUsedMicros, monthlyCostUsedMicros, dailyCostCapMicros, monthlyCostCapMicros, resetAt: null };
}

/**
 * Debita uso real (apos resposta do gateway). Idempotente em caso de erro
 * de retry porque cada chamada e atomica via FieldValue.increment, mas o
 * caller deve garantir que so chama uma vez por response (worker chama uma
 * unica vez no caminho ok).
 */
export async function debit(uid, {
  inputTokens = 0,
  outputTokens = 0,
  cachedTokens = 0,
  imageTokens = 0,
  audioTokens = 0,
  imageCount = 0,
  audioSeconds = 0,
  estimatedCostMicros = 0,
} = {}) {
  if (!isEnabled()) return { ok: true, skipped: "disabled" };

  const totalTokens = Number(inputTokens || 0) + Number(outputTokens || 0);
  if (totalTokens <= 0 && (cachedTokens || 0) <= 0 && (estimatedCostMicros || 0) <= 0) {
    return { ok: true, skipped: "zero" };
  }

  const now = new Date();
  const dailyExpires = new Date(dailyPeriodStart(now).getTime() + DAILY_TTL_SECONDS * 1000);
  const monthlyExpires = new Date(monthlyPeriodStart(now).getTime() + MONTHLY_TTL_SECONDS * 1000);

  const dailyRef = tokenBudgetRef(uid, dailyKey(now));
  const monthlyRef = tokenBudgetRef(uid, monthlyKey(now));

  const dailyData = {
    uid,
    period: "daily",
    periodStart: dailyPeriodStart(now).toISOString(),
    expiresAt: dailyExpires,
    inputTokens: FieldValue.increment(Number(inputTokens || 0)),
    outputTokens: FieldValue.increment(Number(outputTokens || 0)),
    cachedTokens: FieldValue.increment(Number(cachedTokens || 0)),
    imageTokens: FieldValue.increment(Number(imageTokens || 0)),
    audioTokens: FieldValue.increment(Number(audioTokens || 0)),
    imageCount: FieldValue.increment(Number(imageCount || 0)),
    audioSeconds: FieldValue.increment(Number(audioSeconds || 0)),
    estimatedCostMicros: FieldValue.increment(Number(estimatedCostMicros || 0)),
    totalTokens: FieldValue.increment(totalTokens),
    requestCount: FieldValue.increment(1),
    updatedAt: now.toISOString(),
  };
  const monthlyData = { ...dailyData, period: "monthly", periodStart: monthlyPeriodStart(now).toISOString(), expiresAt: monthlyExpires };

  await Promise.all([
    dailyRef.set(dailyData, { merge: true }),
    monthlyRef.set(monthlyData, { merge: true }),
  ]);

  return { ok: true };
}

/**
 * Status detalhado para endpoint admin / observabilidade.
 */
export async function getStatus(uid) {
  const [dailySnap, monthlySnap] = await Promise.all([
    tokenBudgetRef(uid, dailyKey()).get(),
    tokenBudgetRef(uid, monthlyKey()).get(),
  ]);
  return {
    enabled: isEnabled(),
    daily: {
      cap: getDailyCap(),
      costCapMicros: getDailyCostCapMicros(),
      used: readNumber(dailySnap, "totalTokens"),
      input: readNumber(dailySnap, "inputTokens"),
      output: readNumber(dailySnap, "outputTokens"),
      cached: readNumber(dailySnap, "cachedTokens"),
      imageTokens: readNumber(dailySnap, "imageTokens"),
      audioTokens: readNumber(dailySnap, "audioTokens"),
      imageCount: readNumber(dailySnap, "imageCount"),
      audioSeconds: readNumber(dailySnap, "audioSeconds"),
      estimatedCostMicros: readNumber(dailySnap, "estimatedCostMicros"),
      requestCount: readNumber(dailySnap, "requestCount"),
      resetAt: nextDailyResetIso(),
    },
    monthly: {
      cap: getMonthlyCap(),
      costCapMicros: getMonthlyCostCapMicros(),
      used: readNumber(monthlySnap, "totalTokens"),
      input: readNumber(monthlySnap, "inputTokens"),
      output: readNumber(monthlySnap, "outputTokens"),
      cached: readNumber(monthlySnap, "cachedTokens"),
      imageTokens: readNumber(monthlySnap, "imageTokens"),
      audioTokens: readNumber(monthlySnap, "audioTokens"),
      imageCount: readNumber(monthlySnap, "imageCount"),
      audioSeconds: readNumber(monthlySnap, "audioSeconds"),
      estimatedCostMicros: readNumber(monthlySnap, "estimatedCostMicros"),
      requestCount: readNumber(monthlySnap, "requestCount"),
      resetAt: nextMonthlyResetIso(),
    },
  };
}

/**
 * Reset manual (admin). Apaga doc daily ou monthly do usuario.
 */
export async function resetBudget(uid, scope = "daily") {
  const ref = scope === "monthly" ? tokenBudgetRef(uid, monthlyKey()) : tokenBudgetRef(uid, dailyKey());
  await ref.delete();
  return { ok: true, scope };
}
