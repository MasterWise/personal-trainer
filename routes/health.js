import { Router } from "express";

export default function healthRoutes() {
  const router = Router();
  router.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      gatewayUrl: process.env.AI_GATEWAY_URL || "http://localhost:3500",
      storage: "sqlite",
      timestamp: new Date().toISOString(),
    });
  });
  return router;
}
