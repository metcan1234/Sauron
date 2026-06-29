import { createTaskWidgetController } from "./widget/task-widget.js";

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

async function bootWidget() {
  const api = await waitForBridgeApi();
  if (!api) {
    console.error("[Sauron][widget] preload API unavailable — widget IPC disabled");
    return;
  }

  const controller = createTaskWidgetController({ api });
  await controller.init();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    void bootWidget();
  }, { once: true });
} else {
  void bootWidget();
}
