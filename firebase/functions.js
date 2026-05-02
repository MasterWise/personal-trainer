import "dotenv/config";
import { onRequest } from "firebase-functions/v2/https";
import { createApp } from "../app.js";
import { handleClaudeWorker } from "./worker.js";

const region = process.env.FUNCTIONS_REGION
  || process.env.FIREBASE_FUNCTIONS_REGION
  || "southamerica-east1";
const serviceAccount = process.env.FUNCTIONS_SERVICE_ACCOUNT
  || process.env.FIREBASE_FUNCTIONS_SERVICE_ACCOUNT
  || undefined;
let appPromise;

function getExpressApp() {
  process.env.FIREBASE_BACKEND = "true";
  appPromise ||= createApp({ enableSpa: false });
  return appPromise;
}

export const api = onRequest({
  region,
  timeoutSeconds: 60,
  memory: "512MiB",
  serviceAccount,
}, async (req, res) => {
  const app = await getExpressApp();
  return app(req, res);
});

export const claudeWorker = onRequest({
  region,
  timeoutSeconds: 540,
  memory: "1GiB",
  concurrency: 5,
  serviceAccount,
}, handleClaudeWorker);
