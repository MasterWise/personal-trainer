import { CloudTasksClient } from "@google-cloud/tasks";
import { processClaudeTask } from "./worker.js";
import { firebasePendingRepository } from "./repositories.js";

let cachedClient;

function getClient() {
  cachedClient ||= new CloudTasksClient();
  return cachedClient;
}

function requireTaskEnv() {
  const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;
  const location = process.env.CLOUD_TASKS_LOCATION;
  const queue = process.env.CLOUD_TASKS_QUEUE;
  const workerUrl = process.env.CLOUD_TASKS_WORKER_URL;
  const serviceAccountEmail = process.env.CLOUD_TASKS_SERVICE_ACCOUNT;

  if (!project || !location || !queue || !workerUrl || !serviceAccountEmail) {
    return null;
  }

  return { project, location, queue, workerUrl, serviceAccountEmail };
}

function envFlag(name) {
  return String(process.env[name] || "").trim().toLowerCase() === "true";
}

function isFirebaseFunctionsEmulator() {
  return envFlag("FUNCTIONS_EMULATOR")
    || Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST);
}

function enqueueInlineClaudeTask({ uid, responseId }) {
  queueMicrotask(() => {
    processClaudeTask({ uid, responseId }).catch((error) => {
      console.error("[Cloud Tasks Inline]", error);
    });
  });
  return { mode: "inline", taskName: null };
}

export async function enqueueClaudeTask({ uid, responseId }) {
  const config = requireTaskEnv();

  if (envFlag("TASKS_EMULATE_INLINE") || envFlag("FIREBASE_TASKS_EMULATE_INLINE")) {
    return enqueueInlineClaudeTask({ uid, responseId });
  }

  if (!config && isFirebaseFunctionsEmulator()) {
    return enqueueInlineClaudeTask({ uid, responseId });
  }

  if (!config) {
    if (process.env.CLOUD_TASKS_ALLOW_DISABLED === "true") {
      return { mode: "disabled", taskName: null };
    }
    throw new Error("Cloud Tasks nao configurado para o backend Firebase");
  }

  const parent = getClient().queuePath(config.project, config.location, config.queue);
  const taskName = getClient().taskPath(config.project, config.location, config.queue, responseId);
  const body = Buffer.from(JSON.stringify({ uid, responseId })).toString("base64");
  const [task] = await getClient().createTask({
    parent,
    task: {
      name: taskName,
      httpRequest: {
        httpMethod: "POST",
        url: config.workerUrl,
        headers: { "Content-Type": "application/json" },
        body,
        oidcToken: {
          serviceAccountEmail: config.serviceAccountEmail,
          audience: process.env.CLOUD_TASKS_WORKER_AUDIENCE || config.workerUrl,
        },
      },
    },
  });

  await firebasePendingRepository.setTaskName(uid, responseId, task.name);
  return { mode: "cloud-tasks", taskName: task.name };
}
