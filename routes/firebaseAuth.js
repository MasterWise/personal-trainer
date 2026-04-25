import { Router } from "express";
import { getAuth } from "../firebase/admin.js";
import { firebaseAdminOnly, firebaseAuthMiddleware } from "../middleware/firebaseAuth.js";
import { ensureUserProfile, firebaseInvitesRepository, firebaseUsersRepository } from "../firebase/repositories.js";

function isExpired(invite) {
  return new Date(invite.expiresAt) < new Date();
}

function getBootstrapSeed() {
  return process.env.FIREBASE_BOOTSTRAP_SEED === "renata" ? "renata" : "empty";
}

function validateBootstrapSecret(secret) {
  const bootstrapSecret = process.env.BOOTSTRAP_SECRET;
  if (!bootstrapSecret) {
    return { ok: false, status: 503, error: "BOOTSTRAP_SECRET nao configurado" };
  }
  if (secret !== bootstrapSecret) {
    return { ok: false, status: 403, error: "Segredo de bootstrap invalido" };
  }
  return { ok: true };
}

export default function firebaseAuthRoutes() {
  const router = Router();

  router.get("/api/auth/status", async (req, res) => {
    try {
      const hasAnyUser = await firebaseUsersRepository.hasAnyUser();
      res.json({ needsSetup: !hasAnyUser, authProvider: "firebase" });
    } catch (error) {
      console.error("[Firebase Auth][Status]", error);
      res.status(500).json({ error: "Erro ao verificar status" });
    }
  });

  router.post("/api/auth/setup", firebaseAuthMiddleware, async (req, res) => {
    try {
      const { secret } = req.body || {};
      const hasAnyUser = await firebaseUsersRepository.hasAnyUser();
      if (hasAnyUser) return res.status(410).json({ error: "Setup ja realizado" });
      const secretCheck = validateBootstrapSecret(secret);
      if (!secretCheck.ok) {
        return res.status(secretCheck.status).json({ error: secretCheck.error });
      }

      await getAuth().setCustomUserClaims(req.user.uid, { admin: true });
      const user = await ensureUserProfile({ ...req.user, is_admin: true }, { seed: getBootstrapSeed() });
      res.json({ user, authProvider: "firebase" });
    } catch (error) {
      console.error("[Firebase Auth][Setup]", error);
      res.status(500).json({ error: "Erro ao criar perfil inicial" });
    }
  });

  router.post("/api/auth/login", (req, res) => {
    res.status(410).json({
      error: "Login local desativado no modo Firebase. Use Firebase Auth no frontend.",
      authProvider: "firebase",
    });
  });

  router.post("/api/auth/logout", firebaseAuthMiddleware, (req, res) => {
    res.json({ ok: true, authProvider: "firebase" });
  });

  router.get("/api/auth/me", firebaseAuthMiddleware, async (req, res) => {
    try {
      const user = await firebaseUsersRepository.me(req.user);
      if (!user) {
        return res.status(404).json({ error: "Perfil do app nao encontrado" });
      }
      res.json({ user });
    } catch (error) {
      console.error("[Firebase Auth][Me]", error);
      res.status(500).json({ error: "Erro ao buscar dados do usuario" });
    }
  });

  router.post("/api/auth/register", firebaseAuthMiddleware, async (req, res) => {
    try {
      const { invite } = req.body || {};
      if (!invite) return res.status(400).json({ error: "Codigo de convite e obrigatorio" });

      const consumed = await firebaseInvitesRepository.consume(invite, req.user.uid);
      if (!consumed.ok) return res.status(consumed.statusCode).json({ error: consumed.message });
      const user = await ensureUserProfile(req.user, { seed: "empty" });
      res.json({ user, authProvider: "firebase" });
    } catch (error) {
      console.error("[Firebase Auth][Register]", error);
      res.status(500).json({ error: "Erro ao registrar usuario" });
    }
  });

  router.get("/api/auth/invite/:code", async (req, res) => {
    try {
      const inviteRow = await firebaseInvitesRepository.get(req.params.code);
      if (!inviteRow) return res.status(404).json({ valid: false, reason: "not_found" });
      if (inviteRow.usedBy) return res.status(410).json({ valid: false, reason: "used" });
      if (isExpired(inviteRow)) return res.status(410).json({ valid: false, reason: "expired" });
      res.json({ valid: true, createdBy: inviteRow.createdBy || "Admin", expiresAt: inviteRow.expiresAt });
    } catch (error) {
      console.error("[Firebase Auth][Invite Check]", error);
      res.status(500).json({ error: "Erro ao validar convite" });
    }
  });

  router.post("/api/admin/invites", firebaseAuthMiddleware, firebaseAdminOnly, async (req, res) => {
    try {
      const ttlHours = Number.parseInt(req.body?.ttlHours || "48", 10);
      res.json(await firebaseInvitesRepository.create({ createdBy: req.user.uid, ttlHours }));
    } catch (error) {
      console.error("[Firebase Admin][Create Invite]", error);
      res.status(500).json({ error: "Erro ao gerar convite" });
    }
  });

  router.get("/api/admin/invites", firebaseAuthMiddleware, firebaseAdminOnly, async (req, res) => {
    try {
      res.json({ invites: await firebaseInvitesRepository.list(req.user.uid), users: [] });
    } catch (error) {
      console.error("[Firebase Admin][List Invites]", error);
      res.status(500).json({ error: "Erro ao listar convites" });
    }
  });

  router.delete("/api/admin/invites/:code", firebaseAuthMiddleware, firebaseAdminOnly, async (req, res) => {
    try {
      const deleted = await firebaseInvitesRepository.delete(req.params.code, req.user.uid);
      if (!deleted) return res.status(404).json({ error: "Convite nao encontrado ou ja utilizado" });
      res.json({ ok: true });
    } catch (error) {
      console.error("[Firebase Admin][Revoke Invite]", error);
      res.status(500).json({ error: "Erro ao revogar convite" });
    }
  });

  return router;
}
