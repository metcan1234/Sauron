import { initPanelApp } from "./panel/bootstrap.js";

function getBridgeApi() {
  return window.sauron || window.openguider;
}

async function waitForBridgeApi(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const api = getBridgeApi();
    if (api?.invoke) {
      return api;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return null;
}

async function bootPanel() {
  const api = await waitForBridgeApi();
  if (!api) {
    console.error("[Sauron] preload API unavailable — panel IPC disabled");
    return;
  }
  initPanelApp();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void bootPanel();
  }, { once: true });
} else {
  void bootPanel();
}
