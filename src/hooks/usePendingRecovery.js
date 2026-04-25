import { useEffect, useRef, useState, useCallback } from "react";
import { get, post } from "../services/api.js";
import { parseClaudeStructuredResponse } from "../services/claudeResponseParser.js";
import { useDocs } from "../contexts/DocsContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";
import { filterUnappliedUpdates } from "../utils/replayGuard.js";

const POLL_INTERVAL_MS = 5000;

/**
 * Hook that recovers AI responses missed while the user was away,
 * and tracks in-flight requests across page refreshes.
 *
 * On app load (after auth + docs + conversation ready), checks the backend
 * for pending/in_flight responses. Processes completed ones immediately,
 * and polls for in_flight ones until they resolve.
 *
 * @param {object} options
 * @param {boolean} options.isAuthenticated
 * @param {boolean} options.docsReady
 * @param {boolean} options.conversationReady - true after conversation is loaded from server
 * @param {string|null} options.currentConvoId
 * @param {Function} options.setMessages
 * @returns {{ recovering: boolean, recoveredCount: number, hasInFlight: boolean }}
 */
export function usePendingRecovery({ isAuthenticated, docsReady, conversationReady, currentConvoId, setMessages }) {
  const hasCheckedRef = useRef(false);
  const pollIntervalRef = useRef(null);
  const [recovering, setRecovering] = useState(false);
  const [recoveredCount, setRecoveredCount] = useState(0);
  const [hasInFlight, setHasInFlight] = useState(false);
  const { applyUpdateBatch, docs } = useDocs();
  const toast = useToast();
  // Keep a ref to currentConvoId so polling callbacks see the latest value
  const currentConvoIdRef = useRef(currentConvoId);
  currentConvoIdRef.current = currentConvoId;

  // Process a single pending response (replay mutations + add message)
  const processPendingItem = useCallback(async (item) => {
    try {
      const full = await get("/claude/pending/" + item.id);
      if (!full?.response_raw) return false;

      const rawResponse = typeof full.response_raw === "string"
        ? JSON.parse(full.response_raw)
        : full.response_raw;
      const parsed = parseClaudeStructuredResponse(rawResponse);

      // Apply document mutations (pre-screened for idempotency)
      const updates = parsed.updates || [];
      const directUpdates = updates.filter(u => !u.requiresPermission);
      if (directUpdates.length > 0) {
        const unapplied = filterUnappliedUpdates(directUpdates, docs);
        if (unapplied.length > 0) {
          await applyUpdateBatch(unapplied);
        }
      }

      // Add the AI message to the conversation
      const convoId = currentConvoIdRef.current;
      if (item.conversation_id === convoId || !item.conversation_id) {
        const aiMsg = {
          role: "assistant",
          content: parsed.reply || "...",
          _responseId: item.id,
          _recovered: true,
          timestamp: item.created_at,
        };
        setMessages(prev => [...prev, aiMsg]);
      }

      // Acknowledge
      await post("/claude/pending/" + item.id + "/ack", {}).catch(() => {});
      return true;
    } catch (e) {
      console.error("[PendingRecovery] Error processing item:", item.id, e);
      await post("/claude/pending/" + item.id + "/ack", {}).catch(() => {});
      return false;
    }
  }, [docs, applyUpdateBatch, setMessages]);

  // Poll for in_flight → pending transitions
  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) return; // already polling

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await get("/claude/pending");
        const items = res?.items || [];

        if (items.length === 0) {
          // Nothing left — stop polling
          setHasInFlight(false);
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          return;
        }

        const inFlight = items.filter(i => i.status === "in_flight");
        const pending = items.filter(i => i.status === "pending");

        // Process any newly completed responses
        let count = 0;
        for (const item of pending) {
          const ok = await processPendingItem(item);
          if (ok) count++;
        }
        if (count > 0) {
          setRecoveredCount(prev => prev + count);
          const label = count === 1
            ? "Recuperamos 1 resposta da IA"
            : `Recuperamos ${count} respostas da IA`;
          toast.show(label, "info");
        }

        // Update in-flight state
        if (inFlight.length === 0) {
          setHasInFlight(false);
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      } catch (e) {
        console.error("[PendingRecovery] Poll error:", e);
      }
    }, POLL_INTERVAL_MS);
  }, [processPendingItem, toast]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  // Main recovery effect — runs once after all gates are ready
  useEffect(() => {
    if (!isAuthenticated || !docsReady || !conversationReady) return;
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;

    let cancelled = false;

    async function recoverPending() {
      try {
        const res = await get("/claude/pending");
        const items = res?.items || [];
        if (items.length === 0 || cancelled) return;

        const inFlight = items.filter(i => i.status === "in_flight");
        const pending = items.filter(i => i.status === "pending");

        // If there are in-flight requests, show loading and start polling
        if (inFlight.length > 0) {
          setHasInFlight(true);
          startPolling();
        }

        // Process any already-completed responses
        if (pending.length > 0 && !cancelled) {
          setRecovering(true);
          let count = 0;

          for (const item of pending) {
            if (cancelled) break;
            const ok = await processPendingItem(item);
            if (ok) count++;
          }

          if (count > 0 && !cancelled) {
            setRecoveredCount(count);
            const label = count === 1
              ? "Recuperamos 1 resposta da IA que voce perdeu"
              : `Recuperamos ${count} respostas da IA que voce perdeu`;
            toast.show(label, "info");
          }
        }
      } catch (e) {
        console.error("[PendingRecovery] Error fetching pending:", e);
      } finally {
        if (!cancelled) setRecovering(false);
      }
    }

    recoverPending();
    return () => { cancelled = true; };
  }, [isAuthenticated, docsReady, conversationReady]); // eslint-disable-line react-hooks/exhaustive-deps

  return { recovering, recoveredCount, hasInFlight };
}
