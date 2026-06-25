import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "../../contexts/ThemeContext.jsx";
import { buildRelevantPlanContext, buildSystemInstructions, buildSystemContext } from "../../data/prompts.js";
import { getAsyncClaudeResponse, sendMessage } from "../../services/claudeService.js";
import { deleteMediaAttachment, uploadMediaAttachment } from "../../services/mediaService.js";
import {
  getClaudeResponseUserMessage,
  isClaudeResponseParseError,
  parseClaudeStructuredResponse,
} from "../../services/claudeResponseParser.js";
import { hashString } from "../../utils/stringHash.js";
import { AUDIO_MAX_DURATION_MS, blobToDataUrl, prepareImageFile, startWavRecorder } from "../../utils/mediaClient.js";
import { lockPlanUpdateToDate } from "../../utils/planUpdateGuard.js";
import { enforcePlanUserCheckedPermission } from "../../utils/planPermissionGuard.js";
import { enforcePerfilPermission } from "../../utils/perfilPermissionGuard.js";
import { buildPermissionGroups } from "../../utils/permissionGroups.js";
import ChatMsg from "./ChatMsg.jsx";
import PermCard from "./PermCard.jsx";

import { post } from "../../services/api.js";
import { useDocs } from "../../contexts/DocsContext.jsx";

const MULTIMODAL_MESSAGE_PLACEHOLDER = "Anexo enviado.";
const MULTIMODAL_TURN_INSTRUCTION = "Use o conteudo multimodal deste turno como parte da mensagem do usuario e responda diretamente ao que foi comunicado, sem mencionar formato, anexo ou processamento.";
const RECORDING_WAVE_BARS = [0.28, 0.62, 0.4, 0.86, 0.52, 0.74, 0.34, 0.95, 0.6, 0.42, 0.82, 0.48, 0.7, 0.36, 0.9, 0.56, 0.76, 0.32];

function formatAttachmentLabel(attachment) {
  if (attachment.kind === "audio") {
    const seconds = Math.max(1, Math.round((attachment.durationMs || 0) / 1000));
    return `Audio (${seconds}s)`;
  }
  return attachment.kind === "image" ? "Imagem" : "Anexo";
}

function getAuthoredText(message, attachments) {
  const text = typeof message.content === "string" ? message.content : String(message.content || "");
  if (!attachments.length) return text;
  return text.trim() === MULTIMODAL_MESSAGE_PLACEHOLDER ? "" : text;
}

function buildMultimodalTurnText(text) {
  if (!text.trim()) return MULTIMODAL_TURN_INSTRUCTION;
  return `${text}\n\n[${MULTIMODAL_TURN_INSTRUCTION}]`;
}

function toStoredAttachment(attachment) {
  return {
    mediaRef: attachment.mediaRef,
    kind: attachment.kind,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes || null,
    durationMs: attachment.durationMs || null,
    width: attachment.width || null,
    height: attachment.height || null,
    label: attachment.label || formatAttachmentLabel(attachment),
    status: "ready",
  };
}

export function toApiMessage(message, includeMediaRefs = false) {
  const attachments = Array.isArray(message.attachments) ? message.attachments : [];
  const text = getAuthoredText(message, attachments);
  if (!attachments.length) return { role: message.role, content: text };

  if (!includeMediaRefs || message.role !== "user") {
    const labels = attachments.map(formatAttachmentLabel).join(", ");
    return {
      role: message.role,
      content: `${text || "Mensagem multimodal enviada."}\n[Turno anterior com conteudo multimodal: ${labels}]`,
    };
  }

  const blocks = [{ type: "text", text: buildMultimodalTurnText(text) }];
  for (const attachment of attachments) {
    if (!attachment.mediaRef) continue;
    blocks.push({
      type: "media",
      mediaRef: attachment.mediaRef,
      kind: attachment.kind,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes || null,
      durationMs: attachment.durationMs || null,
      width: attachment.width || null,
      height: attachment.height || null,
    });
  }
  return { role: message.role, content: blocks };
}

