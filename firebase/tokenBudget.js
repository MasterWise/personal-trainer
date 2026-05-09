import { getFirestore, FieldValue } from "./admin.js";

// ─── Config defaults ────────────────────────────────────────────────────────

const DEFAULT_DAILY = 500_000;     // ~$0,05 em gemini-3-flash (input/output blend)
const DEFAULT_MONTHLY = 5_000_000; // ~$0,50/mes/usuario teto
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

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Verifica se o usuario pode iniciar uma nova chamada IA.
 * Retorna {allowed, dailyUsed, monthlyUsed, dailyCap, monthlyCap, resetAt}.
 * Quando desabilitado por env, sempre allowed=true com counters zerados.
 */
export async function checkBudget(uid) {
  if (!isEnabled()) {
    return { allowed: true, enabled: false, dailyUsed: 0, monthlyUsed: 0, dailyCap: getDailyCap(), monthlyCap: getMonthlyCap(), resetAt: null };
  }
  const dailyCap = getDailyCap();
  const monthlyCap = getMonthlyCap();

  const [dailySnap, monthlySnap] = await Promise.all([
    tokenBudgetRef(uid, dailyKey()).get(),
    tokenBudgetRef(uid, monthlyKey()).get(),
  ]);

  const dailyUsed = dailySnap.exists ? Number(dailySnap.data()?.totalTokens || 0) : 0;
  const monthlyUsed = monthlySnap.exists ? Number(monthlySnap.data()?.totalTokens || 0) : 0;

  if (dailyUsed >= dailyCap) {
    return { allowed: false, enabled: true, reason: "daily", dailyUsed, monthlyUsed, dailyCap, monthlyCap, resetAt: nextDailyResetIso() };
  }
  if (monthlyUsed >= monthlyCap) {
    return { allowed: false, enabled: true, reason: "monthly", dailyUsed, monthlyUsed, dailyCap, monthlyCap, resetAt: nextMonthlyResetIso() };
  }
  return { allowed: true, enabled: true, dailyUsed, monthlyUsed, dailyCap, monthlyCap, resetAt: null };
}

/**
 * Debita uso real (apos resposta do gateway). Idempotente em caso de erro
 * de retry porque cada chamada e atomica via FieldValue.increment, mas o
 * caller deve garantir que so chama uma vez por response (worker chama uma
 * unica vez no caminho ok).
 */
export async function debit(uid, { inputTokens = 0, outputTokens = 0, cachedTokens = 0 } = {}) {
  if (!isEnabled()) return { ok: true, skipped: "disabled" };

  const totalTokens = Number(inputTokens || 0) + Number(outputTokens || 0);
  if (totalTokens <= 0 && (cachedTokens || 0) <= 0) {
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
      used: dailySnap.exists ? Number(dailySnap.data()?.totalTokens || 0) : 0,
      input: dailySnap.exists ? Number(dailySnap.data()?.inputTokens || 0) : 0,
      output: dailySnap.exists ? Number(dailySnap.data()?.outputTokens || 0) : 0,
      cached: dailySnap.exists ? Number(dailySnap.data()?.cachedTokens || 0) : 0,
      requestCount: dailySnap.exists ? Number(dailySnap.data()?.requestCount || 0) : 0,
      resetAt: nextDailyResetIso(),
    },
    monthly: {
      cap: getMonthlyCap(),
      used: monthlySnap.exists ? Number(monthlySnap.data()?.totalTokens || 0) : 0,
      input: monthlySnap.exists ? Number(monthlySnap.data()?.inputTokens || 0) : 0,
      output: monthlySnap.exists ? Number(monthlySnap.data()?.outputTokens || 0) : 0,
      cached: monthlySnap.exists ? Number(monthlySnap.data()?.cachedTokens || 0) : 0,
      requestCount: monthlySnap.exists ? Number(monthlySnap.data()?.requestCount || 0) : 0,
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
