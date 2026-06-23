import { Router } from "express";
import { firebaseAuthMiddleware } from "../middleware/firebaseAuth.js";
import { deleteMediaForUser, uploadMediaForUser, getMediaUploadLimits } from "../firebase/media.js";

export default function firebaseMediaRoutes() {
  const router = Router();

  router.get("/api/media/limits", firebaseAuthMiddleware, (_req, res) => {
    res.json(getMediaUploadLimits());
  });

  router.post("/api/media/uploads", firebaseAuthMiddleware, async (req, res) => {
    try {
      const media = await uploadMediaForUser(req.user.uid, req.body || {});
      res.status(201).json({ media });
    } catch (error) {
      const status = error.statusCode || 500;
      if (status >= 500) console.error("[Firebase Media][POST]", error);
      res.status(status).json({
        error: error.message || "Erro ao enviar anexo",
        code: error.code || undefined,
      });
    }
  });

  router.delete("/api/media/uploads/:mediaRef", firebaseAuthMiddleware, async (req, res) => {
    try {
      const result = await deleteMediaForUser(req.user.uid, req.params.mediaRef, "client_deleted");
      res.json(result);
    } catch (error) {
      const status = error.statusCode || 500;
      if (status >= 500) console.error("[Firebase Media][DELETE]", error);
      res.status(status).json({
        error: error.message || "Erro ao remover anexo",
        code: error.code || undefined,
      });
    }
  });
  return router;
}