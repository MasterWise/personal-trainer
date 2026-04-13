import { Router } from "express";
import { stmts, withTransaction } from "../db/index.js";
import { authMiddleware, generateId, hashPassword, verifyPassword } from "../middleware/auth.js";
import { seedUserDefaults } from "../db/seedDefaults.js";

function getSessionExpiryIso() {
  const SESSION_TTL_DAYS = Number.parseInt(process.env.SESSION_TTL_DAYS || "7", 10);
  const ttlDays = Number.isFinite(SESSION_TTL_DAYS) && SESSION_TTL_DAYS > 0 ? SESSION_TTL_DAYS : 7;
  return new Date(Date.now() + (ttlDays * 24 * 60 * 60 * 1000)).toISOString();
}

export default function authRoutes() {
  const router = Router();

  // Verifica se precisa de setup inicial
  router.get("/api/auth/status", (req, res) => {
    try {
      const { count } = stmts.countUsers.get();
      res.json({ needsSetup: count === 0 });
    } catch (error) {
      console.error("[Auth Error][Status]", error);
      res.status(500).json({ error: "Erro ao verificar status" });
    }
  });

  // Setup inicial - cria primeiro usuario
  router.post("/api/auth/setup", (req, res) => {
    try {
      const { name, password, secret } = req.body;
      const isProd = process.env.NODE_ENV === "production";
      const bootstrapSecret = process.env.BOOTSTRAP_SECRET;

      if (!name || !password) {
        return res.status(400).json({ error: "Nome e senha sao obrigatorios" });
      }

      if (password.length < 4) {
        return res.status(400).json({ error: "Senha deve ter pelo menos 4 caracteres" });
      }

      const { count } = stmts.countUsers.get();
      if (count > 0) {
        return res.status(410).json({ error: "Setup ja realizado" });
      }

      if (isProd) {
        if (!bootstrapSecret) {
          return res.status(503).json({ error: "BOOTSTRAP_SECRET nao configurado" });
        }
        if (secret !== bootstrapSecret) {
          return res.status(403).json({ error: "Segredo de bootstrap invalido" });
        }
      }

      const now = new Date().toISOString();
      let userId;
      let sessionId;
      withTransaction(() => {
        userId = generateId();
        sessionId = generateId();
        const passwordHash = hashPassword(password);
        stmts.insertUser.run(userId, name, passwordHash, 1, now, now);
        seedUserDefaults(userId);
        stmts.insertSession.run(sessionId, userId, now, getSessionExpiryIso());
      });

      const user = stmts.getUserById.get(userId);

      res.json({
        token: sessionId,
        user: {
          id: user.id,
          name: user.name,
          isAdmin: !!user.is_admin,
        }
      });

    } catch (error) {
      console.error("[Auth Error][Setup]", error);
      res.status(500).json({ error: "Erro ao criar usuario inicial" });
    }
  });

  // Login com nome + senha
  router.post("/api/auth/login", (req, res) => {
    try {
      const { name, password } = req.body;

      if (!name || !password) {
        return res.status(400).json({ error: "Nome e senha sao obrigatorios" });
      }

      const user = stmts.getUserByName.get(name);
      if (!user) {
        return res.status(401).json({ error: "Usuario nao encontrado" });
      }

      if (!verifyPassword(password, user.password_hash)) {
        return res.status(401).json({ error: "Senha incorreta" });
      }

      const now = new Date().toISOString();
      const sessionId = generateId();
      const expiresAt = getSessionExpiryIso();
      stmts.insertSession.run(sessionId, user.id, now, expiresAt);

      res.json({
        token: sessionId,
        user: {
          id: user.id,
          name: user.name,
          isAdmin: !!user.is_admin,
        }
      });

    } catch (error) {
      console.error("[Auth Error][Login]", error);
      res.status(500).json({ error: "Erro ao fazer login" });
    }
  });

  // Logout
  router.post("/api/auth/logout", authMiddleware, (req, res) => {
    try {
      stmts.deleteSession.run(req.sessionId);
      res.json({ ok: true });
    } catch (error) {
      console.error("[Auth Error][Logout]", error);
      res.status(500).json({ error: "Erro ao fazer logout" });
    }
  });

  // Dados do usuario logado
  router.get("/api/auth/me", authMiddleware, (req, res) => {
    try {
      const user = req.user;
      res.json({
        user: {
          id: user.id,
          name: user.name,
          isAdmin: !!user.is_admin,
        }
      });
    } catch (error) {
      console.error("[Auth Error][Me]", error);
      res.status(500).json({ error: "Erro ao buscar dados do usuario" });
    }
  });

  return router;
}
