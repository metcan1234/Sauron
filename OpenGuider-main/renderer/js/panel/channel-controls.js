/**
 * Header channel highlight + send routing (works with exe bootstrap Goose/GameDev handlers).
 */

export function createChannelControls({
  dom,
  log,
  openWorkspaceHandoff,
  routeGooseSend,
  routeGamedevSend,
}) {
  let activeChannel = "core";
  let gamedevModeActive = false;

  function syncChannelVisuals() {
    dom.btnGoose?.classList.toggle("channel-active", activeChannel === "goose");
    dom.btnGamedev?.classList.toggle("gamedev-active", gamedevModeActive);
    dom.btnGamedev?.classList.toggle("channel-active", activeChannel === "gamedev");
    dom.btnWorkspace?.classList.toggle("channel-active", activeChannel === "workspace");
  }

  function setActiveChannel(channel) {
    activeChannel = channel || "core";
    syncChannelVisuals();
  }

  function setGamedevModeActive(active) {
    gamedevModeActive = active === true;
    if (!gamedevModeActive && activeChannel === "gamedev") {
      activeChannel = "core";
    }
    syncChannelVisuals();
  }

  async function refreshChannelStatus(api, state) {
    try {
      if (state.getSetting("gamedevEnabled") !== false) {
        const gamedevStatus = await api.invoke("get-gamedev-status");
        gamedevModeActive = gamedevStatus?.modeActive === true;
        if (gamedevModeActive) {
          activeChannel = "gamedev";
        }
      }
      if (state.getSetting("gooseEnabled") !== false) {
        const gooseStatus = await api.invoke("get-goose-status");
        if (gooseStatus?.runtimeAlive === true) {
          activeChannel = "goose";
        }
      }
    } catch (error) {
      log("channel:refresh-status error", error);
    }
    syncChannelVisuals();
  }

  function wrapMessagingSend(messaging) {
    const originalSend = messaging.sendMessage.bind(messaging);
    messaging.sendMessage = async function sendWithChannelRouting(overrideText, options = {}) {
      if (options.skipChannelRoute) {
        return originalSend(overrideText, options);
      }
      const text = String(overrideText ?? dom.textInput?.value ?? "").trim();
      if (activeChannel === "goose" && text && typeof routeGooseSend === "function") {
        dom.textInput.value = "";
        dom.textInput.style.height = "auto";
        return routeGooseSend(text);
      }
      if (activeChannel === "gamedev" && text && typeof routeGamedevSend === "function") {
        dom.textInput.value = "";
        dom.textInput.style.height = "auto";
        return routeGamedevSend(text);
      }
      return originalSend(overrideText, options);
    };
  }

  function onWorkspaceClick() {
    activeChannel = "workspace";
    syncChannelVisuals();
    void openWorkspaceHandoff();
  }

  function onGooseSessionStarted() {
    activeChannel = "goose";
    syncChannelVisuals();
  }

  function onGamedevSessionActive() {
    gamedevModeActive = true;
    activeChannel = "gamedev";
    syncChannelVisuals();
  }

  function onGamedevModeEnded() {
    setGamedevModeActive(false);
  }

  return {
    refreshChannelStatus,
    wrapMessagingSend,
    onWorkspaceClick,
    onGooseSessionStarted,
    onGamedevSessionActive,
    onGamedevModeEnded,
    setActiveChannel,
    setGamedevModeActive,
    syncChannelVisuals,
  };
}
