const {
  listPipelines,
  planPipeline,
  startBuildPipeline,
  advancePipelineAfterComplete,
  getBuildPipelineStatus,
} = require("../sauron/build-pipeline");
const { runVerification } = require("../sauron/build-pipeline/pipeline-state");
const { detectWorkspaceLayout } = require("../sauron/workspace-detector");
const { launchVSCode } = require("../sauron/handoff");

function registerBuildPipelineIpc({
  ipcMain,
  store,
  debugLog,
  appLogger,
  getRuntimeSettings,
  panelWindow,
}) {
  function resolveWorkspacePath(overridePath) {
    return String(overridePath || store.get("workspacePath") || "").trim();
  }

  ipcMain.handle("list-build-pipelines", () => {
    return { ok: true, pipelines: listPipelines() };
  });

  ipcMain.handle("plan-build-pipeline", (_event, { pipelineId, options } = {}) => {
    return planPipeline(pipelineId, options || {});
  });

  ipcMain.handle("detect-workspace-layout", (_event, { workspacePath } = {}) => {
    const resolved = resolveWorkspacePath(workspacePath);
    return { ok: true, ...detectWorkspaceLayout(resolved) };
  });

  ipcMain.handle("start-build-pipeline", async (_event, { pipelineId, workspacePath, options } = {}) => {
    debugLog("ipc:start-build-pipeline", { pipelineId });
    const resolved = resolveWorkspacePath(workspacePath);
    if (!resolved) {
      return { ok: false, error: "Workspace path is not configured." };
    }
    try {
      const settings = getRuntimeSettings();
      const result = await startBuildPipeline({
        pipelineId,
        workspacePath: resolved,
        settings,
        options: options || {},
      });
      if (!result.ok) {
        return result;
      }
      try {
        await launchVSCode(resolved, { newWindow: false });
      } catch (launchError) {
        appLogger.warn("pipeline-vscode-launch-failed", {
          error: launchError?.message || launchError,
        });
      }
      if (panelWindow && !panelWindow.isDestroyed()) {
        panelWindow.webContents.send("pipeline-updated", getBuildPipelineStatus(resolved));
      }
      return result;
    } catch (error) {
      return { ok: false, error: error?.message || "Failed to start build pipeline." };
    }
  });

  ipcMain.handle("get-build-pipeline-status", (_event, { workspacePath } = {}) => {
    const resolved = resolveWorkspacePath(workspacePath);
    if (!resolved) {
      return { ok: false, error: "Workspace path is not configured." };
    }
    return getBuildPipelineStatus(resolved);
  });

  ipcMain.handle("run-workspace-command", async (_event, { workspacePath, command, cwd, confirm } = {}) => {
    const resolved = resolveWorkspacePath(workspacePath);
    if (!resolved) {
      return { ok: false, error: "Workspace path is not configured." };
    }
    if (!command) {
      return { ok: false, error: "Command is required." };
    }
    if (!confirm) {
      return { ok: false, needsConfirm: true, error: "User confirmation required for workspace commands." };
    }
    return runVerification(resolved, { command, cwd });
  });

  ipcMain.handle("advance-build-pipeline", async (_event, { workspacePath } = {}) => {
    debugLog("ipc:advance-build-pipeline");
    const resolved = resolveWorkspacePath(workspacePath);
    if (!resolved) {
      return { ok: false, error: "Workspace path is not configured." };
    }
    try {
      const settings = getRuntimeSettings();
      const result = await advancePipelineAfterComplete(resolved, settings);
      if (panelWindow && !panelWindow.isDestroyed()) {
        panelWindow.webContents.send("pipeline-updated", getBuildPipelineStatus(resolved));
      }
      return result;
    } catch (error) {
      return { ok: false, error: error?.message || "Failed to advance pipeline." };
    }
  });
}

module.exports = { registerBuildPipelineIpc };
