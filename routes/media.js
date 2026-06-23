import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { deleteMediaForUser, uploadMediaForUser, getMediaUploadLimits } from "../firebase/media.js";

function hasMediaStorageConfig() {
  return Boolean(process.env.PT_MEDIA_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID);
}

export default function mediaRoutes() {
  const router = Router();

  router.get("/api/media/limits", authMiddleware, (_req, res) => {
    res.json(getMediaUploadLimits());
  });

  router.post("/api/media/uploads", authMiddleware, async (req, res) => {
    try {
      if (!hasMediaStorageConfig()) {
        return res.status(503).json({
          error: "Anexos multimodais exigem bucket GCS configurado neste ambiente",
          code: "MEDIA_STORAGE_NOT_CONFIGURED",
        });
      }
      const media = await uploadMediaForUser(req.user.id, req.body || {});
      res.status(201).json({ media });
    } catch (error) {
      const status = error.statusCode || 500;
      if (status >= 500) console.error("[Media][POST]", error);
      res.status(status).json({
        error: error.message || "Erro ao enviar anexo",
        code: error.code || undefined,
      });
    }
  });

  router.delete("/api/media/uploads/:mediaRef", authMiddleware, async (req, res) => {
    try {
      const result = await deleteMediaForUser(req.user.id, req.params.mediaRef, "client_deleted");
      res.json(result);
    } catch (error) {
      const status = error.statusCode || 500;
      if (status >= 500) console.error("[Media][DELETE]", error);
      res.status(status).json({
        error: error.message || "Erro ao remover anexo",
        code: error.code || undefined,
      });
    }
  });
  return router;
}