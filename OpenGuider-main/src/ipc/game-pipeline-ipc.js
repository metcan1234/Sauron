const {
  listGamePipelines,
  startGamePipeline,
  advanceGamePipelineAfterComplete,
  getGamePipelineStatus,
  getGamePipeline,
} = require("../sauron/game-pipeline");
const { scaffoldUnityTemplate } = require("../sauron/scaffold-unity-template");

function registerGamePipelineIpc({
  ipcMain,
  debugLog,
  appLogger,
  getRuntimeSettings,
  panelWindow,
  store,
  streamAIResponse,
}) {
  function resolveWorkspacePath(workspacePath) {
    const fromArg = String(workspacePath || "").trim();
    if (fromArg) {
      return fromArg;
    }
    return String(store.get("workspacePath") || "").trim();
  }

  function broadcastPipelineEvent(payload) {
    if (panelWindow && !panelWindow.isDestroyed()) {
      panelWindow.webContents.send("game-pipeline-updated", payload);
    }
  }

  ipcMain.handle("list-game-pipelines", () => {
    return { ok: true, pipelines: listGamePipelines() };
  });

  ipcMain.handle("get-game-pipeline-status", (_event, { workspacePath } = {}) => {
    const resolved = resolveWorkspacePath(workspacePath);
    if (!resolved) {
      return { ok: false, error: "Workspace path required." };
    }
    return getGamePipelineStatus(resolved);
  });

  ipcMain.handle("start-game-pipeline", async (_event, {
    pipelineId,
    workspacePath,
    taskDescription,
    forceRestart,
    scaffoldTemplate,
  } = {}) => {
    debugLog("ipc:start-game-pipeline", { pipelineId });
    try {
      const resolved = resolveWorkspacePath(workspacePath);
      const pipeline = getGamePipeline(pipelineId);
      if (!pipeline) {
        return { ok: false, error: `Unknown pipeline: ${pipelineId}` };
      }

      let scaffoldResult = null;
      if (scaffoldTemplate !== false && pipeline.templateId) {
        scaffoldResult = scaffoldUnityTemplate(resolved, pipeline.templateId);
      }

      const settings = await getRuntimeSettings({ includePersona: false });
      const result = await startGamePipeline({
        pipelineId,
        workspacePath: resolved,
        taskDescription,
        masterPrompt: settings.gamedevMasterPrompt || taskDescription,
        settings,
        streamAIResponse,
        forceRestart: forceRestart === true,
      });

      const status = getGamePipelineStatus(resolved);
      broadcastPipelineEvent(status);
      return { ...result, scaffold: scaffoldResult };
    } catch (error) {
      appLogger?.error?.("start-game-pipeline-failed", { error: error?.message || error });
      return { ok: false, error: error?.message || "Game pipeline start failed." };
    }
  });

  ipcMain.handle("advance-game-pipeline", async (_event, { workspacePath } = {}) => {
    debugLog("ipc:advance-game-pipeline");
    try {
      const settings = await getRuntimeSettings({ includePersona: false });
      const resolved = resolveWorkspacePath(workspacePath);
      const result = await advanceGamePipelineAfterComplete(resolved, settings, {
        launchVSCode: false,
      });
      const status = getGamePipelineStatus(resolved);
      broadcastPipelineEvent(status);
      return result;
    } catch (error) {
      appLogger?.error?.("advance-game-pipeline-failed", { error: error?.message || error });
      return { ok: false, error: error?.message || "Game pipeline advance failed." };
    }
  });
}

module.exports = {
  registerGamePipelineIpc,
};