function ImageIcon() {
  return (
    <svg className="pt-chat__attach-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="8.5" cy="9" r="1.5" />
      <path d="M4.5 17.5 10 12l3.2 3.2 2.2-2.2 4.1 4.5" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg className="pt-chat__attach-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 8.5h3.1L8.8 6h6.4l1.7 2.5H20a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7.5a2 2 0 0 1 2-2Z" />
      <circle cx="12" cy="14" r="3.2" />
    </svg>
  );
}

function SendActionIcon({ recording = false, voice = false }) {
  if (recording) {
    return (
      <span className="pt-chat__send-icon" aria-hidden="true">
        <svg className="pt-chat__send-svg pt-chat__send-svg--recording" viewBox="0 0 24 24" focusable="false">
          <rect x="7" y="7" width="10" height="10" rx="2.2" />
        </svg>
      </span>
    );
  }

  if (voice) {
    return (
      <span className="pt-chat__send-icon" aria-hidden="true">
        <svg className="pt-chat__send-svg pt-chat__send-svg--voice" viewBox="0 0 24 24" focusable="false">
          <path d="M12 4a3 3 0 0 0-3 3v4a3 3 0 0 0 6 0V7a3 3 0 0 0-3-3Z" />
          <path d="M6.5 11a5.5 5.5 0 0 0 11 0" />
          <path d="M12 16.5V20" />
          <path d="M9 20h6" />
        </svg>
      </span>
    );
  }

  return (
    <span className="pt-chat__send-icon" aria-hidden="true">
      <svg className="pt-chat__send-svg pt-chat__send-svg--send" viewBox="0 0 24 24" focusable="false">
        <path className="pt-chat__send-plane" d="M3.5 11.6 20 4l-5.4 16-3.4-6.4-7.7-2Z" />
        <path className="pt-chat__send-plane" d="M11.2 13.6 20 4" />
      </svg>
    </span>
  );
}

