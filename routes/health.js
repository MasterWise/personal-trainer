import { Router } from "express";

export default function healthRoutes() {
  const router = Router();
  router.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      hasApiKey: !!process.env.ANTHROPIC_API_KEY,
      storage: "sqlite",
      timestamp: new Date().toISOString(),
    });
  });
  return router;
}
