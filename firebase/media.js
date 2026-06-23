import crypto from "crypto";
import { getFirestore, getStorageBucket, FieldValue } from "./admin.js";

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const AUDIO_MIME_TYPES = new Set(["audio/wav", "audio/x-wav"]);
const DEFAULT_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
const DEFAULT_AUDIO_MAX_BYTES = 6 * 1024 * 1024;
const DEFAULT_AUDIO_MAX_SECONDS = 60;
const DEFAULT_MEDIA_TTL_HOURS = 24;
const DEFAULT_MAX_AVAILABLE_COUNT = 8;
const DEFAULT_MAX_AVAILABLE_BYTES = 30 * 1024 * 1024;
const DEFAULT_IMAGE_INPUT_MICROS_PER_TOKEN = 0.5;
const DEFAULT_AUDIO_INPUT_MICROS_PER_TOKEN = 1;

function getEnvNumber(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getEnvFloat(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function getMediaCostRates() {
  return {
    imageInputMicrosPerToken: getEnvFloat("COST_IMAGE_INPUT_MICROS_PER_TOKEN", DEFAULT_IMAGE_INPUT_MICROS_PER_TOKEN),
    audioInputMicrosPerToken: getEnvFloat("COST_AUDIO_INPUT_MICROS_PER_TOKEN", DEFAULT_AUDIO_INPUT_MICROS_PER_TOKEN),
  };
}

function nowIso() {
  return new Date().toISOString();
}

function mediaCollection(uid) {
  return getFirestore().collection("users").doc(uid).collection("mediaUploads");
}
async function cleanupExpiredMediaForUser(uid) {
  const snap = await mediaCollection(uid)
    .where("expiresAt", "<=", new Date())
    .limit(20)
    .get();

  await Promise.all(snap.docs.map(async (docSnap) => {
    const media = docSnap.data();
    try {
      if (media?.objectName && media?.bucket) {
        await getStorageBucket(media.bucket).file(media.objectName).delete({ ignoreNotFound: true });
      }
      await docSnap.ref.set({
        status: "expired",
        deletedAt: nowIso(),
        deleteReason: "expired_before_upload",
        gsUri: FieldValue.delete(),
      }, { merge: true });
    } catch (error) {
      console.warn("[Media] cleanup expirado falhou:", docSnap.id, error?.message || error);
    }
  }));
}

async function enforceMediaQuotaForUser(uid, incomingBytes, limits) {
  const snap = await mediaCollection(uid)
    .where("status", "==", "available")
    .limit(limits.maxAvailableCount + 1)
    .get();
  let count = 0;
  let bytes = 0;
  for (const docSnap of snap.docs) {
    const media = docSnap.data();
    count += 1;
    bytes += Number(media?.sizeBytes || 0);
  }
  if (count >= limits.maxAvailableCount) {
    throw Object.assign(new Error("Limite de anexos pendentes atingido"), { statusCode: 429, code: "MEDIA_QUOTA_COUNT_EXCEEDED" });
  }
  if (bytes + incomingBytes > limits.maxAvailableBytes) {
    throw Object.assign(new Error("Limite de armazenamento temporario atingido"), { statusCode: 413, code: "MEDIA_QUOTA_BYTES_EXCEEDED" });
  }
}

function hashUid(uid) {
  return crypto.createHash("sha256").update(String(uid || "")).digest("hex").slice(0, 24);
}

function extensionForMime(mimeType) {
  const map = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/aac": "aac",
    "audio/ogg": "ogg",
    "audio/flac": "flac",
  };
  return map[mimeType] || "bin";
}

function normalizeMimeType(value) {
  const mime = String(value || "").split(";")[0].trim().toLowerCase();
  if (mime === "audio/wave") return "audio/wav";
  if (mime === "audio/x-mpeg") return "audio/mpeg";
  return mime;
}

function parseDataUrl(dataUrl) {
  const text = String(dataUrl || "");
  const match = /^data:([^;,]+)(?:;[^,]*)?;base64,([A-Za-z0-9+/=\r\n]+)$/.exec(text);
  if (!match) {
    throw Object.assign(new Error("Arquivo invalido"), { statusCode: 400, code: "MEDIA_INVALID_DATA_URL" });
  }
  const mimeType = normalizeMimeType(match[1]);
  const base64 = match[2].replace(/\s/g, "");
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length || Math.ceil(buffer.length / 3) * 4 < base64.length - 8) {
    throw Object.assign(new Error("Arquivo base64 invalido"), { statusCode: 400, code: "MEDIA_INVALID_BASE64" });
  }
  return { mimeType, buffer };
}

