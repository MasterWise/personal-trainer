import crypto from "crypto";

function firstHeader(value) {
  return Array.isArray(value) ? value[0] : value;
}

function cleanRequestKind(value) {
  const kind = String(firstHeader(value) || "").trim().toLowerCase();
  return ["user", "background", "system"].includes(kind) ? kind : null;
}

function getRequestPath(req) {
  return String(req.originalUrl || req.url || "").split("?")[0] || "/";
}

function getRequestId(req, res) {
  const headerId = String(firstHeader(req.headers?.["x-request-id"]) || "").trim();
  const requestId = headerId.slice(0, 128) || crypto.randomUUID();
  if (!res.headersSent) res.setHeader("X-Request-Id", requestId);
  return requestId;
}

export function classifyRequestTraffic(req) {
  const explicitKind = cleanRequestKind(req.headers?.["x-pt-request-kind"]);
  const path = getRequestPath(req);
  const userAgent = String(firstHeader(req.headers?.["user-agent"]) || "");
  const lowerUserAgent = userAgent.toLowerCase();

  let trafficKind = explicitKind || "user";

  if (
    path === "/api/health" ||
    path === "/api/pt/health" ||
    lowerUserAgent.includes("googlestackdrivermonitoring-uptimechecks") ||
    lowerUserAgent.includes("google-cloud-scheduler") ||
    lowerUserAgent.includes("google-cloud-tasks") ||
    req.headers?.["x-cloudscheduler"] ||
    req.headers?.["x-cloudtasks-queuename"]
  ) {
    trafficKind = "system";
  }

  return {
    trafficKind,
    countAsUserRequest: trafficKind === "user",
    requestPath: path,
  };
}

export function attachRequestTrafficLogger(req, res, next) {
  if (!getRequestPath(req).startsWith("/api/")) {
    return next();
  }

  const startedAt = Date.now();
  const requestId = getRequestId(req, res);
  const traffic = classifyRequestTraffic(req);

  req.requestId = requestId;
  req.trafficKind = traffic.trafficKind;
  req.countAsUserRequest = traffic.countAsUserRequest;

  res.on("finish", () => {
    console.log(JSON.stringify({
      event: "http_request_completed",
      component: "http",
      requestId,
      method: req.method,
      path: traffic.requestPath,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      trafficKind: traffic.trafficKind,
      countAsUserRequest: traffic.countAsUserRequest,
    }));
  });

  return next();
}
