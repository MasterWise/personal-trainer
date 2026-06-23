import { Router } from "express";
import { GoogleAuth } from "google-auth-library";
import { getFirestore } from "../firebase/admin.js";

const AI_GATEWAY_URL = process.env.AI_GATEWAY_URL || "http://localhost:3500";
const HEALTH_TIMEOUT_MS = Number.parseInt(process.env.HEALTH_TIMEOUT_MS || "3000", 10);
const gatewayAuth = new GoogleAuth();
const gatewayIdTokenClients = new Map();

function normalizeHeaders(headers) {
  if (typeof headers?.entries === "function") {
    return Object.fromEntries(headers.entries());
  }
  return headers || {};
}

function getGatewayAudience() {
  return process.env.AI_GATEWAY_AUTH_AUDIENCE
    || process.env.AI_GATEWAY_AUDIENCE
    || AI_GATEWAY_URL;
}

async function getGatewayHealthHeaders() {
  if (process.env.AI_GATEWAY_AUTH_DISABLED === "true") return {};

  const audience = getGatewayAudience();
  if (!gatewayIdTokenClients.has(audience)) {
    gatewayIdTokenClients.set(audience, gatewayAuth.getIdTokenClient(audience));
  }
  const client = await gatewayIdTokenClients.get(audience);
  return normalizeHeaders(await client.getRequestHeaders());
}

async function checkGateway() {
  const response = await fetch(`${AI_GATEWAY_URL}/api/health`, {
    method: "GET",
    headers: await getGatewayHealthHeaders(),
    signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
  });
  return response.ok;
}

export default function firebaseHealthRoutes() {
  const router = Router();

  router.get("/api/health", async (req, res) => {
    const checks = { firestore: false, gateway: false };

    try {
      await getFirestore().collection("_health").doc("backend").set({
        checkedAt: new Date().toISOString(),
      }, { merge: true });
      checks.firestore = true;
    } catch (error) {
      return res.status(503).json({
        status: "error",
        checks,
        reason: `firestore: ${error.message}`,
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

    return res.json({
      status: "ok",
      checks,
      gatewayUrl: AI_GATEWAY_URL,
      storage: "firestore",
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
