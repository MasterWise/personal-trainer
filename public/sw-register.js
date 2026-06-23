// Estrategia de atualizacao: o app sempre busca versao nova quando online.
// Este arquivo fica externo ao HTML para permitir CSP enforcement sem
// `script-src 'unsafe-inline'`.
(function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  const registerScriptUrl = document.currentScript?.src || new URL("sw-register.js", window.location.href).toString();

  window.addEventListener("load", async () => {
    const scriptUrl = new URL(registerScriptUrl, window.location.href);
    const scopePath = scriptUrl.pathname.replace(/[^/]+$/, "");
    const swUrl = new URL("sw.js", scriptUrl).toString();
    let registration;

    try {
      registration = await navigator.serviceWorker.register(swUrl, {
        scope: scopePath,
        updateViaCache: "none",
      });
    } catch (err) {
      console.error("Service worker registration failed", err);
      return;
    }

    function notifyUpdateAvailable() {
      window.dispatchEvent(new CustomEvent("pt:sw-updated"));
    }

    if (registration.waiting && navigator.serviceWorker.controller) {
      notifyUpdateAvailable();
    }

    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          notifyUpdateAvailable();
        }
      });
    });

    navigator.serviceWorker.addEventListener("message", (ev) => {
      if (ev?.data?.type === "SW_UPDATED") {
        notifyUpdateAvailable();
      }
    });

    function checkForUpdate() {
      if (!navigator.onLine) return;
      registration.update().catch(() => {});
    }

    window.addEventListener("focus", checkForUpdate);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) checkForUpdate();
    });
    window.addEventListener("online", checkForUpdate);
    setInterval(checkForUpdate, 5 * 60 * 1000);
  });
}());
