import { useCallback, useEffect, useRef, useState } from "react";

const DISMISS_KEY = "pt-coach-install-dismissed-at";
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

function detectStandalone() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS Safari legacy
  if (typeof window.navigator !== "undefined" && window.navigator.standalone) return true;
  return false;
}

function detectIos() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator?.userAgent || "";
  return /iPhone|iPad|iPod/i.test(ua);
}

function isDismissActive() {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage?.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number.parseInt(raw, 10);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

/**
 * Hook que captura o evento `beforeinstallprompt` do navegador e expõe o
 * estado necessário para renderizar uma UI de "Instalar app".
 *
 * Comportamento:
 * - Chrome/Edge/Android: o navegador dispara `beforeinstallprompt`. Guardamos
 *   o evento em ref e marcamos `canPrompt: true`. `prompt()` chama o método
 *   nativo do navegador e aguarda `userChoice` do usuário.
 * - iOS Safari: não dispara `beforeinstallprompt`. Detectamos via UA e
 *   sinalizamos `isIos: true` para que a UI mostre instrução manual
 *   (Compartilhar → Adicionar à Tela de Início).
 * - Já instalado: `isStandalone: true`. Componente esconde botão.
 * - Dismissado: respeita por 7 dias (chave `pt-coach-install-dismissed-at`).
 *
 * Padrão segue `usePendingRecovery` — state local + listeners no useEffect
 * com cleanup determinístico.
 */
export function useInstallPrompt() {
  const promptEventRef = useRef(null);
  const [canPrompt, setCanPrompt] = useState(false);
  const [isStandalone, setIsStandalone] = useState(detectStandalone);
  const [isIos] = useState(detectIos);
  const [dismissed, setDismissed] = useState(isDismissActive);

  useEffect(() => {
    function handleBeforeInstall(event) {
      event.preventDefault();
      promptEventRef.current = event;
      setCanPrompt(true);
    }
    function handleInstalled() {
      promptEventRef.current = null;
      setCanPrompt(false);
      setIsStandalone(true);
    }
    function handleDisplayModeChange(ev) {
      if (ev?.matches) setIsStandalone(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);

    const mq = window.matchMedia?.("(display-mode: standalone)");
    if (mq) {
      if (typeof mq.addEventListener === "function") {
        mq.addEventListener("change", handleDisplayModeChange);
      } else if (typeof mq.addListener === "function") {
        mq.addListener(handleDisplayModeChange);
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
      if (mq) {
        if (typeof mq.removeEventListener === "function") {
          mq.removeEventListener("change", handleDisplayModeChange);
        } else if (typeof mq.removeListener === "function") {
          mq.removeListener(handleDisplayModeChange);
        }
      }
    };
  }, []);

  const prompt = useCallback(async () => {
    const ev = promptEventRef.current;
    if (!ev) return { outcome: "unavailable" };
    try {
      await ev.prompt();
      const choice = await ev.userChoice;
      // Após accept ou dismiss, o evento não é reutilizável.
      promptEventRef.current = null;
      setCanPrompt(false);
      return choice;
    } catch (err) {
      promptEventRef.current = null;
      setCanPrompt(false);
      return { outcome: "error", error: err };
    }
  }, []);

  const dismiss = useCallback(() => {
    try {
      window.localStorage?.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* localStorage indisponível (modo privado, etc.) — degradar silenciosamente */
    }
    setDismissed(true);
  }, []);

  return {
    canPrompt: canPrompt && !dismissed,
    isIos: isIos && !dismissed,
    isStandalone,
    dismissed,
    prompt,
    dismiss,
  };
}
