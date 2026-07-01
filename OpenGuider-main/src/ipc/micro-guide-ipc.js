function registerMicroGuideIpc({
  ipcMain,
  appLogger,
  createRequestContext,
  currentAIControllerRef,
  debugLog,
  getRuntimeSettings,
  handleOrchestratorResult,
  recordPerformanceMetric,
  sessionManager,
  taskOrchestrator,
  updatePointerCalibration,
  broadcastSessionSnapshot,
  wrapUserFacingError,
}) {
  const { detectMicroGuideIntent } = require("../agent/micro-guide/detect-micro-guide-intent");
  const { resolveMessageRoute, resolvePanelModeState } = require("../routing/message-route");

  function getCurrentAIController() {
    return currentAIControllerRef.current;
  }

  function setCurrentAIController(controller) {
    currentAIControllerRef.current = controller;
  }

  async function runMicroGuideHandler(channel, event, runner) {
    const requestContext = createRequestContext(channel);
    debugLog(`ipc:${channel}`, { requestId: requestContext.requestId });
    if (getCurrentAIController()) {
      getCurrentAIController().abort();
    }
    const controller = new AbortController();
    setCurrentAIController(controller);
    const runtimeSettings = await getRuntimeSettings({ includePersona: false });

    try {
      const result = await runner({
        settings: runtimeSettings,
        signal: controller.signal,
        requestId: requestContext.requestId,
      });
      const handled = await handleOrchestratorResult(result, runtimeSettings, event.sender, {
        channel,
        requestId: requestContext.requestId,
      });
      if (result?.session) {
        broadcastSessionSnapshot(result.session);
      }
      return { ...handled, requestId: requestContext.requestId };
    } catch (err) {
      appLogger.error(`ipc:${channel} failed`, {
        requestId: requestContext.requestId,
        error: err,
      });
      throw wrapUserFacingError(err);
    } finally {
      setCurrentAIController(null);
    }
  }

  ipcMain.handle("detect-micro-guide-intent", (_event, { text } = {}) => {
    debugLog("ipc:detect-micro-guide-intent");
    return detectMicroGuideIntent(String(text || ""));
  });

  ipcMain.handle("resolve-message-route", (_event, params = {}) => {
    debugLog("ipc:resolve-message-route");
    return resolveMessageRoute(params);
  });

  ipcMain.handle("suggest-code-execution-path", async (_event, params = {}) => {
    debugLog("ipc:suggest-code-execution-path");
    const { suggestCodeExecutionPath } = require("../routing/message-route");
    const { checkWorkspacePrerequisites } = require("../sauron/workspace-setup");
    const prereqs = checkWorkspacePrerequisites();
    return suggestCodeExecutionPath({
      ...params,
      prerequisites: {
        handoffReady: Boolean(prereqs.vscodeCli && prereqs.clineExtension),
        codeAgentReady: params.codeAgentNativeEnabled === true,
      },
    });
  });

  ipcMain.handle("resolve-channel-hints", async (_event, params = {}) => {
    debugLog("ipc:resolve-channel-hints");
    const { resolveChannelHints } = require("../routing/channel-hints");
    const runtime = await getRuntimeSettings({ includePersona: false });
    return resolveChannelHints({
      ...params,
      settings: { ...runtime, ...(params.settings || {}) },
    });
  });

  ipcMain.handle("resolve-at-file-context", (_event, { text, workspacePath } = {}) => {
    debugLog("ipc:resolve-at-file-context");
    const { buildAtFileContextBlock } = require("../panel/at-file-context");
    const resolvedPath = String(workspacePath || "").trim();
    if (!resolvedPath) {
      return { ok: false, error: "Workspace path is not configured." };
    }
    const result = buildAtFileContextBlock(resolvedPath, text);
    return { ok: true, ...result };
  });

  ipcMain.handle("resolve-panel-mode-state", (_event, params = {}) => {
    debugLog("ipc:resolve-panel-mode-state");
    return resolvePanelModeState(params);
  });

  ipcMain.handle("start-micro-guide-session", async (event, { goal, images } = {}) => {
    const startedAt = Date.now();
    if (Array.isArray(images) && images.length > 0) {
      updatePointerCalibration(images);
    }
    try {
      const result = await runMicroGuideHandler("start-micro-guide-session", event, (ctx) => (
        taskOrchestrator.startMicroGuideSession({
          goal,
          images,
          settings: ctx.settings,
          signal: ctx.signal,
          requestId: ctx.requestId,
        })
      ));
      recordPerformanceMetric("ipc.start-micro-guide-session", startedAt, {
        ok: true,
        meta: { requestId: result.requestId, imageCount: images?.length || 0 },
      });
      return result;
    } catch (err) {
      recordPerformanceMetric("ipc.start-micro-guide-session", startedAt, {
        ok: false,
        meta: { errorName: err?.name || "Error" },
      });
      throw err;
    }
  });

  ipcMain.handle("micro-guide-ack", async (event, { images } = {}) => {
    const startedAt = Date.now();
    if (Array.isArray(images) && images.length > 0) {
      updatePointerCalibration(images);
    }
    try {
      const result = await runMicroGuideHandler("micro-guide-ack", event, (ctx) => (
        taskOrchestrator.ackMicroGuide({
          images,
          settings: ctx.settings,
          signal: ctx.signal,
          requestId: ctx.requestId,
        })
      ));
      recordPerformanceMetric("ipc.micro-guide-ack", startedAt, {
        ok: true,
        meta: { requestId: result.requestId, imageCount: images?.length || 0 },
      });
      return result;
    } catch (err) {
      recordPerformanceMetric("ipc.micro-guide-ack", startedAt, {
        ok: false,
        meta: { errorName: err?.name || "Error" },
      });
      throw err;
    }
  });

  ipcMain.handle("micro-guide-cancel", async (event) => {
    debugLog("ipc:micro-guide-cancel");
    const runtimeSettings = await getRuntimeSettings({ includePersona: false });
    const result = taskOrchestrator.cancelMicroGuide({ reason: "user" });
    const handled = await handleOrchestratorResult(result, runtimeSettings, event.sender, {
      channel: "micro-guide-cancel",
    });
    if (result?.session) {
      broadcastSessionSnapshot(result.session);
    }
    return handled;
  });

  ipcMain.handle("micro-guide-continue", async (event) => {
    return runMicroGuideHandler("micro-guide-continue", event, (ctx) => (
      taskOrchestrator.continueMicroGuide({
        settings: ctx.settings,
        signal: ctx.signal,
        requestId: ctx.requestId,
      })
    ));
  });
}

module.exports = { registerMicroGuideIpc };
