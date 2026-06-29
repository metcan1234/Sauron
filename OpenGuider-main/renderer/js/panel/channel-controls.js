/**
 * Panel header channel controls: Goose, Game Dev, Workspace routing.
 */

export function createChannelControls({
  api,
  dom,
  ui,
  state,
  log,
  openWorkspaceHandoff,
}) {
  let activeChannel = "core";
  let gamedevModeActive = false;
  let gooseModeActive = false;

  function syncChannelVisuals() {
    dom.btnGoose?.classList.toggle("channel-active", activeChannel === "goose");
    dom.btnGamedev?.classList.toggle("gamedev-active", gamedevModeActive);
    dom.btnGamedev?.classList.toggle("channel-active", activeChannel === "gamedev");
    dom.btnWorkspace?.classList.toggle("channel-active", activeChannel === "workspace");
  }

  function applyChannelFeatureVisibility(settings = {}) {
    const gooseOn = settings.gooseEnabled !== false;
    const gamedevOn = settings.gamedevEnabled !== false;

    dom.btnGoose?.classList.toggle("hidden", !gooseOn);
    dom.btnGamedev?.classList.toggle("hidden", !gamedevOn);
    document.getElementById("empty-cta-gamedev")?.classList.toggle("hidden", !gamedevOn);
  }

  async function refreshChannelStatus() {
    try {
      if (state.getSetting("gamedevEnabled") !== false) {
        const gamedevStatus = await api.invoke("get-gamedev-status");
        gamedevModeActive = gamedevStatus?.modeActive === true;
      }
      if (state.getSetting("gooseEnabled") !== false) {
        const gooseStatus = await api.invoke("get-goose-status");
        gooseModeActive = gooseStatus?.runtimeAlive === true;
      }
    } catch (error) {
      log("channel:refresh-status error", error);
    }
    syncChannelVisuals();
  }

  async function startGooseSession(taskText) {
    const goal = String(taskText || "").trim();
    if (!goal) {
      ui.showToast("Goose için görev metni gerekli.", true);
      return { ok: false };
    }
    try {
      const result = await api.invoke("start-goose-session", { taskText: goal });
      if (result?.ok) {
        activeChannel = "goose";
        syncChannelVisuals();
        ui.showToast("Goose oturumu başlatıldı");
      } else {
        ui.showToast(result?.error || "Goose başlatılamadı", true);
      }
      return result;
    } catch (error) {
      log("channel:start-goose error", error);
      ui.showToast(error?.message || "Goose başlatılamadı", true);
      return { ok: false };
    }
  }

  async function startGamedevSession(taskText) {
    const goal = String(taskText || "").trim();
    if (!goal) {
      ui.showToast("Game Dev için oyun fikri veya görev gerekli.", true);
      return { ok: false };
    }
    try {
      if (!gamedevModeActive) {
        const activated = await api.invoke("activate-gamedev-mode");
        if (!activated?.ok) {
          ui.showToast(activated?.error || "Game Dev modu açılamadı", true);
          return activated;
        }
        gamedevModeActive = true;
        syncChannelVisuals();
      }
      const result = await api.invoke("start-gamedev-session", { taskText: goal });
      if (result?.ok) {
        activeChannel = "gamedev";
        gamedevModeActive = true;
        syncChannelVisuals();
        ui.showToast("Game Dev oturumu başlatıldı");
      } else {
        ui.showToast(result?.error || "Game Dev oturumu başlatılamadı", true);
      }
      return result;
    } catch (error) {
      log("channel:start-gamedev error", error);
      ui.showToast(error?.message || "Game Dev oturumu başlatılamadı", true);
      return { ok: false };
    }
  }

  async function toggleGamedevMode() {
    try {
      const wasActive = gamedevModeActive;
      const result = await api.invoke("toggle-gamedev-mode");
      if (result?.ok) {
        gamedevModeActive = !wasActive;
        if (gamedevModeActive) {
          activeChannel = "gamedev";
          ui.showToast("Game Dev modu açıldı");
        } else {
          if (activeChannel === "gamedev") {
            activeChannel = "core";
          }
          ui.showToast("Game Dev modu kapatıldı");
        }
        syncChannelVisuals();
      } else {
        ui.showToast(result?.error || "Game Dev modu değiştirilemedi", true);
      }
      return result;
    } catch (error) {
      log("channel:toggle-gamedev error", error);
      ui.showToast(error?.message || "Game Dev modu değiştirilemedi", true);
      return { ok: false };
    }
  }

  function selectGooseChannel() {
    if (state.getSetting("gooseEnabled") === false) {
      ui.showToast("Goose devre dışı — Ayarlar → AI Ajanları", true);
      return;
    }
    activeChannel = activeChannel === "goose" ? "core" : "goose";
    syncChannelVisuals();
    if (activeChannel === "goose") {
      ui.showToast("Goose modu — görev yazıp gönder");
    }
  }

  function selectWorkspaceChannel() {
    activeChannel = "workspace";
    syncChannelVisuals();
  }

  function wrapMessagingSend(messaging) {
    const originalSend = messaging.sendMessage.bind(messaging);
    messaging.sendMessage = async function sendWithChannelRouting(overrideText, options = {}) {
      if (options.skipChannelRoute) {
        return originalSend(overrideText, options);
      }
      const text = String(overrideText ?? dom.textInput?.value ?? "").trim();
      if (activeChannel === "goose" && text) {
        dom.textInput.value = "";
        dom.textInput.style.height = "auto";
        return startGooseSession(text);
      }
      if (activeChannel === "gamedev" && text) {
        dom.textInput.value = "";
        dom.textInput.style.height = "auto";
        return startGamedevSession(text);
      }
      return originalSend(overrideText, options);
    };
  }

  function bindEvents() {
    dom.btnGoose?.addEventListener("click", () => {
      selectGooseChannel();
    });

    dom.btnGamedev?.addEventListener("click", () => {
      void toggleGamedevMode();
    });

    document.getElementById("empty-cta-gamedev")?.addEventListener("click", async () => {
      const goal = await ui.promptDialog({
        title: "Oyun yap (Game Dev)",
        message: "Ne tür bir oyun yapmak istiyorsun?",
        defaultValue: "2D platform oyunu",
        confirmLabel: "Başlat",
        cancelLabel: "İptal",
      });
      if (goal) {
        activeChannel = "gamedev";
        syncChannelVisuals();
        void startGamedevSession(goal);
      }
    });
  }

  function setupIPCListeners() {
    api.on("gamedev-mode-changed", (payload) => {
      gamedevModeActive = payload?.modeActive === true;
      if (!gamedevModeActive && activeChannel === "gamedev") {
        activeChannel = "core";
      }
      syncChannelVisuals();
    });

    api.on("gamedev-session-started", () => {
      gamedevModeActive = true;
      activeChannel = "gamedev";
      syncChannelVisuals();
    });

    api.on("goose-session-started", () => {
      activeChannel = "goose";
      gooseModeActive = true;
      syncChannelVisuals();
    });
  }

  function onWorkspaceClick() {
    selectWorkspaceChannel();
    void openWorkspaceHandoff();
  }

  return {
    applyChannelFeatureVisibility,
    refreshChannelStatus,
    bindEvents,
    setupIPCListeners,
    wrapMessagingSend,
    onWorkspaceClick,
    selectWorkspaceChannel,
  };
}
