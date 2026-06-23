import express from "express";
import cors from "cors";
import helmet from "helmet";
import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { createGlobalRateLimit, createLoginRateLimit } from "./middleware/security.js";
import { attachRequestTrafficLogger } from "./middleware/requestTraffic.js";
import { isFirebaseBackendEnabled } from "./config/backend.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEV_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const NGROK_ORIGIN_REGEX = /^https:\/\/[a-z0-9-]+\.ngrok-free\.app$/i;
const CSP_REPORT_ONLY = process.env.CSP_REPORT_ONLY === "true";

function getAllowedOrigins() {
  return (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isAllowedOrigin(origin, allowedOrigins, isProd) {
  if (isProd && NGROK_ORIGIN_REGEX.test(origin)) {
    return false;
  }

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  if (!isProd && DEV_ALLOWED_ORIGINS.includes(origin)) {
    return true;
  }

  return !isProd && NGROK_ORIGIN_REGEX.test(origin);
}

export async function createApp(options = {}) {
  const isDev = options.isDev ?? process.env.NODE_ENV === "development";
  const isProd = process.env.NODE_ENV === "production";
  const enableSpa = options.enableSpa ?? true;
  const allowedOrigins = getAllowedOrigins();
  const globalRateLimit = createGlobalRateLimit();
  const loginRateLimit = createLoginRateLimit();

  const app = express();

  // Behind Caddy/ngrok in production, trust one proxy hop so rate-limit sees client IPs.
  if (isProd) {
    app.set("trust proxy", 1);
  }

  // Middleware
  app.use(
    helmet({
      contentSecurityPolicy: isProd ? {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "https://www.gstatic.com", "https://apis.google.com"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
          imgSrc: ["'self'", "data:", "blob:"],
          mediaSrc: ["'self'", "blob:"],
          connectSrc: ["'self'", "https://*.googleapis.com", "https://*.firebaseio.com", "https://*.firebaseapp.com", "https://*.firebasestorage.app"],
          frameSrc: ["'self'", "https://*.firebaseapp.com", "https://*.web.app", "https://accounts.google.com"],
          manifestSrc: ["'self'"],
          workerSrc: ["'self'", "blob:"],
        },
        reportOnly: CSP_REPORT_ONLY,
      } : false,
      crossOriginEmbedderPolicy: false,
      hsts: isProd
        ? { maxAge: 15552000, includeSubDomains: true }
        : false,
    })
  );
  app.use((req, res, next) => {
    res.setHeader("X-XSS-Protection", "1; mode=block");
    next();
  });
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) {
          return callback(null, true);
        }

        if (isAllowedOrigin(origin, allowedOrigins, isProd)) {
          return callback(null, true);
        }

        return callback(null, false);
      },
    })
  );
  app.use(express.json({ limit: "12mb" }));
  app.use(attachRequestTrafficLogger);

  // CSRF protection: reject non-JSON content types on mutations with a body.
  // Allows empty-body POSTs (e.g., logout, reset) to pass through.
  app.use("/api", (req, res, next) => {
    if (["POST", "PUT", "DELETE"].includes(req.method)) {
      const hasBody = req.headers["content-length"] && req.headers["content-length"] !== "0";
      if (hasBody) {
        const ct = req.headers["content-type"] || "";
        if (!ct.includes("application/json")) {
          return res.status(415).json({ error: "Content-Type deve ser application/json" });
        }
      }
    }
    next();
  });

  // Rewrite /api/pt/* -> /api/* (acesso direto sem Caddy)
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/pt/") || req.path === "/api/pt") {
      req.url = req.url.replace("/api/pt", "/api");
    }
    next();
  });

  app.use("/api", globalRateLimit);
  app.use("/api/auth/login", loginRateLimit);

  // API Routes (before static/vite middleware)
  if (isFirebaseBackendEnabled()) {
    const { default: healthRoutes } = await import("./routes/firebaseHealth.js");
    const { default: authRoutes } = await import("./routes/firebaseAuth.js");
    const { default: claudeRoutes } = await import("./routes/firebaseClaude.js");
    const { default: mediaRoutes } = await import("./routes/firebaseMedia.js");
    const { default: documentRoutes } = await import("./routes/firebaseDocuments.js");
    const { default: conversationRoutes } = await import("./routes/firebaseConversations.js");
    app.use(healthRoutes());
    app.use(authRoutes());
    app.use(claudeRoutes());
    app.use(mediaRoutes());
    app.use(documentRoutes());
    app.use(conversationRoutes());
  } else {
    // Inicializa DB + migrations apenas no runtime SQLite local/VPS.
    await import("./db/index.js");
    const { default: healthRoutes } = await import("./routes/health.js");
    const { default: authRoutes } = await import("./routes/auth.js");
    const { default: claudeRoutes } = await import("./routes/claude.js");
    const { default: mediaRoutes } = await import("./routes/media.js");
    const { default: documentRoutes } = await import("./routes/documents.js");
    const { default: conversationRoutes } = await import("./routes/conversations.js");
    app.use(healthRoutes());
    app.use(authRoutes());
    app.use(claudeRoutes());
    app.use(mediaRoutes());
    app.use(documentRoutes());
    app.use(conversationRoutes());
  }

  if (!enableSpa) {
    return app;
  }

  if (isDev) {
    // Development mode: Vite HMR
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });

    app.use(vite.middlewares);

    // SPA fallback with Vite transform
    app.use("*", async (req, res, next) => {
      try {
        if (req.originalUrl.startsWith("/api/")) return next();

        const html = await vite.transformIndexHtml(
          req.originalUrl,
          fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8")
        );
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (e) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });

    console.log("Modo desenvolvimento (Vite HMR ativo)");
  } else {
    // Production mode: serve static files
    const distPath = path.join(__dirname, "dist");
    if (!fs.existsSync(distPath)) {
      throw new Error("Build de producao ausente em /dist. Execute o build antes de subir o servico.");
    }

    app.use(express.static(distPath));
    app.use("/pt", express.static(distPath));
    console.log("Servindo build Vite de /dist");

    app.use("/api", (req, res) => {
      res.status(404).json({ error: "Rota de API nao encontrada" });
    });

    // SPA catch-all
    app.get("*", (req, res) => {
      if (req.originalUrl.startsWith("/api/")) {
        return res.status(404).json({ error: "Rota de API nao encontrada" });
      }
      return res.sendFile(path.join(distPath, "index.html"));
    });
  }

  return app;
}