function RecordingWave({ level = 0, seconds = 0 }) {
  const safeLevel = Math.max(0.06, Math.min(1, Number(level) || 0));
  return (
    <div className="pt-chat__recording-wave" role="status" aria-live="polite" aria-label={`Gravando audio ha ${seconds} segundos`}>
      <span className="pt-chat__recording-pill">REC {seconds}s</span>
      <div className="pt-chat__wave-bars" aria-hidden="true">
        {RECORDING_WAVE_BARS.map((seed, index) => {
          const focus = 1 - Math.abs(index - (RECORDING_WAVE_BARS.length - 1) / 2) / 10;
          const height = 7 + (seed * 14) + (safeLevel * 23 * Math.max(0.35, focus));
          return (
            <span
              key={index}
              className="pt-chat__wave-bar"
              style={{
                height: `${Math.round(height)}px`,
                opacity: 0.38 + safeLevel * 0.5 + seed * 0.12,
                animationDelay: `${index * 38}ms`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function ChatTab({
  docs,
  messages,
  setMessages,
  docsReady,
  docsStatus = "loading",
  docsError = null,
  setTab,
  onGeneratePlan,
  generating,
  planoDate,
  conversationMeta = { type: "general" },
  readOnly = false,
  inputPlaceholder,
  contextBadge,
  conversationId = null,
  cliSessionId: cliSessionIdProp = null,
  hasInFlight = false,
  onAsyncResponseQueued = null,
  pendingPerms = [],
  onAddPermissionGroups = null,
  onResolvePermission = null,
}) {
  const { applyUpdateBatch } = useDocs();
  const { theme } = useTheme();
  const c = theme.colors;
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [recordingLevel, setRecordingLevel] = useState(0);
  const [loading, setLoading] = useState(false);
  // Use the CLI session ID from App.jsx (unified namespace); fall back to local UUID
  const [localSessionId] = useState(() => crypto.randomUUID());
  const sessionId = cliSessionIdProp || localSessionId;
  const bottomRef = useRef(null);
  const taRef = useRef(null);
  const imageInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const attachmentMenuRef = useRef(null);
  const recorderRef = useRef(null);
  const recordingRequestIdRef = useRef(0);
  const recordingIntervalRef = useRef(null);
  const recordingTimeoutRef = useRef(null);
  const attachmentsRef = useRef([]);
  const isPlanConversation = conversationMeta?.type === "plan";
  const planLoadingLabel = generating && isPlanConversation
    ? (conversationMeta?.originAction === "new_plan" ? "Gerando novo plano..." : "Gerando plano do dia...")
    : null;
  const planDateLock = isPlanConversation
    ? (conversationMeta?.planDate || planoDate || new Date().toLocaleDateString("pt-BR"))
    : null;
  const contextBadgeIcon = readOnly
    ? "🕘"
    : (generating && isPlanConversation
        ? "🌿"
        : (conversationMeta?.originAction === "edit_plan" ? "✏️" : "📋"));

  const hasUploadingAttachment = attachments.some((attachment) => attachment.status === "uploading");
  const readyAttachments = attachments.filter((attachment) => attachment.status === "ready" && attachment.mediaRef);

  function revokeAttachmentPreview(attachment) {
    if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
  }

  function releaseUploadedAttachment(attachment) {
    if (attachment?.mediaRef) {
      deleteMediaAttachment(attachment.mediaRef).catch((error) => {
        console.warn("deleteMediaAttachment:", error?.message || error);
      });
    }
  }

  function discardComposerAttachment(attachment) {
    revokeAttachmentPreview(attachment);
    releaseUploadedAttachment(attachment);
  }

  async function uploadPreparedAttachment(prepared) {
    const localId = crypto.randomUUID();
    const optimistic = {
      localId,
      kind: prepared.kind,
      mimeType: prepared.mimeType,
      previewUrl: prepared.previewUrl,
      sizeBytes: prepared.sizeBytes,
      durationMs: prepared.durationMs || null,
      width: prepared.width || null,
      height: prepared.height || null,
      status: "uploading",
      label: formatAttachmentLabel(prepared),
    };
    setAttachments((prev) => [...prev, optimistic]);

    try {
      const dataUrl = await blobToDataUrl(prepared.blob);
      const media = await uploadMediaAttachment({
        dataUrl,
        kind: prepared.kind,
        mimeType: prepared.mimeType,
        width: prepared.width,
        height: prepared.height,
        durationMs: prepared.durationMs,
      });
      setAttachments((prev) => prev.map((attachment) => (
        attachment.localId === localId
          ? { ...attachment, ...media, mediaRef: media.mediaRef || media.id, status: "ready", label: formatAttachmentLabel({ ...attachment, ...media }) }
          : attachment
      )));
    } catch (error) {
      setAttachments((prev) => prev.map((attachment) => (
        attachment.localId === localId
          ? { ...attachment, status: "error", error: error?.message || "Falha ao enviar anexo" }
          : attachment
      )));
    }
  }

  async function handleImageSelection(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const prepared = await prepareImageFile(file);
      await uploadPreparedAttachment(prepared);
    } catch (error) {
      const localId = crypto.randomUUID();
      setAttachments((prev) => [...prev, {
        localId,
        kind: "image",
        status: "error",
        label: "Imagem",
        error: error?.message || "Falha ao preparar imagem",
      }]);
    }
  }

  function clearRecordingTimers() {
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
    recordingIntervalRef.current = null;
    recordingTimeoutRef.current = null;
  }

  async function stopRecording() {
    recordingRequestIdRef.current += 1;
    const recorder = recorderRef.current;
    recorderRef.current = null;
    clearRecordingTimers();
    setRecording(false);
    setRecordingElapsed(0);
    setRecordingLevel(0);
    if (!recorder) return;
    const prepared = await recorder.stop();
    if (prepared) await uploadPreparedAttachment(prepared);
  }

  async function startRecording(requestId = recordingRequestIdRef.current + 1) {
    recordingRequestIdRef.current = requestId;
    try {
      const recorder = await startWavRecorder();
      if (requestId !== recordingRequestIdRef.current) {
        await recorder.stop().catch(() => {});
        return false;
      }
      recorderRef.current = recorder;
      setRecording(true);
      setRecordingElapsed(0);
      setRecordingLevel(0.08);
      const startedAt = Date.now();
      recordingIntervalRef.current = setInterval(() => {
        setRecordingElapsed(Math.min(AUDIO_MAX_DURATION_MS, Date.now() - startedAt));
        setRecordingLevel(recorder.getLevel?.() || 0);
      }, 120);
      recordingTimeoutRef.current = setTimeout(() => {
        stopRecording().catch((error) => console.error("stopRecording:", error));
      }, AUDIO_MAX_DURATION_MS);
      return true;
    } catch (error) {
      if (requestId !== recordingRequestIdRef.current) return false;
      const localId = crypto.randomUUID();
      setAttachments((prev) => [...prev, {
        localId,
        kind: "audio",
        status: "error",
        label: "Audio",
        error: error?.message || "Falha ao iniciar gravacao",
      }]);
      return false;
    }
  }

  function removeAttachment(localId) {
    setAttachments((prev) => {
      const target = prev.find((attachment) => attachment.localId === localId);
      discardComposerAttachment(target);
      return prev.filter((attachment) => attachment.localId !== localId);
    });
  }

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    return () => {
      clearRecordingTimers();
      recorderRef.current?.stop?.().catch(() => {});
      attachmentsRef.current.forEach(discardComposerAttachment);
    };
  }, []);
  useEffect(() => {
    if (!attachmentsOpen) return undefined;
    const handlePointerDown = (event) => {
      if (!attachmentMenuRef.current?.contains(event.target)) {
        setAttachmentsOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setAttachmentsOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [attachmentsOpen]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading, generating, pendingPerms]);
  useEffect(() => {
    if (!readOnly) return;
    setInput("");
    attachmentsRef.current.forEach(discardComposerAttachment);
    attachmentsRef.current = [];
    setAttachments([]);
    setAttachmentsOpen(false);
  }, [readOnly]);

  async function send() {
    const text = input.trim();
    const attachmentsToSend = readyAttachments.map(toStoredAttachment);
    if ((!text && attachmentsToSend.length === 0) || loading || hasInFlight || hasUploadingAttachment || !docsReady || readOnly) return;
    const userMsg = { role: "user", content: text || MULTIMODAL_MESSAGE_PLACEHOLDER, attachments: attachmentsToSend };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setAttachmentsOpen(false);
    attachments.forEach(revokeAttachmentPreview);
    attachmentsRef.current = [];
    setAttachments([]);
    if (taRef.current) taRef.current.style.height = "auto";
    setLoading(true);

    try {
      const currentMsgs = [...messages, userMsg];
      const apiMsgs = currentMsgs.slice(-40).map((m, idx, arr) => toApiMessage(m, idx === arr.length - 1));
      let nomePerfil = "Renata";
      try { nomePerfil = JSON.parse(docs.perfil || "{}").nome || "Renata"; } catch { /* ignore */ }
      const normalizedMeta = {
        conversationType: conversationMeta?.type === "plan" ? "plan" : "general",
        planDate: conversationMeta?.type === "plan" ? (conversationMeta?.planDate || planoDate) : (planoDate || new Date().toLocaleDateString("pt-BR")),
        planVersion: Number.isInteger(conversationMeta?.planVersion) ? conversationMeta.planVersion : null,
        originAction: conversationMeta?.originAction || null,
      };
      const instructionPlanDate = normalizedMeta.conversationType === "plan" ? (normalizedMeta.planDate || new Date().toLocaleDateString("pt-BR")) : new Date().toLocaleDateString("pt-BR");
      const planContext = buildRelevantPlanContext(docs, normalizedMeta);
      const data = await sendMessage(
        apiMsgs,
        buildSystemInstructions(nomePerfil, instructionPlanDate),
        buildSystemContext(docs, normalizedMeta),
        {
          ...normalizedMeta,
          planContext,
          _sessionId: sessionId,
          conversationId,
        }
      );
      const asyncResponse = getAsyncClaudeResponse(data);
      if (asyncResponse) {
        onAsyncResponseQueued?.(asyncResponse);
        setLoading(false);
        return;
      }

      const responseId = data?.responseId || data?._responseId || null;
      const parsed = parseClaudeStructuredResponse(data);
      const updates = parsed.updates || [];
      const preparedEntries = updates
        .map((u, idx) => {
          const locked = lockPlanUpdateToDate(u, planDateLock, docs.plano, { allowPlanReplaceAll: true });
          if (!locked) console.warn(`[ChatTab] Update #${idx} dropped by planUpdateGuard:`, { file: u.file, action: u.action, targetDate: u.targetDate });
          return locked;
        })
        .filter(Boolean)
        .map((u) => enforcePlanUserCheckedPermission(u, docs.plano))
        .map((entry) => {
          if (entry.requiresPermission) return entry;
          const perfilCheck = enforcePerfilPermission(entry.update, docs.perfil);
          return perfilCheck.requiresPermission ? perfilCheck : entry;
        });

      const direct = preparedEntries
        .filter((entry) => !entry.update?.requiresPermission)
        .map((entry) => entry.update);
      const perms = preparedEntries.filter((entry) => entry.update?.requiresPermission);

      // Apply direct updates and capture before/after revisions
      const appliedUpdates = direct.length > 0 ? await applyUpdateBatch(direct) : [];

      if (perms.length > 0 && onAddPermissionGroups) {
        onAddPermissionGroups(buildPermissionGroups(perms));
      }

      const aiMsg = { role: "assistant", content: parsed.reply || "...", appliedUpdates, _responseId: responseId };
      setMessages(prev => [...prev, aiMsg]);

      // Acknowledge the pending response so it's not replayed on reconnect
      if (responseId) {
        post("/claude/pending/" + responseId + "/ack", {}, { requestKind: "background" }).catch(() => {});
      }
    } catch (e) {
      if (isClaudeResponseParseError(e)) {
        console.error("send() parse error:", e.code, e.meta, e);
        setMessages(prev => [...prev, { role: "assistant", content: getClaudeResponseUserMessage(e) }]);
      } else {
        console.error("send() exception:", e);
        setMessages(prev => [...prev, { role: "assistant", content: `Erro: ${e?.message || String(e)}` }]);
      }
    }
    setLoading(false);
  }

  async function handlePerm(permId, approved) {
    if (onResolvePermission) {
      await onResolvePermission(permId, approved);
    }
  }

  async function handleRevert(msgIndex, revisionIndex) {
    const msg = messages[msgIndex];
    if (!msg?.appliedUpdates?.[revisionIndex]) return;
    const rev = msg.appliedUpdates[revisionIndex];
    const currentDoc = docs[rev.docKey] || "";
    if (hashString(currentDoc) !== rev.afterHash) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Não reverti essa alteração porque o documento mudou depois dela. Recarregue o contexto ou aplique uma correção nova.",
      }]);
      return;
    }
    const revertUpdate = lockPlanUpdateToDate(
      { file: rev.file, action: "replace_all", content: rev.before },
      planDateLock,
      docs.plano,
      { allowPlanReplaceAll: true }
    );
    if (!revertUpdate) return;
    await applyUpdateBatch([revertUpdate]);
    setMessages(prev => prev.map((m, i) => {
      if (i !== msgIndex) return m;
      const newUpdates = [...(m.appliedUpdates || [])];
      newUpdates[revisionIndex] = { ...newUpdates[revisionIndex], canRevert: false, revertedAt: new Date().toISOString() };
      return { ...m, appliedUpdates: newUpdates };
    }));
  }

  const quickActions = ["Como foi minha semana?", "Lanche da tarde ideal 🍎", "Estou na TPM 😩", "O que jantar hoje?"];
  const firstSessionActions = [
    "Meu objetivo é perder peso 🎯",
    "Quero ganhar massa muscular 💪",
    "Conta como é minha rotina 📅",
    "Minhas preferências alimentares 🥗",
    "Estou com pouca disposição 😴",
    "Não sei por onde começar 🤔",
  ];
  const showWelcome = docsReady && messages.length === 0 && !generating && !isPlanConversation;

  const todayKey = (planoDate || new Date().toLocaleDateString("pt-BR"));
  const hasPlanToday = (() => {
    try {
      const dict = JSON.parse(docs?.plano || "{}");
      return !!dict?.[todayKey];
    } catch { return false; }
  })();
  const isFirstSession = (() => {
    try {
      const perfilObj = JSON.parse(docs?.perfil || "{}");
      // Pos-onboarding o usuario ja tem nome + objetivo + restricoes/treinos.
      // Idade e peso_kg sao capturados pela IA via chat — enquanto faltarem,
      // mantem welcome "Prazer em te conhecer" para sinalizar descoberta inicial.
      return !(perfilObj.idade && perfilObj.peso_kg);
    } catch { return true; }
  })();

  const hasTextInput = input.trim().length > 0;
  const hasReadyAttachments = readyAttachments.length > 0;
  const canSend = (hasTextInput || hasReadyAttachments) && !(loading || generating || hasInFlight || hasUploadingAttachment || recording) && docsReady && !readOnly;
  const canRecord = !hasTextInput && !hasReadyAttachments && !(loading || generating || hasInFlight || hasUploadingAttachment) && docsReady && !readOnly;
  const canUseAttachments = !readOnly && docsReady && !generating && !hasInFlight && !recording;
  const sendButtonEnabled = canSend || canRecord || recording;
  const recordingSeconds = Math.max(0, Math.ceil(recordingElapsed / 1000));
  const sendButtonTitle = recording
    ? "Parar gravação"
    : canSend
      ? "Enviar mensagem"
      : "Gravar áudio";
  const sendButtonLabel = recording
    ? `Parar gravação de áudio, ${recordingSeconds} segundos`
    : canSend
      ? "Enviar mensagem"
      : "Gravar áudio";

  function handleSendClick(event) {
    event.preventDefault();
    if (!sendButtonEnabled) return;
    if (recording) {
      stopRecording().catch((error) => console.error("stopRecording:", error));
      return;
    }
    if (canSend) {
      send();
      return;
    }
    if (canRecord) startRecording().catch((error) => console.error("startRecording:", error));
  }

  // Auto-resize textarea up to 3 visible lines, then scroll
  const autoResizeTextarea = useCallback((el) => {
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 22;
    const maxHeight = lineHeight * 3 + 22; // 3 lines + vertical padding
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, []);

  return (
    <div className="pt-chat">
      <div className="pt-chat__messages">
        {!docsReady && docsStatus !== "error" && <div style={{ textAlign: "center", marginTop: "40px", color: c.textMuted, fontFamily: theme.font, fontSize: "14px" }}>Carregando memória...</div>}
        {docsStatus === "error" && (
          <div style={{ textAlign: "center", marginTop: "40px", color: c.danger || "#C05A3A", fontFamily: theme.font, fontSize: "14px", padding: "0 20px" }}>
            {docsError || "Erro ao carregar memória. Tente recarregar o app."}
          </div>
        )}

        {docsReady && contextBadge && (
          <div style={{ padding: "8px 12px 0" }}>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 10px",
              borderRadius: "999px",
              background: `${c.primary}12`,
              color: c.primary,
              border: `1px solid ${c.primary}25`,
              fontFamily: theme.font,
              fontSize: "11px",
              fontWeight: "700",
            }}>
              {contextBadgeIcon} {contextBadge}
            </div>
          </div>
        )}

        {showWelcome && (
          <div className="pt-chat__welcome">
            <div className="pt-chat__welcome-avatar">🌿</div>
            {isFirstSession ? (
              <>
                <h3 className="pt-chat__welcome-heading">Prazer em te conhecer!</h3>
                <p className="pt-chat__welcome-subtitle">Antes de criar um plano, quero entender você melhor. Conta sobre seus objetivos, rotina e preferências.</p>
                <div className="pt-chat__quick-actions" style={{ marginTop: "22px", width: "100%", maxWidth: "310px" }}>
                  {firstSessionActions.map(s => (
                    <button key={s} className="pt-chat__quick-action" onClick={() => { setInput(s); taRef.current?.focus(); }}>
                      {s}
                    </button>
                  ))}
                </div>
              </>
            ) : hasPlanToday ? (
              <>
                <h3 className="pt-chat__welcome-heading">Olá!</h3>
                <p className="pt-chat__welcome-subtitle">Estou aqui para te acompanhar. Como você está hoje?</p>
                <button onClick={() => setTab && setTab("plano")}
                  style={{ marginTop: "22px", width: "100%", maxWidth: "310px", padding: "14px 20px", background: `linear-gradient(135deg,${c.primaryLight},${c.primary})`, color: "#FFF", border: "none", borderRadius: "16px", fontFamily: theme.font, fontSize: "15px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", boxShadow: `0 4px 16px ${c.primary}40` }}>
                  📋 Ver plano de hoje
                </button>
                <div className="pt-chat__quick-actions" style={{ marginTop: "12px", width: "100%", maxWidth: "310px" }}>
                  {quickActions.map(s => (
                    <button key={s} className="pt-chat__quick-action" onClick={() => { setInput(s); taRef.current?.focus(); }}>
                      {s}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h3 className="pt-chat__welcome-heading">Olá!</h3>
                <p className="pt-chat__welcome-subtitle">Estou aqui para te acompanhar. Como você está hoje?</p>
                <button onClick={onGeneratePlan} disabled={generating}
                  style={{ marginTop: "22px", width: "100%", maxWidth: "310px", padding: "14px 20px", background: generating ? `${c.primaryLight}80` : `linear-gradient(135deg,${c.primaryLight},${c.primary})`, color: "#FFF", border: "none", borderRadius: "16px", fontFamily: theme.font, fontSize: "15px", fontWeight: "700", cursor: generating ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", boxShadow: `0 4px 16px ${c.primary}40` }}>
                  {generating ? "🌿 Gerando plano..." : "✨ Gerar plano do dia"}
                </button>
                <div className="pt-chat__quick-actions" style={{ marginTop: "12px", width: "100%", maxWidth: "310px" }}>
                  {quickActions.map(s => (
                    <button key={s} className="pt-chat__quick-action" onClick={() => { setInput(s); taRef.current?.focus(); }}>
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {messages.map((m, i) => (
          <ChatMsg key={i} msg={m} msgIndex={i} setTab={setTab} onRevert={handleRevert} />
        ))}

        {(loading || generating || hasInFlight) && (
          <div className="pt-chat__row pt-chat__row--assistant">
            <div className="pt-chat__avatar">🌿</div>
            <div className="pt-chat__bubble pt-chat__bubble--assistant" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div className="pt-chat__loading">
                {[0, 1, 2].map(i => <div key={i} className="pt-chat__loading-dot" />)}
              </div>
              {planLoadingLabel && (
                <div style={{ fontFamily: theme.font, fontSize: "12px", color: c.textMuted }}>
                  {planLoadingLabel}
                </div>
              )}
            </div>
          </div>
        )}

        {pendingPerms.map(p => (
          <PermCard key={p.id} prompt={p.prompt} onYes={() => handlePerm(p.id, true)} onNo={() => handlePerm(p.id, false)} />
        ))}

        <div ref={bottomRef} />
      </div>

      <div className="pt-chat__input-area">
        <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleImageSelection} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" hidden onChange={handleImageSelection} />
        <div className="pt-chat__composer">
          {attachments.length > 0 && (
            <div className="pt-chat__attachments" aria-label="Anexos selecionados">
              {attachments.map((attachment) => (
                <div key={attachment.localId} className={`pt-chat__attachment pt-chat__attachment--${attachment.status}`}>
                  {attachment.kind === "image" && attachment.previewUrl ? (
                    <img src={attachment.previewUrl} alt="" className="pt-chat__attachment-thumb" />
                  ) : (
                    <span className="pt-chat__attachment-icon">{attachment.kind === "audio" ? "REC" : "IMG"}</span>
                  )}
                  <span className="pt-chat__attachment-label">
                    {attachment.status === "uploading" ? "Enviando..." : attachment.status === "error" ? (attachment.error || "Falha no anexo") : attachment.label}
                  </span>
                  <button type="button" className="pt-chat__attachment-remove" onClick={() => removeAttachment(attachment.localId)} aria-label="Remover anexo">×</button>
                </div>
              ))}
            </div>
          )}
          <div className="pt-chat__input-row">
            <div className="pt-chat__attach" ref={attachmentMenuRef}>
              <button
                type="button"
                className={`pt-chat__tool pt-chat__tool--attach ${attachmentsOpen ? "pt-chat__tool--open" : ""}`}
                onClick={() => setAttachmentsOpen((open) => !open)}
                disabled={!canUseAttachments}
                title="Adicionar anexo"
                aria-label="Adicionar anexo"
                aria-haspopup="menu"
                aria-expanded={attachmentsOpen}
              >
                +
              </button>
              {attachmentsOpen && (
                <div className="pt-chat__attach-menu" role="menu" aria-label="Tipos de anexo">
                  <button type="button" role="menuitem" className="pt-chat__attach-option" title="Anexar imagem" aria-label="Anexar imagem" onClick={() => { setAttachmentsOpen(false); imageInputRef.current?.click(); }}>
                    <ImageIcon />
                  </button>
                  <button type="button" role="menuitem" className="pt-chat__attach-option" title="Abrir câmera" aria-label="Abrir câmera" onClick={() => { setAttachmentsOpen(false); cameraInputRef.current?.click(); }}>
                    <CameraIcon />
                  </button>
                </div>
              )}
            </div>
            <div className={`pt-chat__text-field ${recording ? "pt-chat__text-field--recording" : ""}`}>
              <textarea ref={taRef} value={input}
                onChange={e => { setInput(e.target.value); autoResizeTextarea(e.target); }}
                onKeyDown={e => {
                  // Shift+Enter envia (atalho desktop). Enter puro mantém quebra de linha
                  // (importante no mobile, onde Enter no teclado virtual significa "nova linha").
                  if (e.key === "Enter" && e.shiftKey && !e.nativeEvent?.isComposing) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={docsReady ? (inputPlaceholder || "Escreva aqui...") : "Carregando..."}
                disabled={!docsReady || readOnly || generating || hasInFlight || recording} rows={1}
                aria-hidden={recording ? "true" : undefined}
                className="pt-chat__textarea" />
              {recording && <RecordingWave level={recordingLevel} seconds={recordingSeconds} />}
            </div>
            <button
              type="button"
              onClick={handleSendClick}
              disabled={!sendButtonEnabled}
              title={sendButtonTitle}
              aria-label={sendButtonLabel}
              className={`pt-chat__send ${canSend ? "pt-chat__send--active" : ""} ${canRecord && !recording ? "pt-chat__send--recordable" : ""} ${!canSend && canRecord && !recording ? "pt-chat__send--voice-ready" : ""} ${recording ? "pt-chat__send--recording" : ""}`}
            >
              <SendActionIcon recording={recording} voice={!canSend} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
