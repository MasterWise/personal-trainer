import { GoogleAuth, OAuth2Client } from "google-auth-library";
import { firebaseAiLogsRepository, firebasePendingRepository } from "./repositories.js";
import { buildGatewayPayload, extractStructuredResponse, redactSensitive } from "./payload.js";
import { debit as debitTokenBudget } from "./tokenBudget.js";
import { cleanupMediaRefsForPayload, estimateMediaUsageFromMessages, getMediaCostRates, resolveGatewayPayloadMedia } from "./media.js";

const authClient = new OAuth2Client();
const gatewayAuth = new GoogleAuth();
const gatewayIdTokenClients = new Map();
const DEFAULT_GATEWAY_TIMEOUT_MS = 500000;

function getGatewayUrl() {
  return process.env.AI_GATEWAY_URL || "http://localhost:3500";
}

function normalizeHeaders(headers) {
  if (typeof headers?.entries === "function") {
    return Object.fromEntries(headers.entries());
  }
  return headers || {};
}

export function addServerlessAuthorizationHeader(headers = {}) {
  const result = { ...headers };
  const authorization = result.Authorization || result.authorization;
  if (authorization && !result["X-Serverless-Authorization"]) {
    // Cloud Run checks this header for IAM and leaves Authorization available
    // for the gateway's app-level OIDC validation.
    result["X-Serverless-Authorization"] = authorization;
  }
  return result;
}