function hasPrefix(buffer, bytes, offset = 0) {
  if (!Buffer.isBuffer(buffer) || buffer.length < offset + bytes.length) return false;
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

function isValidSignature(mimeType, buffer) {
  if (mimeType === "image/jpeg") return hasPrefix(buffer, [0xff, 0xd8, 0xff]);
  if (mimeType === "image/png") return hasPrefix(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (mimeType === "image/webp") return buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  if (mimeType === "audio/wav" || mimeType === "audio/x-wav") return buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WAVE";
  if (mimeType === "audio/mpeg" || mimeType === "audio/mp3") return buffer.toString("ascii", 0, 3) === "ID3" || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
  if (mimeType === "audio/ogg") return buffer.toString("ascii", 0, 4) === "OggS";
  if (mimeType === "audio/flac") return buffer.toString("ascii", 0, 4) === "fLaC";
  if (mimeType === "audio/aac") return buffer[0] === 0xff && (buffer[1] === 0xf1 || buffer[1] === 0xf9);
  return false;
}

function inferKind(mimeType, requestedKind) {
  const kind = requestedKind === "audio" ? "audio" : requestedKind === "image" ? "image" : null;
  if (IMAGE_MIME_TYPES.has(mimeType)) return "image";
  if (AUDIO_MIME_TYPES.has(mimeType)) return "audio";
  return kind;
}

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
function readWavDurationMs(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 44) return null;
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") return null;

  let byteRate = null;
  let dataBytes = null;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    if (chunkStart + chunkSize > buffer.length + 1) return null;

    if (chunkId === "fmt " && chunkSize >= 16 && chunkStart + 16 <= buffer.length) {
      byteRate = buffer.readUInt32LE(chunkStart + 8);
    } else if (chunkId === "data") {
      dataBytes = Math.min(chunkSize, Math.max(0, buffer.length - chunkStart));
    }

    offset = chunkStart + chunkSize + (chunkSize % 2);
    if (byteRate && dataBytes != null) break;
  }

  if (!byteRate || !dataBytes) return null;
  return Math.ceil((dataBytes / byteRate) * 1000);
}

function getVerifiedAudioDurationMs(buffer, clientDurationMs) {
  const parsedDurationMs = readWavDurationMs(buffer);
  if (!parsedDurationMs) {
    throw Object.assign(new Error("Duracao do audio nao verificavel"), { statusCode: 400, code: "MEDIA_AUDIO_DURATION_UNVERIFIABLE" });
  }
  if (clientDurationMs) {
    const toleranceMs = Math.max(2000, parsedDurationMs * 0.15);
    if (Math.abs(parsedDurationMs - clientDurationMs) > toleranceMs) {
      throw Object.assign(new Error("Duracao do audio nao confere com o arquivo"), { statusCode: 400, code: "MEDIA_AUDIO_DURATION_MISMATCH" });
    }
  }
  return parsedDurationMs;
}

function publicMediaDoc(doc) {
  return {
    id: doc.id,
    mediaRef: doc.id,
    kind: doc.kind,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    width: doc.width || null,
    height: doc.height || null,
    durationMs: doc.durationMs || null,
    status: doc.status,
    createdAt: doc.createdAt,
    expiresAt: doc.expiresAt instanceof Date ? doc.expiresAt.toISOString() : doc.expiresAt,
  };
}

export function getMediaUploadLimits() {
  return {
    imageMaxBytes: getEnvNumber("PT_MEDIA_IMAGE_MAX_BYTES", DEFAULT_IMAGE_MAX_BYTES),
    audioMaxBytes: getEnvNumber("PT_MEDIA_AUDIO_MAX_BYTES", DEFAULT_AUDIO_MAX_BYTES),
    audioMaxSeconds: getEnvNumber("PT_MEDIA_AUDIO_MAX_SECONDS", DEFAULT_AUDIO_MAX_SECONDS),
    ttlHours: getEnvNumber("PT_MEDIA_TTL_HOURS", DEFAULT_MEDIA_TTL_HOURS),
    maxAvailableCount: getEnvNumber("PT_MEDIA_MAX_AVAILABLE_COUNT", DEFAULT_MAX_AVAILABLE_COUNT),
    maxAvailableBytes: getEnvNumber("PT_MEDIA_MAX_AVAILABLE_BYTES", DEFAULT_MAX_AVAILABLE_BYTES),
  };
}

