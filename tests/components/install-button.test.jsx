// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InstallButton from "../../src/components/ui/InstallButton.jsx";

function setStandalone(matches) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: query === "(display-mode: standalone)" ? matches : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

function setUserAgent(ua) {
  Object.defineProperty(window.navigator, "userAgent", {
    value: ua,
    configurable: true,
  });
}

function dispatchBeforeInstall(outcome = "accepted") {
  const ev = new Event("beforeinstallprompt");
  ev.prompt = vi.fn().mockResolvedValue(undefined);
  ev.userChoice = Promise.resolve({ outcome, platform: "web" });
  window.dispatchEvent(ev);
  return ev;
}

describe("InstallButton", () => {
  beforeEach(() => {
    setStandalone(false);
    setUserAgent("Mozilla/5.0 (Linux; Android 14) Chrome/120");
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("nao renderiza nada quando isStandalone", () => {
    setStandalone(true);
    const { container } = render(<InstallButton />);
    expect(container.firstChild).toBeNull();
  });

  it("nao renderiza em desktop sem suporte a install prompt", () => {
    setUserAgent("Mozilla/5.0 (Windows NT 10) Firefox/120");
    const { container } = render(<InstallButton />);
    expect(container.firstChild).toBeNull();
  });

  it("renderiza botao Instalar app quando canPrompt", async () => {
    render(<InstallButton />);
    await act(async () => {
      dispatchBeforeInstall();
    });
    expect(screen.getByRole("button", { name: /instalar app/i })).toBeTruthy();
  });

  it("renderiza instrucao iOS quando isIos e nao standalone", () => {
    setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari");
    render(<InstallButton />);
    expect(screen.getByText(/instalar no iphone/i)).toBeTruthy();
    expect(screen.getByText(/adicionar à tela de início/i)).toBeTruthy();
  });

  it("clicar em Instalar app chama prompt() do evento nativo", async () => {
    render(<InstallButton />);
    let ev;
    await act(async () => {
      ev = dispatchBeforeInstall();
    });
    const button = screen.getByRole("button", { name: /instalar app/i });
    await act(async () => {
      fireEvent.click(button);
    });
    expect(ev.prompt).toHaveBeenCalledTimes(1);
  });
});
