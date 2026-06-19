import { initPanelApp } from "./panel/bootstrap.js";

async function waitForBridgeApi(timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const api = window.sauron || window.openguider;
    if (api?.invoke) {
      return api;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  const banner = document.createElement("div");
  banner.textContent = "Sauron API yüklenemedi. Uygulamayı yeniden başlatın.";
  banner.style.cssText = [
    "position:fixed",
    "top:0",
    "left:0",
    "right:0",
    "padding:12px",
    "background:#7f1d1d",
    "color:#fff",
    "text-align:center",
    "z-index:99999",
    "font-family:sans-serif",
  ].join(";");
  document.body.prepend(banner);
  throw new Error("preload API unavailable");
}

waitForBridgeApi()
  .then(() => initPanelApp())
  .catch(() => {});
