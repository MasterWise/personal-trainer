import express from "express";
import cors from "cors";
import helmet from "helmet";
import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// Inicializa DB + migrations (side-effect: roda migrations no import)
import "./db/index.js";

// Routes
import healthRoutes from "./routes/health.js";
import authRoutes from "./routes/auth.js";
import claudeRoutes from "./routes/claude.js";
import documentRoutes from "./routes/documents.js";
import conversationRoutes from "./routes/conversations.js";
import { createGlobalRateLimit, createLoginRateLimit } from "./middleware/security.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEV_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const NGROK_ORIGIN_REGEX = /^https:\/\/[a-z0-9-]+\.ngrok-free\.app$/i;

function getAllowedOrigins() {
  return (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isAllowedOrigin(origin, allowedOrigins, isProd) {
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  if (!isProd && DEV_ALLOWED_ORIGINS.includes(origin)) {
    return true;
  }

  return NGROK_ORIGIN_REGEX.test(origin);
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
      contentSecurityPolicy: false,
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
  app.use(express.json({ limit: "10mb" }));

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
  app.use(healthRoutes());
  app.use(authRoutes());
  app.use(claudeRoutes());
  app.use(documentRoutes());
  app.use(conversationRoutes());

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
    const publicPath = path.join(__dirname, "public");

    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.use("/pt", express.static(distPath));
      console.log("Servindo build Vite de /dist");
    } else {
      app.use(express.static(publicPath));
      app.use("/pt", express.static(publicPath));
      console.log("Servindo versao estatica de /public");
    }

    // SPA catch-all
    app.get("*", (req, res) => {
      const indexPath = fs.existsSync(distPath)
        ? path.join(distPath, "index.html")
        : path.join(publicPath, "index.html");
      res.sendFile(indexPath);
    });
  }

  return app;
}