export async function uploadMediaForUser(uid, input = {}) {
  if (!uid) throw Object.assign(new Error("Usuario nao autenticado"), { statusCode: 401 });

  const { mimeType, buffer } = parseDataUrl(input.dataUrl);
  const kind = inferKind(mimeType, input.kind);
  if (kind !== "image" && kind !== "audio") {
    throw Object.assign(new Error("Tipo de anexo nao suportado"), { statusCode: 415, code: "MEDIA_UNSUPPORTED_TYPE" });
  }
  if ((kind === "image" && !IMAGE_MIME_TYPES.has(mimeType)) || (kind === "audio" && !AUDIO_MIME_TYPES.has(mimeType))) {
    throw Object.assign(new Error("Formato de arquivo nao suportado"), { statusCode: 415, code: "MEDIA_UNSUPPORTED_MIME" });
  }
  if (!isValidSignature(mimeType, buffer)) {
    throw Object.assign(new Error("Assinatura do arquivo nao confere com o formato informado"), { statusCode: 400, code: "MEDIA_BAD_SIGNATURE" });
  }

  const limits = getMediaUploadLimits();
  const maxBytes = kind === "image" ? limits.imageMaxBytes : limits.audioMaxBytes;
  if (buffer.length > maxBytes) {
    throw Object.assign(new Error("Arquivo maior que o limite permitido"), { statusCode: 413, code: "MEDIA_TOO_LARGE" });
  }

  let durationMs = normalizeNumber(input.durationMs);
  if (kind === "audio") {
    durationMs = getVerifiedAudioDurationMs(buffer, durationMs);
    if (durationMs > limits.audioMaxSeconds * 1000) {
      throw Object.assign(new Error("Audio maior que o limite permitido"), { statusCode: 413, code: "MEDIA_AUDIO_TOO_LONG" });
    }
  }

  await cleanupExpiredMediaForUser(uid);
  await enforceMediaQuotaForUser(uid, buffer.length, limits);

  const mediaId = crypto.randomUUID();
  const bucket = getStorageBucket();
  const ext = extensionForMime(mimeType);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + limits.ttlHours * 60 * 60 * 1000);
  const objectName = `pt-media/${hashUid(uid)}/${mediaId}.${ext}`;
  const file = bucket.file(objectName);

  const docRef = mediaCollection(uid).doc(mediaId);
  let savedObject = false;

  try {
    await file.save(buffer, {
      resumable: false,
      metadata: {
        contentType: mimeType,
        cacheControl: "no-store, max-age=0",
        metadata: {
          mediaId,
          kind,
          ownerHash: hashUid(uid),
        },
      },
    });
    savedObject = true;
  } catch (error) {
    throw Object.assign(error, { statusCode: error.statusCode || 503, code: error.code || "MEDIA_STORAGE_WRITE_FAILED" });
  }

  const doc = {
    id: mediaId,
    uid,
    kind,
    mimeType,
    sizeBytes: buffer.length,
    width: normalizeNumber(input.width),
    height: normalizeNumber(input.height),
    durationMs,
    bucket: bucket.name,
    objectName,
    gsUri: `gs://${bucket.name}/${objectName}`,
    status: "available",
    createdAt: nowIso(),
    expiresAt,
    deletedAt: null,
  };
  try {
    await docRef.set(doc);
  } catch (error) {
    if (savedObject) {
      await file.delete({ ignoreNotFound: true }).catch(() => {});
    }
    throw error;
  }
  return publicMediaDoc(doc);
}

