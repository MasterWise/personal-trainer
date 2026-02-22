import crypto from "crypto";
import { stmts } from "../db/index.js";

// -- Utilitarios --

export function generateId() {
  return crypto.randomUUID();
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(":");
  const hashToVerify = crypto.scryptSync(password, salt, 64).toString("hex");
  return hash === hashToVerify;
}

function isSessionExpired(expiresAt) {
  if (!expiresAt) {
    return false;
  }

  const expiresAtTs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtTs)) {
    return false;
  }

  return Date.now() > expiresAtTs;
}

// -- Middleware --

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token nao fornecido" });
  }

  const token = authHeader.slice(7);
  const session = stmts.getSession.get(token);
  if (!session) {
    return res.status(401).json({ error: "Sessao invalida" });
  }
  if (isSessionExpired(session.expires_at)) {
    stmts.deleteSession.run(token);
    return res.status(401).json({ error: "Sessao expirada" });
  }

  const user = stmts.getUserById.get(session.user_id);
  if (!user) {
    return res.status(401).json({ error: "Usuario nao encontrado" });
  }

  req.user = user;
  req.sessionId = token;
  next();
}

export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const session = stmts.getSession.get(token);
    if (session) {
      if (isSessionExpired(session.expires_at)) {
        stmts.deleteSession.run(token);
        return next();
      }

      const user = stmts.getUserById.get(session.user_id);
      if (user) {
        req.user = user;
        req.sessionId = token;
      }
    }
  }
  next();
}