function parsePositiveMs(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getGatewayTimeoutMs() {
  return parsePositiveMs(process.env.GATEWAY_TIMEOUT_MS, DEFAULT_GATEWAY_TIMEOUT_MS);
}

function getEnvFloat(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function getCostRates() {
  const mediaRates = getMediaCostRates();
  return {
    textInputMicrosPerToken: getEnvFloat("COST_TEXT_INPUT_MICROS_PER_TOKEN", 0.5),
    outputMicrosPerToken: getEnvFloat("COST_OUTPUT_MICROS_PER_TOKEN", 3),
    imageInputMicrosPerToken: mediaRates.imageInputMicrosPerToken,
    audioInputMicrosPerToken: mediaRates.audioInputMicrosPerToken,
  };
}

function isTransientGatewayError(error) {
  const name = String(error?.name || "");
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  return name === "AbortError"
    || name === "TimeoutError"
    || code === "ECONNRESET"
    || code === "ETIMEDOUT"
    || code === "EAI_AGAIN"
    || message.includes("fetch failed")
    || message.includes("network")
    || message.includes("timeout");
}

function getGatewayAudience() {
  return process.env.AI_GATEWAY_AUTH_AUDIENCE
    || process.env.AI_GATEWAY_AUDIENCE
    || getGatewayUrl();
}

async function getGatewayRequestHeaders() {
  const baseHeaders = { "Content-Type": "application/json" };
  if (process.env.AI_GATEWAY_AUTH_DISABLED === "true") {
    return baseHeaders;
  }

  const audience = getGatewayAudience();
  if (!gatewayIdTokenClients.has(audience)) {
    gatewayIdTokenClients.set(audience, gatewayAuth.getIdTokenClient(audience));
  }
  const client = await gatewayIdTokenClients.get(audience);
  const authHeaders = normalizeHeaders(await client.getRequestHeaders());
  return addServerlessAuthorizationHeader({ ...baseHeaders, ...authHeaders });
}

async function postGatewayChat(gatewayPayload, timeoutMs) {
  return fetch(`${getGatewayUrl()}/api/chat`, {
    method: "POST",
    headers: await getGatewayRequestHeaders(),
    body: JSON.stringify(gatewayPayload),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function verifyWorkerRequest(req) {
  if (process.env.FIREBASE_WORKER_AUTH_DISABLED === "true") {
    return;
  }

  const expectedEmail = process.env.CLOUD_TASKS_SERVICE_ACCOUNT;
  const audience = process.env.CLOUD_TASKS_WORKER_AUDIENCE || process.env.CLOUD_TASKS_WORKER_URL;
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!expectedEmail || !audience || !token) {
    throw Object.assign(new Error("Worker sem autenticacao OIDC configurada"), { statusCode: 401 });
  }

  const ticket = await authClient.verifyIdToken({ idToken: token, audience });
  const payload = ticket.getPayload();
  if (payload?.email !== expectedEmail) {
    throw Object.assign(new Error("Service account nao autorizada para worker"), { statusCode: 403 });
  }
}

function parseQueuedPayload(item) {
  if (!item?.requestPayload) return {};
  try {
    return JSON.parse(item.requestPayload);
  } catch {
    return {};
  }
}

export async function processClaudeTask({ uid, responseId }) {
  const claim = await firebasePendingRepository.claimForProcessing(uid, responseId);
  if (!claim.claimed) {
    if (claim.status === "in_flight") {
      return { ok: false, retry: true, status: claim.status };
    }
    return { ok: true, skipped: true, status: claim.status };
  }

  const pending = claim.item;
  const queuedPayload = parseQueuedPayload(pending);
  const unresolvedGatewayPayload = queuedPayload.gatewayPayload || buildGatewayPayload(queuedPayload.body || {});
  const mediaUsageEstimate = queuedPayload.mediaUsageEstimate || estimateMediaUsageFromMessages(unresolvedGatewayPayload.messages || []);
  let gatewayPayload = unresolvedGatewayPayload;
  const startTime = Date.now();
  const timeoutMs = getGatewayTimeoutMs();

  try {
    gatewayPayload = await resolveGatewayPayloadMedia(uid, unresolvedGatewayPayload);
    let response = await postGatewayChat(gatewayPayload, timeoutMs);

    if (response.status === 410 && !gatewayPayload._sessionExpiredRetry) {
      const errData = await response.json().catch(() => ({}));
      if (errData?.code === "CLI_SESSION_EXPIRED") {
        delete gatewayPayload.interaction_context;
        gatewayPayload._sessionExpiredRetry = true;
        await new Promise((resolve) => setTimeout(resolve, 500));
        response = await postGatewayChat(gatewayPayload, timeoutMs);
      }
    }

    const data = await response.json();
    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      await firebasePendingRepository.fail(uid, responseId, { error: data.error || `HTTP ${response.status}`, data });
      await cleanupMediaRefsForPayload(uid, gatewayPayload, "gateway_failed");
      await firebaseAiLogsRepository.insert(uid, {
        messagesSent: redactSensitive(gatewayPayload.messages || []),
        messagesCount: gatewayPayload.messages?.length || 0,
        responseRaw: redactSensitive(data),
        requestPayload: redactSensitive(gatewayPayload),
        durationMs,
        success: false,
        errorMessage: data.error || `HTTP ${response.status}`,
      });
      return { ok: false, status: "failed" };
    }

    const structured = extractStructuredResponse(data);
    await firebasePendingRepository.complete(uid, responseId, {
      responseRaw: data,
      replyText: structured.replyText,
      updatesJson: structured.updatesJson,
    });

    const inputTokens = data.usage?.input_tokens || 0;
    const outputTokens = data.usage?.output_tokens || 0;
    const cachedTokens = (data.usage?.cache_creation_input_tokens || 0) + (data.usage?.cache_read_input_tokens || 0);
    const textInputTokens = Math.max(0, inputTokens - (mediaUsageEstimate.mediaInputTokens || 0));
    const costRates = getCostRates();
    const estimatedCostMicros = Math.ceil(
      textInputTokens * costRates.textInputMicrosPerToken
      + (mediaUsageEstimate.imageTokens || 0) * costRates.imageInputMicrosPerToken
      + (mediaUsageEstimate.audioTokens || 0) * costRates.audioInputMicrosPerToken
      + outputTokens * costRates.outputMicrosPerToken
    );

    await firebaseAiLogsRepository.insert(uid, {
      systemPrompt: gatewayPayload.system || null,
      messagesSent: redactSensitive(gatewayPayload.messages || []),
      messagesCount: gatewayPayload.messages?.length || 0,
      model: data.model || null,
      responseRaw: redactSensitive(data),
      responseId: data.id || null,
      replyText: structured.replyText,
      updatesJson: structured.updatesJson,
      updatesCount: structured.updatesCount,
      inputTokens: inputTokens || null,
      outputTokens: outputTokens || null,
      cachedTokens: cachedTokens || null,
      imageTokens: mediaUsageEstimate.imageTokens || null,
      audioTokens: mediaUsageEstimate.audioTokens || null,
      estimatedCostMicros: estimatedCostMicros || null,
      totalTokens: (inputTokens + outputTokens) || null,
      durationMs,
      success: true,
      requestPayload: redactSensitive(gatewayPayload),
    });

    // Debita token budget (best-effort, nao bloqueia retorno em caso de
    // erro de Firestore — o ai_log ja foi inserido como fonte de verdade).
    try {
      await debitTokenBudget(uid, {
        inputTokens,
        outputTokens,
        cachedTokens,
        imageTokens: mediaUsageEstimate.imageTokens || 0,
        audioTokens: mediaUsageEstimate.audioTokens || 0,
        imageCount: mediaUsageEstimate.imageCount || 0,
        audioSeconds: mediaUsageEstimate.audioSeconds || 0,
        estimatedCostMicros,
      });
    } catch (budgetErr) {
      console.warn("[TokenBudget] debit falhou (uid=" + uid + "):", budgetErr?.message || budgetErr);
    }

    await cleanupMediaRefsForPayload(uid, gatewayPayload, "processed");

    return { ok: true, status: "pending" };
  } catch (error) {
    if (String(error?.code || "").startsWith("MEDIA_")) {
      await firebasePendingRepository.fail(uid, responseId, { error: error.message, code: error.code });
      await cleanupMediaRefsForPayload(uid, gatewayPayload, "media_failed");
      return { ok: false, status: "failed", code: error.code };
    }
    if (isTransientGatewayError(error)) {
      console.warn("[Claude Worker] erro transitorio no gateway; mantendo in_flight para retry:", error.message);
      throw error;
    }
    await firebasePendingRepository.fail(uid, responseId, { error: error.message });
    if (typeof gatewayPayload !== "undefined") {
      await cleanupMediaRefsForPayload(uid, gatewayPayload, "worker_failed");
    }
    throw error;
  }
}

export async function handleClaudeWorker(req, res) {
  try {
    await verifyWorkerRequest(req);
    const { uid, responseId } = req.body || {};
    if (!uid || !responseId) {
      return res.status(400).json({ error: "uid e responseId sao obrigatorios" });
    }
    const result = await processClaudeTask({ uid, responseId });
    if (result.retry) {
      return res.status(503).json(result);
    }
    return res.json(result);
  } catch (error) {
    console.error("[Claude Worker]", error);
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
}