export async function deleteMediaForUser(uid, mediaRef, reason = "client_deleted") {
  if (!uid) throw Object.assign(new Error("Usuario nao autenticado"), { statusCode: 401 });
  const mediaId = String(mediaRef || "").trim();
  if (!mediaId || mediaId.length > 80) {
    throw Object.assign(new Error("mediaRef invalido"), { statusCode: 400, code: "MEDIA_REF_INVALID" });
  }

  const ref = mediaCollection(uid).doc(mediaId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw Object.assign(new Error("Anexo nao encontrado"), { statusCode: 404, code: "MEDIA_NOT_FOUND" });
  }

  const media = snap.data();
  if (media?.objectName && media?.bucket) {
    await getStorageBucket(media.bucket).file(media.objectName).delete({ ignoreNotFound: true });
  }
  await ref.set({
    status: "deleted",
    deletedAt: nowIso(),
    deleteReason: reason,
    gsUri: FieldValue.delete(),
  }, { merge: true });

  return { ok: true, mediaRef: mediaId };
}

export function sanitizeMediaBlockForStorage(block = {}) {
  if (!block || typeof block !== "object") return block;
  if (block.mediaRef || block.type === "media" || block.kind === "image" || block.kind === "audio") {
    return {
      type: "media",
      mediaRef: block.mediaRef || block.id || null,
      kind: block.kind || (block.type === "audio" ? "audio" : block.type === "image" ? "image" : null),
      mimeType: block.mimeType || block.media_type || block.source?.media_type || null,
      sizeBytes: block.sizeBytes || null,
      durationMs: block.durationMs || null,
      width: block.width || null,
      height: block.height || null,
      status: block.status || null,
    };
  }
  return block;
}

export function sanitizeMessagesForStorage(messages) {
  return (Array.isArray(messages) ? messages : []).map((message) => {
    const content = Array.isArray(message?.content)
      ? message.content.map((block) => sanitizeMediaBlockForStorage(block))
      : message?.content;
    const attachments = Array.isArray(message?.attachments)
      ? message.attachments.map((item) => sanitizeMediaBlockForStorage(item))
      : undefined;
    return {
      ...message,
      content,
      ...(attachments ? { attachments } : {}),
    };
  });
}

function collectMediaRefBlocksFromContent(content, blocks) {
  if (!Array.isArray(content)) return;
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    if (block.mediaRef) blocks.push(block);
  }
}

export function collectMediaRefBlocksFromMessages(messages) {
  const blocks = [];
  for (const message of Array.isArray(messages) ? messages : []) {
    collectMediaRefBlocksFromContent(message?.content, blocks);
    if (Array.isArray(message?.attachments)) {
      for (const attachment of message.attachments) {
        if (attachment?.mediaRef) blocks.push(attachment);
      }
    }
  }
  return blocks;
}

export function validateMediaPolicy(messages) {
  validateClaudeMessagesDoNotEmbedMedia(messages);
  const refs = collectMediaRefBlocksFromMessages(messages);
  const imageCount = refs.filter((block) => block.kind === "image" || block.type === "image").length;
  const audioCount = refs.filter((block) => block.kind === "audio" || block.type === "audio").length;
  if (refs.length > 4 || imageCount > 3 || audioCount > 1) {
    throw Object.assign(new Error("Limite de anexos por mensagem excedido"), { statusCode: 400, code: "MEDIA_LIMIT_EXCEEDED" });
  }
}

export function validateClaudeMessagesDoNotEmbedMedia(messages) {
  const messagesList = Array.isArray(messages) ? messages : [];
  for (const message of messagesList) {
    const blocks = Array.isArray(message?.content) ? message.content : [];
    for (const block of blocks) {
      if (!block || typeof block !== "object") continue;
      const hasInlineData = Boolean(block.data || block.dataUrl || block.inlineData?.data || block.source?.data);
      const hasDirectFileUri = Boolean(block.fileUri || block.gsUri || block.fileData?.fileUri || block.source?.file_uri || block.source?.fileUri);
      if (hasInlineData || hasDirectFileUri) {
        throw Object.assign(new Error("Anexos devem ser enviados por mediaRef, nunca inline"), { statusCode: 400, code: "MEDIA_INLINE_FORBIDDEN" });
      }
      if ((block.type === "media" || block.kind === "image" || block.kind === "audio") && !block.mediaRef) {
        throw Object.assign(new Error("Anexo sem mediaRef"), { statusCode: 400, code: "MEDIA_REF_REQUIRED" });
      }
    }
  }
}

