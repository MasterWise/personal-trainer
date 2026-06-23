import { Router } from "express";
import { db } from "../db/index.js";

const AI_GATEWAY_URL = process.env.AI_GATEWAY_URL || "http://localhost:3500";
const HEALTH_TIMEOUT_MS = Number.parseInt(process.env.HEALTH_TIMEOUT_MS || "3000", 10);

function internalHealthDetails() {
  if (process.env.HEALTH_INCLUDE_INTERNAL_URLS !== "true" && process.env.NODE_ENV === "production") {
    return {};
  }
  return { gatewayUrl: AI_GATEWAY_URL };
}

async function checkGateway() {
  const response = await fetch(`${AI_GATEWAY_URL}/api/health`, {
    method: "GET",
    signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
  });
  return response.ok;
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
      storage: "sqlite",
      timestamp: new Date().toISOString(),
      ...internalHealthDetails(),
    });
  });

  return router;
}
