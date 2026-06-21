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
    const runtimeSettings = await getRuntimeSettings();

    try {
      const result = await runner({
        settings: runtimeSettings,
        signal: controller.signal,
        requestId: requestContext.requestId,
      });
      let handled = result;
      try {
        handled = await handleOrchestratorResult(result, runtimeSettings, event.sender);
      } catch (postProcessError) {
        appLogger.error(`ipc:${channel} post-process failed`, {
          requestId: requestContext.requestId,
          error: postProcessError,
        });
      }
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
    const runtimeSettings = await getRuntimeSettings();
    const result = taskOrchestrator.cancelMicroGuide({ reason: "user" });
    const handled = await handleOrchestratorResult(result, runtimeSettings, event.sender);
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
