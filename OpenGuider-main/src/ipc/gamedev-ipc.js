const {
  activateGamedevMode,
  toggleGamedevMode,
  launchGamedevSession,
  getGamedevSessionInfo,
  deactivateGamedevMode,
} = require("../sauron/gamedev-launcher");
const { attachGamedevSessionStore } = require("../sauron/gamedev-session-state");
const { getGamedevStatus } = require("../sauron/gamedev-status");
const { probeGamedevMcpEntry } = require("../sauron/gamedev-path-resolver");
const { summarizeGamedevLedger } = require("../sauron/gamedev-finops-ledger");
const { getGamePipelineStatus } = require("../sauron/game-pipeline");

function registerGamedevIpc({
  ipcMain,
  debugLog,
  appLogger,
  getRuntimeSettings,
  panelWindow,
  store,
  streamAIResponse,
}) {
  attachGamedevSessionStore(store);

  function resolveWorkspacePath(workspacePath) {
    const fromArg = String(workspacePath || "").trim();
    if (fromArg) {
      return fromArg;
    }
    return String(store.get("workspacePath") || "").trim();
  }

  function broadcastGamedevEvent(event, payload) {
    appLogger?.info?.("gamedev-broadcast", { event, payload });
    if (panelWindow && !panelWindow.isDestroyed()) {
      panelWindow.webContents.send(event, payload);
    }
  }

  async function handleActivateGamedevMode() {
    debugLog("ipc:activate-gamedev-mode");
    try {
      const settings = await getRuntimeSettings();
      const result = await activateGamedevMode(settings);
      if (result?.ok) {
        broadcastGamedevEvent("gamedev-mode-changed", {
          modeActive: true,
          engine: result.engine,
          workspacePath: result.workspacePath,
        });
      }
      return result;
    } catch (error) {
      appLogger?.error?.("activate-gamedev-mode-failed", { error: error?.message || error });
      return { ok: false, error: error?.message || "Game Dev modu açılamadı." };
    }
  }

  ipcMain.handle("activate-gamedev-mode", handleActivateGamedevMode);
  ipcMain.handle("toggle-gamedev-mode", handleActivateGamedevMode);

  ipcMain.handle("start-gamedev-session", async (_event, { taskText, masterPrompt, workspacePath, engine } = {}) => {
    debugLog("ipc:start-gamedev-session");
    try {
      const settings = await getRuntimeSettings();
      const result = await launchGamedevSession({
        workspacePath: resolveWorkspacePath(workspacePath),
        taskText,
        masterPrompt: masterPrompt || settings.gamedevMasterPrompt || "",
        settings,
        engineOverride: engine || null,
        streamAIResponse,
      });
      if (result?.ok) {
        broadcastGamedevEvent("gamedev-mode-changed", {
          modeActive: true,
          engine: result.engine,
          workspacePath: result.workspacePath,
        });
        broadcastGamedevEvent("gamedev-session-started", {
          handoffId: result.handoffId,
          handoffFileName: result.handoffFileName,
          workspacePath: result.workspacePath,
        });
      }
      return result;
    } catch (error) {
      appLogger?.error?.("start-gamedev-session-failed", { error: error?.message || error });
      return { ok: false, error: error?.message || "Game Dev oturumu başlatılamadı." };
    }
  });

  ipcMain.handle("get-gamedev-status", async () => {
    const settings = await getRuntimeSettings();
    const probe = probeGamedevMcpEntry(settings);
    const sessionInfo = getGamedevSessionInfo();
    const workspacePath = resolveWorkspacePath(null);
    const status = await getGamedevStatus(settings, settings.gamedevActiveEngine, workspacePath);
    const finops = workspacePath ? summarizeGamedevLedger(workspacePath) : status.finops;
    const gamePipeline = workspacePath ? getGamePipelineStatus(workspacePath) : null;
    return {
      ...status,
      session: sessionInfo.session,
      modeActive: sessionInfo.modeActive === true,
      mcpEntryOk: probe.ok,
      enabled: settings.gamedevEnabled !== false,
      finops: finops ? { ...status.finops, ...finops } : status.finops,
      gamePipeline,
    };
  });

  ipcMain.handle("deactivate-gamedev-mode", async () => {
    const result = deactivateGamedevMode();
    broadcastGamedevEvent("gamedev-mode-changed", { modeActive: false });
    return result;
  });

  ipcMain.handle("probe-gamedev-mcp", async () => {
    const settings = await getRuntimeSettings();
    return probeGamedevMcpEntry(settings);
  });
}

module.exports = {
  registerGamedevIpc,
};
