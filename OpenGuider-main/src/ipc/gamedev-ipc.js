const channelRuntime = require("../sauron/channel-runtime");
const { getBlockersForChannel } = require("../sauron/doctor");
const { registerOnceConcurrent } = require("./ipc-once-concurrent");
const {
  activateGamedevMode,
  toggleGamedevMode,
  launchGamedevSession,
  getGamedevSessionInfo,
  deactivateGamedevMode,
} = require("../sauron/gamedev-launcher");
const { attachGamedevSessionStore } = require("../sauron/gamedev-session-state");
const { getGamedevStatus } = require("../sauron/gamedev-status");
const { isGamedevLaunchInProgress } = require("../sauron/gamedev-session-state");
const { probeGamedevMcpEntry } = require("../sauron/gamedev-path-resolver");
const { summarizeGamedevLedger } = require("../sauron/gamedev-finops-ledger");
const { getGamePipelineStatus } = require("../sauron/game-pipeline");
const { probeGamedevBridgePorts, probeGamedevBridgeForEngine } = require("../sauron/gamedev-bridge-probe");
const { fixGamedevSetup } = require("../sauron/gamedev-fix-setup");
const { runGamedevPlayLoop } = require("../sauron/gamedev-play-loop");
const { ensureGamedevProjectReady } = require("../sauron/gamedev-project-bootstrap");
const { wrapGamedevStreamAIResponse } = require("../sauron/gamedev-agent-runner");
const { normalizeGamedevEngine } = require("../sauron/gamedev-config");

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

  async function prepareGamedevWorkspace(settings, workspacePath, engineOverride = null) {
    const resolved = resolveWorkspacePath(workspacePath);
    if (!resolved) {
      return { ok: false, error: "Workspace path ayarlanmamis." };
    }
    const engine = normalizeGamedevEngine(engineOverride || settings.gamedevActiveEngine || "unity");
    return ensureGamedevProjectReady(resolved, settings, engine);
  }

  async function handleActivateGamedevMode() {
    debugLog("ipc:activate-gamedev-mode");
    try {
      const settings = await getRuntimeSettings();

      // Preflight: Game Dev bloker kontrolü
      const blockers = getBlockersForChannel('gamedev', store, { settings });
      if (blockers.length > 0) {
        return { ok: false, error: `🎮 Game Dev başlatılamadı:\n${blockers.join('\n')}`, blockers };
      }

      const prepared = await prepareGamedevWorkspace(settings, null);
      if (!prepared.ok) {
        return { ok: false, error: prepared.error || "Game Dev workspace hazirlanamadi.", steps: prepared.steps };
      }

      const result = await activateGamedevMode({
        ...settings,
        gamedevActiveEngine: prepared.engine || settings.gamedevActiveEngine,
      });
      if (result?.ok) {
        broadcastGamedevEvent("gamedev-mode-changed", {
          modeActive: true,
          engine: result.engine,
          workspacePath: result.workspacePath,
        });
      }
      return { ...result, bootstrap: prepared };
    } catch (error) {
      appLogger?.error?.("activate-gamedev-mode-failed", { error: error?.message || error });
      return { ok: false, error: error?.message || "Game Dev modu açılamadı." };
    }
  }

  async function handleToggleGamedevMode() {
    debugLog("ipc:toggle-gamedev-mode");
    try {
      const settings = await getRuntimeSettings();
      const sessionInfo = getGamedevSessionInfo();
      if (sessionInfo.modeActive) {
        const result = deactivateGamedevMode();
        broadcastGamedevEvent("gamedev-mode-changed", { modeActive: false });
        return result;
      }
      return handleActivateGamedevMode();
    } catch (error) {
      appLogger?.error?.("toggle-gamedev-mode-failed", { error: error?.message || error });
      return { ok: false, error: error?.message || "Game Dev modu değiştirilemedi." };
    }
  }

  registerOnceConcurrent(ipcMain, "activate-gamedev-mode", handleActivateGamedevMode);
  registerOnceConcurrent(ipcMain, "toggle-gamedev-mode", handleToggleGamedevMode);

  ipcMain.handle("prepare-gamedev-workspace", async (_event, { workspacePath, engine } = {}) => {
    const settings = await getRuntimeSettings();
    return prepareGamedevWorkspace(settings, workspacePath, engine || null);
  });

  registerOnceConcurrent(ipcMain, "start-gamedev-session", async (_event, { taskText, masterPrompt, workspacePath, engine } = {}) => {
    debugLog("ipc:start-gamedev-session");
    try {
      const settings = await getRuntimeSettings();

      // Preflight: Game Dev bloker kontrolü
      const blockers = getBlockersForChannel('gamedev', store, { settings });
      if (blockers.length > 0) {
        return { ok: false, error: `🎮 Gamedev oturumu başlatılamadı:\n${blockers.join('\n')}`, blockers };
      }

      const resolvedWorkspace = resolveWorkspacePath(workspacePath);
      const prepared = await prepareGamedevWorkspace(settings, resolvedWorkspace, engine || null);
      if (!prepared.ok) {
        return { ok: false, error: prepared.error || "Game Dev workspace hazirlanamadi.", steps: prepared.steps };
      }

      const mergedSettings = {
        ...settings,
        gamedevActiveEngine: prepared.engine || settings.gamedevActiveEngine,
      };
      const resilientStream = wrapGamedevStreamAIResponse(
        streamAIResponse,
        mergedSettings,
        prepared.workspacePath || resolvedWorkspace,
      );

      const result = await launchGamedevSession({
        workspacePath: prepared.workspacePath || resolvedWorkspace,
        taskText,
        masterPrompt: masterPrompt || settings.gamedevMasterPrompt || "",
        settings: mergedSettings,
        engineOverride: prepared.engine || engine || null,
        streamAIResponse: resilientStream,
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
      return { ...result, bootstrap: prepared };
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
    const engine = normalizeGamedevEngine(settings.gamedevActiveEngine || "unity");
    const status = await getGamedevStatus(settings, engine, workspacePath);
    const bridge = workspacePath
      ? await probeGamedevBridgeForEngine(engine, { workspacePath })
      : null;
    const finops = workspacePath ? summarizeGamedevLedger(workspacePath) : status.finops;
    const gamePipeline = workspacePath ? getGamePipelineStatus(workspacePath) : null;
    const runtimeState = channelRuntime.getState("gamedev");
    return {
      ...status,
      bridge,
      session: sessionInfo.session,
      modeActive: sessionInfo.modeActive === true,
      launchInProgress: isGamedevLaunchInProgress(),
      mcpEntryOk: probe.ok,
      enabled: settings.gamedevEnabled !== false,
      finops: finops ? { ...status.finops, ...finops } : status.finops,
      gamePipeline,
      runtime: runtimeState,
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

  ipcMain.handle("get-gamedev-bridge-status", async () => {
    const settings = await getRuntimeSettings();
    if (settings.gamedevBridgeMonitorEnabled === false) {
      return { ok: false, disabled: true };
    }
    const workspacePath = resolveWorkspacePath(null);
    const engine = normalizeGamedevEngine(settings.gamedevActiveEngine || "unity");
    if (workspacePath) {
      return probeGamedevBridgeForEngine(engine, { workspacePath });
    }
    return probeGamedevBridgePorts("127.0.0.1", engine, workspacePath);
  });

  ipcMain.handle("fix-gamedev-setup", async (_event, { workspacePath } = {}) => {
    debugLog("ipc:fix-gamedev-setup");
    const settings = await getRuntimeSettings();
    return fixGamedevSetup({
      workspacePath: resolveWorkspacePath(workspacePath),
      settings,
      projectRoot: require("path").join(__dirname, "..", ".."),
    });
  });

  ipcMain.handle("run-gamedev-play-loop", async (_event, { workspacePath, recipeId, maxAttempts, engine } = {}) => {
    debugLog("ipc:run-gamedev-play-loop");
    const settings = await getRuntimeSettings();
    return runGamedevPlayLoop({
      workspacePath: resolveWorkspacePath(workspacePath),
      settings,
      recipeId,
      maxAttempts: Number(maxAttempts) || 3,
      engine: engine || settings.gamedevActiveEngine,
    });
  });
}

module.exports = {
  registerGamedevIpc,
};
