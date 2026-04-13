import { Router } from "express";
import { db } from "../db/index.js";

const AI_GATEWAY_URL = process.env.AI_GATEWAY_URL || "http://localhost:3500";
const HEALTH_TIMEOUT_MS = Number.parseInt(process.env.HEALTH_TIMEOUT_MS || "3000", 10);

async function checkGateway() {
  const response = await fetch(AI_GATEWAY_URL, {
    method: "GET",
    signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
  });
  return response.status < 600;
}

export default function healthRoutes() {
  const router = Router();

  router.get("/api/health", async (req, res) => {
    const checks = {
      sqlite: false,
      gateway: false,
    };

    try {
      db.prepare("SELECT 1 as ok").get();
      checks.sqlite = true;
    } catch (error) {
      return res.status(503).json({
        status: "error",
        checks,
        reason: `sqlite: ${error.message}`,
        timestamp: new Date().toISOString(),
      });
    }

    try {
      checks.gateway = await checkGateway();
    } catch (error) {
      return res.status(503).json({
        status: "error",
        checks,
        reason: `gateway: ${error.message}`,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      status: "ok",
      checks,
      gatewayUrl: AI_GATEWAY_URL,
      storage: "sqlite",
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
