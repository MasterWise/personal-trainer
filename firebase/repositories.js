import crypto from "crypto";
import { getFirestore, FieldValue } from "./admin.js";
import { getEmptyUserDefaults, getSeedUserDefaults } from "../db/defaultDocuments.js";
import { limitFirestoreText } from "./payload.js";

const PLAN_DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/;
const PLAN_START_MODES = new Set(["generate", "new_plan", "edit"]);
const DEFAULT_GATEWAY_TIMEOUT_MS = 500000;
const DEFAULT_INFLIGHT_STALE_MS = 600000;
const INFLIGHT_STALE_TIMEOUT_FACTOR = 1.5;

function nowIso() {
  return new Date().toISOString();
}

function generateId() {
  return crypto.randomUUID();
}

function userRef(uid) {
  return getFirestore().collection("users").doc(uid);
}

function documentsRef(uid) {
  return userRef(uid).collection("documents");
}

function conversationsRef(uid) {
  return userRef(uid).collection("conversations");
}

function aiLogsRef(uid) {
  return userRef(uid).collection("aiLogs");
}

function pendingRef(uid) {
  return userRef(uid).collection("pendingResponses");
}

function stateRef(uid, id) {
  return userRef(uid).collection("_state").doc(id);
}

function currentConversationStateRef(uid) {
  return stateRef(uid, "currentConversation");
}

function planStateRef(uid, planDate) {
  return stateRef(uid, `plan_${planDate.replaceAll("/", "-")}`);
}

function invitesRef() {
  return getFirestore().collection("invites");
}

