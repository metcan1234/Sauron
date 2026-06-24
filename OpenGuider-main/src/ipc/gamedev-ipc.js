const {
  toggleGamedevMode,
  launchGamedevSession,
  getGamedevSessionInfo,
  deactivateGamedevMode,
} = require("../sauron/gamedev-launcher");
const { getGamedevStatus } = require("../sauron/gamedev-status");
const { probeGamedevMcpEntry } = require("../sauron/gamedev-path-resolver");
const { summarizeGamedevLedger } = require("../sauron/gamedev-finops-ledger");

function registerGamedevIpc({
  ipcMain,
  debugLog,
  appLogger,
  getRuntimeSettings,
  panelWindow,
  store,
}) {
  function resolveWorkspacePath(workspacePath) {
    const fromArg = String(workspacePath || "").trim();
    if (fromArg) {
      return fromArg;
    }
    return String(store.get("workspacePath") || "").trim();
  }

  function broadcastGamedevEvent(event, payload) {
    if (panelWindow && !panelWindow.isDestroyed()) {
      panelWindow.webContents.send(event, payload);
    }
  }

  ipcMain.handle("toggle-gamedev-mode", async () => {
    debugLog("ipc:toggle-gamedev-mode");
    try {
      const settings = await getRuntimeSettings();
      const result = await toggleGamedevMode(settings);
      if (result.ok) {
        broadcastGamedevEvent("gamedev-mode-changed", {
          modeActive: result.modeActive,
          engine: result.engine || settings.gamedevActiveEngine,
          status: result.status || null,
        });
      }
      return result;
    } catch (error) {
      appLogger?.error?.("toggle-gamedev-mode-failed", { error: error?.message || error });
      return { ok: false, error: error?.message || "Game Dev modu değiştirilemedi." };
    }
  });

  ipcMain.handle("start-gamedev-session", async (_event, { taskText, workspacePath, engine } = {}) => {
    debugLog("ipc:start-gamedev-session");
    try {
      const settings = await getRuntimeSettings();
      const result = await launchGamedevSession({
        workspacePath: resolveWorkspacePath(workspacePath),
        taskText,
        settings,
        engineOverride: engine || null,
      });

      if (result.ok) {
        broadcastGamedevEvent("gamedev-session-started", {
          sessionId: result.handoffId,
          engine: result.engine,
          engineLabel: result.engineLabel,
          handoffFileName: result.handoffFileName,
          tokenPolicy: result.tokenPolicy,
          status: result.status,
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
    const session = getGamedevSessionInfo();
    const status = await getGamedevStatus(settings);
    const workspacePath = resolveWorkspacePath(null);
    const finops = workspacePath ? summarizeGamedevLedger(workspacePath) : null;
    return {
      ...status,
      ...session,
      mcpEntryOk: probe.ok,
      enabled: settings.gamedevEnabled !== false,
      finops,
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
