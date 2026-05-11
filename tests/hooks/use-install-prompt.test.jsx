// @vitest-environment jsdom
import React from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useInstallPrompt } from "../../src/hooks/useInstallPrompt.js";

function dispatchBeforeInstall() {
  const ev = new Event("beforeinstallprompt");
  ev.prompt = vi.fn().mockResolvedValue(undefined);
  ev.userChoice = Promise.resolve({ outcome: "accepted", platform: "web" });
  window.dispatchEvent(ev);
  return ev;
}

function setUserAgent(ua) {
  Object.defineProperty(window.navigator, "userAgent", {
    value: ua,
    configurable: true,
  });
}

function setStandaloneMatchMedia(matches) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: query === "(display-mode: standalone)" ? matches : false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

describe("useInstallPrompt", () => {
  beforeEach(() => {
    setStandaloneMatchMedia(false);
    setUserAgent("Mozilla/5.0 (Linux; Android 14) Chrome/120");
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("captura beforeinstallprompt e marca canPrompt", async () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canPrompt).toBe(false);
    await act(async () => {
      dispatchBeforeInstall();
    });
    expect(result.current.canPrompt).toBe(true);
    expect(result.current.isStandalone).toBe(false);
  });

  it("detecta standalone via matchMedia", () => {
    setStandaloneMatchMedia(true);
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.isStandalone).toBe(true);
  });

  it("detecta iOS via user agent", () => {
    setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari");
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.isIos).toBe(true);
  });

  it("dismiss() grava chave em localStorage e zera canPrompt/isIos", async () => {
    setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari");
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.isIos).toBe(true);
    await act(async () => {
      result.current.dismiss();
    });
    expect(localStorage.getItem("pt-coach-install-dismissed-at")).toBeTruthy();
    expect(result.current.dismissed).toBe(true);
    expect(result.current.isIos).toBe(false);
  });

  it("prompt() chama o evento nativo e retorna a escolha do usuario", async () => {
    const { result } = renderHook(() => useInstallPrompt());
    let promptedEvent;
    await act(async () => {
      promptedEvent = dispatchBeforeInstall();
    });
    let choice;
    await act(async () => {
      choice = await result.current.prompt();
    });
    expect(promptedEvent.prompt).toHaveBeenCalledTimes(1);
    expect(choice).toEqual({ outcome: "accepted", platform: "web" });
    expect(result.current.canPrompt).toBe(false);
  });
});
