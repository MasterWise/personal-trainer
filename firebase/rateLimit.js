import crypto from "crypto";
import { FieldValue, getFirestore } from "./admin.js";

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function hashKey(value) {
  return crypto.createHash("sha256").update(String(value || "anonymous")).digest("hex").slice(0, 32);
}

function rateLimitResponse(res) {
  return res.status(429).json({
    error: "rate_limit_exceeded",
    message: "Muitas requisicoes em pouco tempo. Tente novamente em instantes.",
  });
}

export function createFirebaseClaudeRateLimit() {
  const windowMs = parsePositiveInt(process.env.RATE_LIMIT_CLAUDE_WINDOW_MS, 5 * 60 * 1000);
  const max = parsePositiveInt(process.env.RATE_LIMIT_CLAUDE_MAX, 10);

  return async function firebaseClaudeRateLimit(req, res, next) {
    try {
      const actor = req.user?.uid || req.user?.id || req.ip;
      const bucket = Math.floor(Date.now() / windowMs);
      const ref = getFirestore().collection("rateLimits").doc(`claude_${hashKey(actor)}_${bucket}`);
      const expiresAt = new Date((bucket + 2) * windowMs);

      const allowed = await getFirestore().runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const count = snap.exists ? Number(snap.data().count || 0) : 0;
        if (count >= max) return false;
        tx.set(ref, {
          count: FieldValue.increment(1),
          key: hashKey(actor),
          scope: "claude",
          bucket,
          expiresAt,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
        return true;
      });

      if (!allowed) return rateLimitResponse(res);
      return next();
    } catch (error) {
      console.error("[Firebase RateLimit]", error);
      return res.status(500).json({ error: "Erro ao validar limite de requisicoes" });
    }
  };
}