function emailWhitelistRef() {
  return getFirestore().collection("emailWhitelist");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeConvoType(value) {
  return value === "plan" ? "plan" : "general";
}

function normalizePlanDate(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return PLAN_DATE_RE.test(trimmed) ? trimmed : null;
}

function normalizePlanVersion(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parsePositiveMs(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getGatewayTimeoutMs() {
  return parsePositiveMs(process.env.GATEWAY_TIMEOUT_MS, DEFAULT_GATEWAY_TIMEOUT_MS);
}

function getInflightStaleMs() {
  const configuredStaleMs = parsePositiveMs(process.env.CLOUD_TASKS_INFLIGHT_STALE_MS, DEFAULT_INFLIGHT_STALE_MS);
  const minimumStaleMs = Math.ceil(getGatewayTimeoutMs() * INFLIGHT_STALE_TIMEOUT_FACTOR);
  return Math.max(configuredStaleMs, minimumStaleMs);
}

function isStaleIso(value, staleMs) {
  const timestamp = Date.parse(value || "");
  return !Number.isFinite(timestamp) || Date.now() - timestamp > staleMs;
}

function getMessageText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === "string") return block;
        if (block?.type === "text") return String(block.text || "");
        if (block && typeof block === "object" && "text" in block) return String(block.text || "");
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  if (content == null) return "";
  return String(content);
}

function buildPreview(messages) {
  const firstUserMsg = (Array.isArray(messages) ? messages : []).find((message) => message?.role === "user");
  return getMessageText(firstUserMsg?.content).slice(0, 120);
}

function serializeConversationDoc(doc, messages = []) {
  if (!doc?.exists) return null;
  const row = doc.data();
  return {
    id: doc.id,
    preview: row.preview || "",
    messageCount: row.messageCount || 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt || row.createdAt || null,
    isCurrent: row.isCurrent === true,
    type: normalizeConvoType(row.type),
    planDate: row.planDate || null,
    planVersion: row.planVersion ?? null,
    planThreadKey: row.planThreadKey || null,
    originAction: row.originAction || null,
    cliSessionId: row.cliSessionId || null,
    messages,
  };
}

async function readMessages(conversationDoc) {
  const snap = await conversationDoc.ref.collection("messages").orderBy("order", "asc").get();
  return snap.docs.map((doc) => doc.data().message).filter(Boolean);
}

function resolveMetaInput(metaInput, current) {
  const currentData = current?.data?.() || current || {};
  const currentType = normalizeConvoType(currentData.type);
  const type = normalizeConvoType(metaInput?.type ?? currentType);
  const planDate = type === "plan"
    ? normalizePlanDate(metaInput?.planDate ?? currentData.planDate)
    : null;
  const planVersion = type === "plan"
    ? normalizePlanVersion(metaInput?.planVersion ?? currentData.planVersion)
    : null;
  const planThreadKey = type === "plan"
    ? String(metaInput?.planThreadKey ?? currentData.planThreadKey ?? "").trim() || null
    : null;
  const originAction = type === "plan"
    ? String(metaInput?.originAction ?? currentData.originAction ?? "").trim() || null
    : null;

  return { type, planDate, planVersion, planThreadKey, originAction };
}

async function seedDocuments(uid, docs) {
  const batch = getFirestore().batch();
  const updatedAt = nowIso();
  for (const { key, content } of docs) {
    batch.set(documentsRef(uid).doc(key), { key, content, updatedAt }, { merge: true });
  }
  await batch.commit();
}

export async function ensureUserProfile(decodedUser, { seed = "empty" } = {}) {
  const ref = userRef(decodedUser.uid);
  const snap = await ref.get();
  const timestamp = nowIso();

  if (!snap.exists) {
    await ref.set({
      uid: decodedUser.uid,
      name: decodedUser.name || decodedUser.email || decodedUser.uid,
      email: decodedUser.email || null,
      isAdminMirror: decodedUser.is_admin === true,
      createdAt: timestamp,
      updatedAt: timestamp,
      provider: "firebase-auth",
    });
    await seedDocuments(decodedUser.uid, seed === "renata" ? getSeedUserDefaults() : getEmptyUserDefaults());
  } else {
    await ref.set({
      name: decodedUser.name || decodedUser.email || decodedUser.uid,
      email: decodedUser.email || null,
      isAdminMirror: decodedUser.is_admin === true,
      updatedAt: timestamp,
    }, { merge: true });
  }

  const current = (await ref.get()).data();
  return {
    id: decodedUser.uid,
    name: current.name || decodedUser.name || decodedUser.uid,
    isAdmin: decodedUser.is_admin === true,
    email: current.email || null,
  };
}

export const firebaseUsersRepository = {
  async me(decodedUser) {
    const snap = await userRef(decodedUser.uid).get();
    if (!snap.exists) return null;
    const data = snap.data();
    return {
      id: decodedUser.uid,
      name: data.name || decodedUser.name || decodedUser.uid,
      isAdmin: decodedUser.is_admin === true,
      email: data.email || decodedUser.email || null,
    };
  },

  async hasAnyUser() {
    const snap = await getFirestore().collection("users").limit(1).get();
    return !snap.empty;
  },
};

export const firebaseDocumentsRepository = {
  async list(uid) {
    const snap = await documentsRef(uid).get();
    const documents = {};
    for (const doc of snap.docs) {
      documents[doc.id] = doc.data().content;
    }
    return documents;
  },

  async get(uid, key) {
    const snap = await documentsRef(uid).doc(key).get();
    if (!snap.exists) return null;
    return { key: snap.id, ...snap.data() };
  },

  async upsert(uid, key, content) {
    const updatedAt = nowIso();
    await documentsRef(uid).doc(key).set({ key, content, updatedAt }, { merge: true });
    return { key, content, updatedAt };
  },

  async upsertMany(uid, docs) {
    const updatedAt = nowIso();
    const batch = getFirestore().batch();
    for (const { key, content } of docs) {
      batch.set(documentsRef(uid).doc(key), { key, content, updatedAt }, { merge: true });
    }
    await batch.commit();
    return docs.map(({ key }) => ({ key, updatedAt }));
  },

  async reset(uid) {
    await seedDocuments(uid, getEmptyUserDefaults());
    await firebaseConversationsRepository.clearCurrent(uid);
  },

  async restore(uid) {
    await seedDocuments(uid, getSeedUserDefaults());
    await firebaseConversationsRepository.clearCurrent(uid);
  },
};

export const firebaseConversationsRepository = {
  async listArchived(uid) {
    const snap = await conversationsRef(uid)
      .where("isCurrent", "==", false)
      .where("type", "==", "general")
      .orderBy("updatedAt", "desc")
      .limit(100)
      .get();

    return Promise.all(snap.docs.map(async (doc) => serializeConversationDoc(doc, await readMessages(doc))));
  },

  async getCurrent(uid) {
    const stateSnap = await currentConversationStateRef(uid).get();
    const stateConversationId = stateSnap.exists ? stateSnap.data().conversationId || null : null;
    if (stateConversationId) {
      const doc = await conversationsRef(uid).doc(stateConversationId).get();
      if (doc.exists) {
        return serializeConversationDoc(doc, await readMessages(doc));
      }
    }

    const snap = await conversationsRef(uid)
      .where("isCurrent", "==", true)
      .orderBy("updatedAt", "desc")
      .limit(1)
      .get();

    if (snap.empty) {
      return null;
    }
    const doc = snap.docs[0];
    return serializeConversationDoc(doc, await readMessages(doc));
  },

  async saveCurrent(uid, { conversationId, messages, meta, cliSessionId }) {
    const db = getFirestore();
    const now = nowIso();
    const convos = conversationsRef(uid);
    const currentStateRef = currentConversationStateRef(uid);

    return db.runTransaction(async (tx) => {
      const stateSnap = await tx.get(currentStateRef);
      const stateConversationId = stateSnap.exists ? stateSnap.data().conversationId || null : null;
      const currentSnap = await tx.get(convos.where("isCurrent", "==", true).limit(10));

      let convoId = stateConversationId || currentSnap.docs[0]?.id || null;
      if (conversationId && convoId && convoId !== String(conversationId)) {
        throw Object.assign(new Error("Conversa atual mudou; recarregue antes de salvar"), { statusCode: 409 });
      }
      if (!convoId) {
        convoId = conversationId ? String(conversationId) : generateId();
      }

      let targetRef = convos.doc(convoId);
      let targetDoc = await tx.get(targetRef);
      if (!targetDoc.exists && conversationId && !stateConversationId && currentSnap.empty) {
        convoId = generateId();
        targetRef = convos.doc(convoId);
        targetDoc = null;
      }
      const oldMessages = targetDoc?.exists ? await tx.get(targetRef.collection("messages")) : { docs: [] };
      const targetData = targetDoc?.exists ? targetDoc.data() : {};
      const resolvedMeta = resolveMetaInput(meta || {}, targetData);
      const createdAt = targetData.createdAt || now;

      for (const doc of currentSnap.docs) {
        if (doc.id !== convoId) tx.set(doc.ref, { isCurrent: false, updatedAt: now }, { merge: true });
      }
      for (const doc of oldMessages.docs) {
        tx.delete(doc.ref);
      }
      messages.forEach((message, index) => {
        tx.set(targetRef.collection("messages").doc(String(index).padStart(6, "0")), {
          order: index,
          message,
          createdAt: now,
        });
      });
      tx.set(targetRef, {
        preview: buildPreview(messages),
        messageCount: messages.length,
        isCurrent: true,
        createdAt,
        updatedAt: now,
        type: resolvedMeta.type,
        planDate: resolvedMeta.planDate,
        planVersion: resolvedMeta.planVersion,
        planThreadKey: resolvedMeta.planThreadKey,
        originAction: resolvedMeta.originAction,
        cliSessionId: typeof cliSessionId === "string" ? cliSessionId : targetData.cliSessionId || null,
      }, { merge: true });
      tx.set(currentStateRef, { conversationId: convoId, updatedAt: now }, { merge: true });

      return { id: convoId, ...resolvedMeta };
    });
  },

  async archiveCurrent(uid) {
    const db = getFirestore();
    const convos = conversationsRef(uid);
    const currentStateRef = currentConversationStateRef(uid);
    return db.runTransaction(async (tx) => {
      const stateSnap = await tx.get(currentStateRef);
      const currentId = stateSnap.exists ? stateSnap.data().conversationId || null : null;
      const currentSnap = await tx.get(convos.where("isCurrent", "==", true).limit(10));
      const stateDocIsCurrent = currentSnap.docs.some((doc) => doc.id === currentId);
      const stateOnlyRef = currentId && !stateDocIsCurrent ? convos.doc(currentId) : null;
      const stateOnlySnap = stateOnlyRef ? await tx.get(stateOnlyRef) : null;
      const resolvedCurrentId = currentSnap.docs[0]?.id || (stateOnlySnap?.exists ? currentId : null);

      const updatedAt = nowIso();
      if (!resolvedCurrentId) {
        tx.set(currentStateRef, { conversationId: null, updatedAt }, { merge: true });
        return null;
      }
      for (const doc of currentSnap.docs) {
        tx.set(doc.ref, { isCurrent: false, updatedAt }, { merge: true });
      }
      if (stateOnlySnap?.exists) {
        tx.set(convos.doc(resolvedCurrentId), { isCurrent: false, updatedAt }, { merge: true });
      }
      tx.set(currentStateRef, { conversationId: null, updatedAt }, { merge: true });
      return resolvedCurrentId;
    });
  },

  async activate(uid, conversationId) {
    const ref = conversationsRef(uid).doc(conversationId);

    const currentStateRef = currentConversationStateRef(uid);
    const activatedId = await getFirestore().runTransaction(async (tx) => {
      const targetSnap = await tx.get(ref);
      const currentSnap = await tx.get(conversationsRef(uid).where("isCurrent", "==", true).limit(10));
      if (!targetSnap.exists) return null;
      const updatedAt = nowIso();
      for (const doc of currentSnap.docs) {
        if (doc.id !== conversationId) tx.set(doc.ref, { isCurrent: false, updatedAt }, { merge: true });
      }
      tx.set(ref, { isCurrent: true, updatedAt }, { merge: true });
      tx.set(currentStateRef, { conversationId, updatedAt }, { merge: true });
      return conversationId;
    });
    if (!activatedId) return null;

    const activated = await ref.get();
    return serializeConversationDoc(activated, await readMessages(activated));
  },

  async startPlan(uid, { planDate, mode }) {
    const normalizedDate = normalizePlanDate(planDate);
    if (!normalizedDate) {
      throw Object.assign(new Error("Campo 'planDate' invalido (use DD/MM/YYYY)"), { statusCode: 400 });
    }
    if (!PLAN_START_MODES.has(mode)) {
      throw Object.assign(new Error("Campo 'mode' invalido"), { statusCode: 400 });
    }

    const db = getFirestore();
    const now = nowIso();
    const convos = conversationsRef(uid);
    const currentStateRef = currentConversationStateRef(uid);
    const planControlRef = planStateRef(uid, normalizedDate);
    const originAction = mode === "generate" ? "generate_plan" : mode === "new_plan" ? "new_plan" : "edit_plan";

    const convoId = await db.runTransaction(async (tx) => {
      const planStateSnap = await tx.get(planControlRef);
      const latestSnap = await tx.get(convos
        .where("type", "==", "plan")
        .where("planDate", "==", normalizedDate)
        .orderBy("planVersion", "desc")
        .orderBy("updatedAt", "desc")
        .limit(1));
      const currentSnap = await tx.get(convos.where("isCurrent", "==", true).limit(10));

      const latestDoc = latestSnap.docs[0] || null;
      const planState = planStateSnap.exists ? planStateSnap.data() : {};
      const latestData = latestDoc?.data?.() || {};
      const latestVersion = normalizePlanVersion(planState.latestVersion)
        || normalizePlanVersion(latestData.planVersion)
        || 0;
      const existingThreadKey = planState.planThreadKey || latestData.planThreadKey || null;

      if (mode === "generate" && latestVersion > 0) {
        throw Object.assign(new Error("Ja existe conversa de plano para esta data"), { statusCode: 409 });
      }

      const nextVersion = latestVersion + 1;
      const planThreadKey = existingThreadKey || generateId();
      const nextConvoId = generateId();
      const ref = convos.doc(nextConvoId);

      for (const doc of currentSnap.docs) {
        tx.set(doc.ref, { isCurrent: false, updatedAt: now }, { merge: true });
      }
      tx.set(ref, {
        preview: "",
        messageCount: 0,
        isCurrent: true,
        createdAt: now,
        updatedAt: now,
        type: "plan",
        planDate: normalizedDate,
        planVersion: nextVersion,
        planThreadKey,
        originAction,
        cliSessionId: null,
      });
      tx.set(currentStateRef, { conversationId: nextConvoId, updatedAt: now }, { merge: true });
      tx.set(planControlRef, {
        planDate: normalizedDate,
        latestConversationId: nextConvoId,
        latestVersion: nextVersion,
        planThreadKey,
        updatedAt: now,
      }, { merge: true });

      return nextConvoId;
    });

    return serializeConversationDoc(await convos.doc(convoId).get(), []);
  },

  async getLatestPlan(uid, planDate) {
    const snap = await conversationsRef(uid)
      .where("type", "==", "plan")
      .where("planDate", "==", planDate)
      .orderBy("planVersion", "desc")
      .orderBy("updatedAt", "desc")
      .limit(1)
      .get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return serializeConversationDoc(doc, await readMessages(doc));
  },

  async listPlanHistory(uid, planDate) {
    const snap = await conversationsRef(uid)
      .where("type", "==", "plan")
      .where("planDate", "==", planDate)
      .orderBy("planVersion", "desc")
      .orderBy("updatedAt", "desc")
      .get();
    return Promise.all(snap.docs.map(async (doc) => serializeConversationDoc(doc, [])));
  },

  async delete(uid, conversationId) {
    const ref = conversationsRef(uid).doc(conversationId);
    const snap = await ref.get();
    if (!snap.exists) return false;
    const messages = await ref.collection("messages").get();
    const batch = getFirestore().batch();
    for (const doc of messages.docs) batch.delete(doc.ref);
    batch.delete(ref);
    const stateSnap = await currentConversationStateRef(uid).get();
    if (stateSnap.exists && stateSnap.data().conversationId === conversationId) {
      batch.set(currentConversationStateRef(uid), { conversationId: null, updatedAt: nowIso() }, { merge: true });
    }
    await batch.commit();
    return true;
  },

  async clearCurrent(uid) {
    const db = getFirestore();
    await db.runTransaction(async (tx) => {
      const currentSnap = await tx.get(conversationsRef(uid).where("isCurrent", "==", true).limit(10));
      const updatedAt = nowIso();
      for (const doc of currentSnap.docs) {
        tx.set(doc.ref, { isCurrent: false, updatedAt }, { merge: true });
      }
      tx.set(currentConversationStateRef(uid), { conversationId: null, updatedAt }, { merge: true });
    });
  },
};

export const firebaseEmailWhitelistRepository = {
  async add({ email, addedBy, label }) {
    const normalized = normalizeEmail(email);
    if (!isValidEmail(normalized)) {
      throw Object.assign(new Error("E-mail invalido"), { statusCode: 400 });
    }
    const addedAt = nowIso();
    await emailWhitelistRef().doc(normalized).set({
      email: normalized,
      label: typeof label === "string" && label.trim() ? label.trim() : null,
      addedBy,
      addedAt,
      consumedBy: null,
      consumedAt: null,
    }, { merge: true });
    return { email: normalized, addedAt };
  },

  async get(email) {
    const snap = await emailWhitelistRef().doc(normalizeEmail(email)).get();
    return snap.exists ? snap.data() : null;
  },

  async remove(email) {
    const ref = emailWhitelistRef().doc(normalizeEmail(email));
    const snap = await ref.get();
    if (!snap.exists) return false;
    await ref.delete();
    return true;
  },

  async list() {
    const snap = await emailWhitelistRef().orderBy("addedAt", "desc").limit(100).get();
    return snap.docs.map((doc) => doc.data());
  },

  async markConsumed(email, uid) {
    await emailWhitelistRef().doc(normalizeEmail(email)).set({
      consumedBy: uid,
      consumedAt: nowIso(),
    }, { merge: true });
  },
};

export const firebaseInvitesRepository = {
  async create({ createdBy, ttlHours }) {
    const ttl = Number.isFinite(ttlHours) && ttlHours > 0 ? ttlHours : 48;
    const code = crypto.randomBytes(6).toString("base64url");
    const createdAt = nowIso();
    const expiresAt = new Date(Date.now() + ttl * 60 * 60 * 1000).toISOString();
    await invitesRef().doc(code).set({ code, createdBy, createdAt, expiresAt, usedBy: null, usedAt: null });
    return { code, expiresAt, ttlHours: ttl };
  },

  async get(code) {
    const snap = await invitesRef().doc(code).get();
    return snap.exists ? snap.data() : null;
  },

  async markUsed(code, uid) {
    await invitesRef().doc(code).set({ usedBy: uid, usedAt: nowIso() }, { merge: true });
  },

  async consume(code, uid) {
    const ref = invitesRef().doc(code);
    return getFirestore().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return { ok: false, statusCode: 404, message: "Convite nao encontrado" };
      const invite = snap.data();
      if (invite.usedBy) return { ok: false, statusCode: 410, message: "Convite ja utilizado" };
      if (new Date(invite.expiresAt) < new Date()) {
        return { ok: false, statusCode: 410, message: "Convite expirado" };
      }
      tx.set(ref, { usedBy: uid, usedAt: nowIso() }, { merge: true });
      return { ok: true, invite };
    });
  },

  async list(createdBy) {
    const snap = await invitesRef().where("createdBy", "==", createdBy).orderBy("createdAt", "desc").limit(50).get();
    return snap.docs.map((doc) => doc.data());
  },

  async delete(code, createdBy) {
    const ref = invitesRef().doc(code);
    const snap = await ref.get();
    if (!snap.exists) return false;
    const invite = snap.data();
    if (invite.createdBy !== createdBy || invite.usedBy) return false;
    await ref.delete();
    return true;
  },
};

