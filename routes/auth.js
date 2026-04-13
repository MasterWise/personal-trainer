import { Router } from "express";
import crypto from "crypto";
import { stmts, withTransaction } from "../db/index.js";
import { authMiddleware, adminOnly, generateId, hashPassword, verifyPassword } from "../middleware/auth.js";
import { seedUserDefaults, seedEmptyDefaults } from "../db/seedDefaults.js";

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

  // Registro por convite
  router.post("/api/auth/register", (req, res) => {
    try {
      const { name, password, invite } = req.body;

      if (!name || !password || !invite) {
        return res.status(400).json({ error: "Nome, senha e codigo de convite sao obrigatorios" });
      }

      if (password.length < 4) {
        return res.status(400).json({ error: "Senha deve ter pelo menos 4 caracteres" });
      }

      const inviteRow = stmts.getInvite.get(invite);
      if (!inviteRow) {
        return res.status(404).json({ error: "Convite nao encontrado" });
      }
      if (inviteRow.used_by) {
        return res.status(410).json({ error: "Convite ja utilizado" });
      }
      if (new Date(inviteRow.expires_at) < new Date()) {
        return res.status(410).json({ error: "Convite expirado" });
      }

      const existing = stmts.getUserByName.get(name);
      if (existing) {
        return res.status(409).json({ error: "Nome de usuario ja esta em uso" });
      }

      const now = new Date().toISOString();
      let userId;
      let sessionId;
      withTransaction(() => {
        userId = generateId();
        sessionId = generateId();
        const passwordHash = hashPassword(password);
        stmts.insertUser.run(userId, name, passwordHash, 0, now, now);
        seedEmptyDefaults(userId);
        stmts.insertSession.run(sessionId, userId, now, getSessionExpiryIso());
        stmts.markInviteUsed.run(userId, now, invite);
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
      console.error("[Auth Error][Register]", error);
      res.status(500).json({ error: "Erro ao registrar usuario" });
    }
  });

  // Validar convite (usado pelo frontend antes de mostrar tela de registro)
  router.get("/api/auth/invite/:code", (req, res) => {
    try {
      const inviteRow = stmts.getInvite.get(req.params.code);
      if (!inviteRow) {
        return res.status(404).json({ valid: false, reason: "not_found" });
      }
      if (inviteRow.used_by) {
        return res.status(410).json({ valid: false, reason: "used" });
      }
      if (new Date(inviteRow.expires_at) < new Date()) {
        return res.status(410).json({ valid: false, reason: "expired" });
      }

      const creator = stmts.getUserById.get(inviteRow.created_by);
      res.json({
        valid: true,
        createdBy: creator?.name || "Admin",
        expiresAt: inviteRow.expires_at,
      });
    } catch (error) {
      console.error("[Auth Error][Invite Check]", error);
      res.status(500).json({ error: "Erro ao validar convite" });
    }
  });

  // --- Admin: Convites ---

  // Gerar convite
  router.post("/api/admin/invites", authMiddleware, adminOnly, (req, res) => {
    try {
      const ttlHours = Number.parseInt(req.body?.ttlHours || "48", 10);
      const ttl = Number.isFinite(ttlHours) && ttlHours > 0 ? ttlHours : 48;
      const code = crypto.randomBytes(6).toString("base64url");
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + ttl * 60 * 60 * 1000).toISOString();

      stmts.insertInvite.run(code, req.user.id, now, expiresAt);

      res.json({ code, expiresAt, ttlHours: ttl });
    } catch (error) {
      console.error("[Admin Error][Create Invite]", error);
      res.status(500).json({ error: "Erro ao gerar convite" });
    }
  });

  // Listar convites e usuarios
  router.get("/api/admin/invites", authMiddleware, adminOnly, (req, res) => {
    try {
      const invites = stmts.listInvitesByCreator.all(req.user.id);
      const users = stmts.listAllUsers.all();
      res.json({ invites, users });
    } catch (error) {
      console.error("[Admin Error][List Invites]", error);
      res.status(500).json({ error: "Erro ao listar convites" });
    }
  });

  // Revogar convite pendente
  router.delete("/api/admin/invites/:code", authMiddleware, adminOnly, (req, res) => {
    try {
      const result = stmts.deleteInvite.run(req.params.code, req.user.id);
      if (result.changes === 0) {
        return res.status(404).json({ error: "Convite nao encontrado ou ja utilizado" });
      }
      res.json({ ok: true });
    } catch (error) {
      console.error("[Admin Error][Revoke Invite]", error);
      res.status(500).json({ error: "Erro ao revogar convite" });
    }
  });

  return router;
}
