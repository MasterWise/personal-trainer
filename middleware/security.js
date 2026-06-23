import rateLimit from "express-rate-limit";

function rateLimitErrorHandler(req, res) {
  return res.status(429).json({
    error: "rate_limit_exceeded",
    message: "Muitas requisicoes em pouco tempo. Tente novamente em instantes.",
  });
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function firstHeader(value) {
  return Array.isArray(value) ? value[0] : value;
}

function getRequestRateLimitKey(req) {
  const forwardedFor = String(firstHeader(req.headers?.["x-forwarded-for"]) || "")
    .split(",")[0]
    .trim();
  return (
    req.ip ||
    req.ips?.[0] ||
    forwardedFor ||
    firstHeader(req.headers?.["x-real-ip"]) ||
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    "local-emulator"
  );
}

export function createGlobalRateLimit() {
  return rateLimit({
    windowMs: 60 * 1000,
    max: parsePositiveInt(process.env.RATE_LIMIT_GLOBAL_MAX, 60),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: getRequestRateLimitKey,
    handler: rateLimitErrorHandler,
  });
}

export function createLoginRateLimit() {
  return rateLimit({
    windowMs: 60 * 1000,
    max: parsePositiveInt(process.env.RATE_LIMIT_LOGIN_MAX, 5),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: getRequestRateLimitKey,
    handler: rateLimitErrorHandler,
  });
}

export function createClaudeRateLimit() {
  return rateLimit({
    windowMs: 5 * 60 * 1000,
    max: parsePositiveInt(process.env.RATE_LIMIT_CLAUDE_MAX, 10),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.id || req.user?.uid || getRequestRateLimitKey(req),
    handler: rateLimitErrorHandler,
  });
}