export const firebaseAiLogsRepository = {
  async insert(uid, log) {
    const id = log.id || generateId();
    const { text: responseRaw, ...responseMeta } = limitFirestoreText(log.responseRaw);
    const { text: requestPayload, ...requestMeta } = limitFirestoreText(log.requestPayload);
    await aiLogsRef(uid).doc(id).set({
      id,
      createdAt: log.createdAt || nowIso(),
      systemPrompt: log.systemPrompt || null,
      systemPromptLength: log.systemPrompt?.length || 0,
      messagesSent: log.messagesSent || null,
      messagesCount: log.messagesCount || 0,
      model: log.model || null,
      responseRaw,
      responseRawMeta: responseMeta,
      responseId: log.responseId || null,
      replyText: log.replyText || null,
      updatesJson: log.updatesJson || null,
      updatesCount: log.updatesCount || 0,
      inputTokens: log.inputTokens || null,
      outputTokens: log.outputTokens || null,
      totalTokens: log.totalTokens || null,
      durationMs: log.durationMs || 0,
      success: log.success === true,
      errorMessage: log.errorMessage || null,
      requestPayload,
      requestPayloadMeta: requestMeta,
    });
    return id;
  },

  async list(uid, limit) {
    const snap = await aiLogsRef(uid).orderBy("createdAt", "desc").limit(Math.min(limit || 50, 200)).get();
    return snap.docs.map((doc) => doc.data());
  },

  async get(uid, id) {
    const snap = await aiLogsRef(uid).doc(id).get();
    return snap.exists ? snap.data() : null;
  },

  async deleteAll(uid) {
    const snap = await aiLogsRef(uid).limit(500).get();
    const batch = getFirestore().batch();
    for (const doc of snap.docs) batch.delete(doc.ref);
    await batch.commit();
  },
};

