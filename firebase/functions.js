import "dotenv/config";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { createApp } from "../app.js";
import { handleClaudeWorker } from "./worker.js";

const region = process.env.FUNCTIONS_REGION
  || process.env.FIREBASE_FUNCTIONS_REGION
  || "southamerica-east1";
const defaultApiServiceAccount = "pt-api-runtime@mw-personal-trainer.iam.gserviceaccount.com";
const defaultWorkerServiceAccount = "pt-worker@mw-personal-trainer.iam.gserviceaccount.com";
const apiServiceAccount = process.env.FUNCTIONS_API_SERVICE_ACCOUNT
  || process.env.FIREBASE_FUNCTIONS_API_SERVICE_ACCOUNT
  || process.env.FUNCTIONS_SERVICE_ACCOUNT
  || process.env.FIREBASE_FUNCTIONS_SERVICE_ACCOUNT
  || defaultApiServiceAccount;
const workerServiceAccount = process.env.FUNCTIONS_CLAUDE_WORKER_SERVICE_ACCOUNT
  || process.env.FIREBASE_FUNCTIONS_CLAUDE_WORKER_SERVICE_ACCOUNT
  || process.env.FUNCTIONS_WORKER_SERVICE_ACCOUNT
  || process.env.FIREBASE_FUNCTIONS_WORKER_SERVICE_ACCOUNT
  || process.env.FUNCTIONS_SERVICE_ACCOUNT
  || process.env.FIREBASE_FUNCTIONS_SERVICE_ACCOUNT
  || defaultWorkerServiceAccount;
const bootstrapSecret = defineSecret("BOOTSTRAP_SECRET");
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
  serviceAccount: apiServiceAccount,
  invoker: "public",
  secrets: [bootstrapSecret],
}, async (req, res) => {
  const app = await getExpressApp();
  return app(req, res);
});

export const claudeWorker = onRequest({
  region,
  timeoutSeconds: 540,
  memory: "1GiB",
  concurrency: 5,
  serviceAccount: workerServiceAccount,
}, handleClaudeWorker);