async function getAvailableMedia(uid, mediaRef) {
  const mediaId = String(mediaRef || "").trim();
  if (!mediaId || mediaId.length > 80) {
    throw Object.assign(new Error("mediaRef invalido"), { statusCode: 400, code: "MEDIA_REF_INVALID" });
  }
  const snap = await mediaCollection(uid).doc(mediaId).get();
  if (!snap.exists) {
    throw Object.assign(new Error("Anexo nao encontrado"), { statusCode: 404, code: "MEDIA_NOT_FOUND" });
  }
  const media = snap.data();
  if (media.status !== "available") {
    throw Object.assign(new Error("Anexo indisponivel"), { statusCode: 409, code: "MEDIA_NOT_AVAILABLE" });
  }
  return media;
}

function shouldInlineMediaForGateway() {
  return process.env.PT_MEDIA_INLINE_FOR_GATEWAY === "true"
    || Boolean(process.env.FIREBASE_STORAGE_EMULATOR_HOST);
}

async function buildGatewayMediaSource(media) {
  if (shouldInlineMediaForGateway()) {
    if (!media.bucket || !media.objectName) {
      throw Object.assign(
        new Error("Anexo sem objeto de Storage"),
        { statusCode: 409, code: "MEDIA_OBJECT_MISSING" }
      );
    }
    const [buffer] = await getStorageBucket(media.bucket).file(media.objectName).download();
    return {
      type: "base64",
      media_type: media.mimeType,
      data: buffer.toString("base64"),
    };
  }

  return {
    type: "file",
    media_type: media.mimeType,
    file_uri: media.gsUri,
  };
}

async function resolveMediaBlock(uid, block) {
  if (!block?.mediaRef) return block;
  const media = await getAvailableMedia(uid, block.mediaRef);
  return {
    type: media.kind,
    mediaRef: media.id,
    kind: media.kind,
    mimeType: media.mimeType,
    sizeBytes: media.sizeBytes,
    durationMs: media.durationMs || block.durationMs || null,
    width: media.width || block.width || null,
    height: media.height || block.height || null,
    source: await buildGatewayMediaSource(media),
  };
}

export async function resolveGatewayPayloadMedia(uid, gatewayPayload) {
  if (!gatewayPayload || !Array.isArray(gatewayPayload.messages)) return gatewayPayload;
  const messages = [];
  for (const message of gatewayPayload.messages) {
    if (!Array.isArray(message?.content)) {
      messages.push(message);
      continue;
    }
    const content = [];
    for (const block of message.content) {
      content.push(await resolveMediaBlock(uid, block));
    }
    messages.push({ ...message, content });
  }
  return { ...gatewayPayload, messages };
}

export function estimateMediaUsageFromMessages(messages) {
  const refs = collectMediaRefBlocksFromMessages(messages);
  let imageCount = 0;
  let audioSeconds = 0;
  for (const ref of refs) {
    const kind = ref.kind || (ref.type === "audio" ? "audio" : ref.type === "image" ? "image" : null);
    if (kind === "image") imageCount += 1;
    if (kind === "audio") audioSeconds += Math.ceil((Number(ref.durationMs || 0) || 0) / 1000);
  }
  const imageTokens = imageCount * 280;
  const audioTokens = audioSeconds * 32;
  const rates = getMediaCostRates();
  return {
    imageCount,
    audioSeconds,
    imageTokens,
    audioTokens,
    mediaInputTokens: imageTokens + audioTokens,
    mediaInputCostMicros: Math.ceil(
      imageTokens * rates.imageInputMicrosPerToken
      + audioTokens * rates.audioInputMicrosPerToken
    ),
  };
}

export async function cleanupMediaRefsForPayload(uid, gatewayPayload, reason = "processed") {
  const refs = collectMediaRefBlocksFromMessages(gatewayPayload?.messages || []);
  const uniqueRefs = [...new Set(refs.map((block) => block.mediaRef).filter(Boolean))];
  await Promise.all(uniqueRefs.map(async (mediaRef) => {
    try {
      const snap = await mediaCollection(uid).doc(mediaRef).get();
      if (!snap.exists) return;
      const media = snap.data();
      if (media.objectName && media.bucket) {
        await getStorageBucket(media.bucket).file(media.objectName).delete({ ignoreNotFound: true });
      }
      await mediaCollection(uid).doc(mediaRef).set({
        status: "deleted",
        deletedAt: nowIso(),
        deleteReason: reason,
        gsUri: FieldValue.delete(),
      }, { merge: true });
    } catch (error) {
      console.warn("[Media] cleanup falhou:", mediaRef, error?.message || error);
    }
  }));
}