export const firebasePendingRepository = {
  async createQueued(uid, payload) {
    const responseId = generateId();
    const createdAt = nowIso();
    const messages = Array.isArray(payload.messages) ? payload.messages : [];
    const lastUserMsg = [...messages].reverse().find((message) => message?.role === "user");
    const expiresAt = new Date(Date.now() + 86400000).toISOString();
    const { text: requestPayload, ...requestMeta } = limitFirestoreText(payload.requestPayload);
    await pendingRef(uid).doc(responseId).set({
      id: responseId,
      conversationId: payload.conversationId || null,
      cliSessionId: payload.cliSessionId || null,
      triggerMessage: lastUserMsg ? JSON.stringify(lastUserMsg) : null,
      requestPayload,
      requestPayloadMeta: requestMeta,
      responseRaw: null,
      replyText: null,
      updatesJson: null,
      status: "queued",
      createdAt,
      updatedAt: createdAt,
      expiresAt,
      taskName: null,
    });
    return { responseId, createdAt };
  },

  async setTaskName(uid, responseId, taskName) {
    await pendingRef(uid).doc(responseId).set({ taskName, updatedAt: nowIso() }, { merge: true });
  },

  async claimForProcessing(uid, responseId) {
    const ref = pendingRef(uid).doc(responseId);
    const staleMs = getInflightStaleMs();
    return getFirestore().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return { claimed: false, status: "missing" };
      const current = snap.data();
      if (current.status === "in_flight" && !isStaleIso(current.updatedAt, staleMs)) {
        return { claimed: false, status: current.status };
      }
      if (current.status !== "queued" && current.status !== "in_flight") {
        return { claimed: false, status: current.status };
      }
      tx.set(ref, { status: "in_flight", updatedAt: nowIso(), attempts: FieldValue.increment(1) }, { merge: true });
      return { claimed: true, item: { id: responseId, ...current } };
    });
  },

  async complete(uid, responseId, { responseRaw, replyText, updatesJson }) {
    const { text, ...meta } = limitFirestoreText(responseRaw);
    await pendingRef(uid).doc(responseId).set({
      status: "pending",
      responseRaw: text,
      responseRawMeta: meta,
      replyText,
      updatesJson,
      updatedAt: nowIso(),
    }, { merge: true });
  },

  async fail(uid, responseId, errorPayload) {
    const { text, ...meta } = limitFirestoreText(errorPayload);
    const processedAt = nowIso();
    await pendingRef(uid).doc(responseId).set({
      status: "failed",
      responseRaw: text,
      responseRawMeta: meta,
      processedAt,
      updatedAt: processedAt,
    }, { merge: true });
  },

  async list(uid) {
    const snap = await pendingRef(uid)
      .where("status", "in", ["queued", "in_flight", "pending"])
      .orderBy("createdAt", "asc")
      .get();
    return snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        conversation_id: data.conversationId,
        cli_session_id: data.cliSessionId,
        trigger_message: data.triggerMessage,
        reply_text: data.replyText,
        updates_json: data.updatesJson,
        status: data.status,
        created_at: data.createdAt,
      };
    });
  },

  async get(uid, responseId) {
    const snap = await pendingRef(uid).doc(responseId).get();
    if (!snap.exists) return null;
    const data = snap.data();
    return {
      id: snap.id,
      user_id: uid,
      conversation_id: data.conversationId,
      cli_session_id: data.cliSessionId,
      trigger_message: data.triggerMessage,
      response_raw: data.responseRaw,
      reply_text: data.replyText,
      updates_json: data.updatesJson,
      status: data.status,
      created_at: data.createdAt,
      processed_at: data.processedAt || null,
    };
  },

  async ack(uid, responseId) {
    const ref = pendingRef(uid).doc(responseId);
    return getFirestore().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return null;
      const data = snap.data();
      if (data.status === "pending") {
        tx.set(ref, { status: "processed", processedAt: nowIso(), updatedAt: nowIso() }, { merge: true });
        return "processed";
      }
      return data.status;
    });
  },
};
