function registerAiIpc({
  ipcMain,
  ASSISTANT_CHAT_PROMPT,
  MAX_AI_CONTEXT_MESSAGES,
  MAX_STORED_MESSAGES,
  appLogger,
  createRequestContext,
  currentAIControllerRef,
  debugLog,
  fetchOllamaModels,
  getRuntimeSettings,
  handleOrchestratorResult,
  parsePointTag,
  persistActiveSession,
  recordPerformanceMetric,
  sessionManager,
  speakAssistantResponse,
  store,
  streamAIResponse,
  taskOrchestrator,
  toUiErrorPayload,
  updatePointerCalibration,
  updateWidgetState,
  broadcastAgentState,
  broadcastSessionSnapshot,
  showPointer,
  wrapUserFacingError,
  getActiveChatSessionRecord,
  broadcastSettingsChanged,
}) {
  const { buildMemoryChatHistory } = require("../session/memory-chat-context");
  const { maybeCompressMemoryChat } = require("../session/memory-chat-compressor");
  const { enrichTextWithAtFileContext } = require("../panel/at-file-context");
  const { extractMemoryFactsFromTurn, mergeMemoryFacts } = require("../session/auto-memory-extract");
  const { resolveActivePersonaId } = require("../ai/personas");
  const {
    recordLunaMessage,
    normalizeProfile,
    emptyProfile,
    getLunaRelationshipState,
  } = require("../session/luna-relationship");
  const {
    extractLunaRelationshipFromTurn,
    mergeExtractionIntoProfile,
    hasExtractionContent,
  } = require("../session/luna-relationship-extract");
  const TASK_RUNTIME = { includePersona: false };
  const PANEL_RUNTIME = { includePersona: true };
  const PERSONA_SWITCH_REPLY =
    "Persona değiştirmek için Ayarlar → Kişilik sekmesine git. Oradan Luna veya Hiri'yi seçebilirsin.";

  function isPersonaSwitchRequest(text) {
    const normalized = String(text || "").trim();
    if (!normalized) return false;
    return /\b(persona\s*değiştir|kişilik\s*değiştir|luna(?:'|')?ya\s*geç|hiri(?:'|')?ye\s*geç|hiri\s*modu|luna\s*modu)\b/i.test(normalized);
  }
  function getCurrentAIController() {
    return currentAIControllerRef.current;
  }

  function setCurrentAIController(controller) {
    currentAIControllerRef.current = controller;
  }

  async function runOrchestratorHandler(channel, event, runner) {
    const requestContext = createRequestContext(channel);
    debugLog(`ipc:${channel}`, { requestId: requestContext.requestId });
    if (getCurrentAIController()) getCurrentAIController().abort();
    const controller = new AbortController();
    setCurrentAIController(controller);
    const runtimeSettings = await getRuntimeSettings(TASK_RUNTIME);

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

  ipcMain.handle("start-goal-session", async (event, { text, images }) => {
    const startedAt = Date.now();
    if (getCurrentAIController()) getCurrentAIController().abort();
    const controller = new AbortController();
    setCurrentAIController(controller);
    const runtimeSettings = await getRuntimeSettings(TASK_RUNTIME);
    if (Array.isArray(images) && images.length > 0) {
      updatePointerCalibration(images);
    }
    const requestContext = createRequestContext("start-goal-session");
    try {
      const result = await taskOrchestrator.startGoalSession({
        text,
        images,
        settings: runtimeSettings,
        signal: controller.signal,
        requestId: requestContext.requestId,
      });
      const handled = await handleOrchestratorResult(result, runtimeSettings, event.sender, {
        channel: "start-goal-session",
        requestId: requestContext.requestId,
      });
      if (result?.session) {
        broadcastSessionSnapshot(result.session);
      }
      recordPerformanceMetric("ipc.start-goal-session", startedAt, {
        ok: true,
        meta: { requestId: requestContext.requestId, imageCount: images?.length || 0 },
      });
      return { ...handled, requestId: requestContext.requestId };
    } catch (err) {
      recordPerformanceMetric("ipc.start-goal-session", startedAt, {
        ok: false,
        meta: { requestId: requestContext.requestId, errorName: err?.name || "Error" },
      });
      throw wrapUserFacingError(err);
    } finally {
      setCurrentAIController(null);
    }
  });

  ipcMain.handle("submit-user-message", async (event, { text, images }) => {
    const startedAt = Date.now();
    if (getCurrentAIController()) getCurrentAIController().abort();
    const controller = new AbortController();
    setCurrentAIController(controller);
    const runtimeSettings = await getRuntimeSettings(TASK_RUNTIME);
    if (Array.isArray(images) && images.length > 0) {
      updatePointerCalibration(images);
    }
    const requestContext = createRequestContext("submit-user-message");
    try {
      const result = await taskOrchestrator.submitUserMessage({
        text,
        images,
        settings: runtimeSettings,
        signal: controller.signal,
        requestId: requestContext.requestId,
      });
      const handled = await handleOrchestratorResult(result, runtimeSettings, event.sender, {
        channel: "submit-user-message",
        requestId: requestContext.requestId,
      });
      if (result?.session) {
        broadcastSessionSnapshot(result.session);
      }
      recordPerformanceMetric("ipc.submit-user-message", startedAt, {
        ok: true,
        meta: { requestId: requestContext.requestId, imageCount: images?.length || 0 },
      });
      return { ...handled, requestId: requestContext.requestId };
    } catch (err) {
      recordPerformanceMetric("ipc.submit-user-message", startedAt, {
        ok: false,
        meta: { requestId: requestContext.requestId, errorName: err?.name || "Error" },
      });
      throw wrapUserFacingError(err);
    } finally {
      setCurrentAIController(null);
    }
  });

  ipcMain.handle("mark-step-done", (event, payload) => runOrchestratorHandler("mark-step-done", event, (opts) => taskOrchestrator.markStepDone({ ...opts, images: payload?.images })));
  ipcMain.handle("request-step-help", (event, payload) => runOrchestratorHandler("request-step-help", event, (opts) => taskOrchestrator.requestStepHelp({ ...opts, images: payload?.images })));
  ipcMain.handle("recheck-current-step", (event, payload) => runOrchestratorHandler("recheck-current-step", event, (opts) => taskOrchestrator.recheckCurrentStep({ ...opts, images: payload?.images })));
  ipcMain.handle("skip-current-step", (event, payload) => runOrchestratorHandler("skip-current-step", event, (opts) => taskOrchestrator.skipCurrentStep({ ...opts, images: payload?.images })));
  ipcMain.handle("previous-step", (event, payload) => runOrchestratorHandler("previous-step", event, (opts) => taskOrchestrator.previousStep({ ...opts, images: payload?.images })));
  ipcMain.handle("regenerate-current-step", (event, payload) => runOrchestratorHandler("regenerate-current-step", event, (opts) => taskOrchestrator.regenerateCurrentStep({ ...opts, images: payload?.images })));

  ipcMain.handle("send-message", async (event, { text, images, history, fastMode, skipUserPersist, regenerate, introRequest }) => {
    const requestContext = createRequestContext("send-message");
    const startedAt = Date.now();
    debugLog("ipc:send-message start", {
      requestId: requestContext.requestId,
      textLength: text?.length || 0,
      imageCount: images?.length || 0,
      historyCount: history?.length || 0,
      fastMode: Boolean(fastMode),
      skipUserPersist: Boolean(skipUserPersist),
      regenerate: Boolean(regenerate),
    });
    if (getCurrentAIController()) getCurrentAIController().abort();
    const controller = new AbortController();
    setCurrentAIController(controller);
    if (Array.isArray(images) && images.length > 0) {
      updatePointerCalibration(images);
    }

    const activeSession = getActiveChatSessionRecord?.(store);
    const isMemoryChat = Boolean(activeSession?.isMemoryChat);
    let effectiveHistory;
    let chatOperation = "chat";

    if (!skipUserPersist && text && isPersonaSwitchRequest(text)) {
      sessionManager.addMessage({ role: "user", content: text });
      sessionManager.addMessage({ role: "assistant", content: PERSONA_SWITCH_REPLY });
      if (!isMemoryChat) {
        sessionManager.trimMessages(MAX_STORED_MESSAGES);
      }
      persistActiveSession(store, sessionManager.getSnapshot());
      broadcastSessionSnapshot(sessionManager.getSnapshot());
      if (!event.sender.isDestroyed()) {
        event.sender.send("ai-done", { spokenText: PERSONA_SWITCH_REPLY, coordinate: null, label: null, requestId: requestContext.requestId });
      }
      broadcastAgentState("idle");
      updateWidgetState("idle");
      setCurrentAIController(null);
      return { spokenText: PERSONA_SWITCH_REPLY, requestId: requestContext.requestId };
    }

    const settings = await getRuntimeSettings({
      ...PANEL_RUNTIME,
      modeOverlay: fastMode !== false ? ASSISTANT_CHAT_PROMPT : null,
      introDirective: introRequest === true,
    });
    const panelContextLimit = (() => {
      const { resolvePanelContextMessages } = require("../sauron/finops/cost-optimizer-config");
      return resolvePanelContextMessages(settings);
    })();

    if (isMemoryChat) {
      try {
        const allMessages = sessionManager?.getSnapshot()?.messages || [];
        effectiveHistory = buildMemoryChatHistory(allMessages, { maxRecent: panelContextLimit });
        chatOperation = "memory-chat";
      } catch (historyError) {
        appLogger.warn("memory-chat-history-fallback", { error: historyError });
        effectiveHistory = (sessionManager?.getSnapshot()?.messages || []).slice(-panelContextLimit);
      }
    } else {
      effectiveHistory = Array.isArray(history) && history.length > 0
        ? history.slice(-panelContextLimit)
        : (sessionManager?.getSnapshot()?.messages || []).slice(-panelContextLimit);
    }

    if (regenerate) {
      sessionManager.removeLastAssistantMessage();
    }

    if (!skipUserPersist && text) {
      sessionManager.addMessage({ role: "user", content: text });
      if (!isMemoryChat) {
        sessionManager.trimMessages(MAX_STORED_MESSAGES);
      }
    } else if (introRequest === true && !skipUserPersist) {
      sessionManager.addMessage({ role: "user", content: "Yeni sohbet başladı." });
    }

    broadcastAgentState("thinking");
    updateWidgetState("thinking");
    const requestSettings = { ...settings };
    try {
      const layerManager = taskOrchestrator?.isAwareAssistanceEnabled?.()
        ? taskOrchestrator.interactionPipeline
        : null;
      let enrichedText = introRequest === true && !String(text || "").trim()
        ? "Merhaba."
        : text;
      if (settings.panelAtFileContextEnabled !== false && settings.workspacePath && enrichedText) {
        const atFileResult = enrichTextWithAtFileContext(enrichedText, settings.workspacePath, true);
        enrichedText = atFileResult.text;
      }
      if (layerManager && Array.isArray(images) && images.length > 0) {
        try {
          const preContext = await layerManager.preprocess({
            images,
            step: null,
            sessionId: sessionManager?.getSnapshot?.().sessionId || "fast",
            signal: controller.signal,
          });
          if (preContext.ocrResult || preContext.windowInfo) {
            enrichedText = await layerManager.distillContext(text, preContext, requestSettings);
          }
        } catch (preErr) {
          appLogger.warn("send-message pre-layer error (non-fatal)", { error: preErr });
        }
      }

      const fullText = await streamAIResponse({
        text: enrichedText,
        images,
        history: effectiveHistory,
        settings: requestSettings,
        signal: controller.signal,
        sessionId: sessionManager?.getSnapshot?.()?.sessionId || "",
        operation: chatOperation,
        onChunk: (chunk) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send("ai-chunk", chunk);
          }
        },
      });

      const parsed = parsePointTag(fullText);
      const assistantContent = parsed.spokenText || fullText;
      sessionManager.addMessage({ role: "assistant", content: assistantContent });
      if (!isMemoryChat) {
        sessionManager.trimMessages(MAX_STORED_MESSAGES);
      }

      if (isMemoryChat) {
        setImmediate(() => {
          void maybeCompressMemoryChat({
            store,
            sessionManager,
            streamAIResponse,
            getRuntimeSettings,
            persistActiveSession,
            broadcastSessionSnapshot,
            getActiveChatSessionRecord,
            appLogger,
          });
        });
      }

      if (
        settings.autoMemoryExtractionEnabled === true
        && !isMemoryChat
        && text
        && assistantContent
        && !introRequest
      ) {
        setImmediate(() => {
          void (async () => {
            try {
              const taskSettings = await getRuntimeSettings(TASK_RUNTIME);
              const controller = new AbortController();
              const timer = setTimeout(() => controller.abort(), 20000);
              const newFacts = await extractMemoryFactsFromTurn({
                userText: text,
                assistantText: assistantContent,
                streamAIResponse,
                settings: taskSettings,
                signal: controller.signal,
              });
              clearTimeout(timer);
              if (!newFacts.length) {
                return;
              }
              const merged = mergeMemoryFacts(store.get("userMemoryFacts") || [], newFacts);
              store.set("userMemoryFacts", merged);
              if (typeof broadcastSettingsChanged === "function") {
                broadcastSettingsChanged();
              }
            } catch (memoryError) {
              appLogger.warn("auto-memory-extract failed", { error: memoryError?.message || memoryError });
            }
          })();
        });
      }

      const activePersonaId = resolveActivePersonaId(settings);
      if (
        activePersonaId === "luna"
        && settings.lunaRelationshipEnabled !== false
        && !isMemoryChat
        && !introRequest
        && text
        && assistantContent
      ) {
        const recordedProfile = recordLunaMessage(store.get("lunaRelationshipProfile") || emptyProfile());
        store.set("lunaRelationshipProfile", recordedProfile);
        if (typeof broadcastSettingsChanged === "function") {
          broadcastSettingsChanged();
        }

        setImmediate(() => {
          void (async () => {
            try {
              const taskSettings = await getRuntimeSettings(TASK_RUNTIME);
              const extractController = new AbortController();
              const extractTimer = setTimeout(() => extractController.abort(), 20000);
              const extraction = await extractLunaRelationshipFromTurn({
                userText: text,
                assistantText: assistantContent,
                streamAIResponse,
                settings: taskSettings,
                signal: extractController.signal,
              });
              clearTimeout(extractTimer);
              if (!hasExtractionContent(extraction)) {
                return;
              }
              const mergedProfile = mergeExtractionIntoProfile(
                store.get("lunaRelationshipProfile") || recordedProfile,
                extraction,
              );
              store.set("lunaRelationshipProfile", mergedProfile);
              if (typeof broadcastSettingsChanged === "function") {
                broadcastSettingsChanged();
              }
            } catch (relationshipError) {
              appLogger.warn("luna-relationship-extract failed", {
                error: relationshipError?.message || relationshipError,
              });
            }
          })();
        });
      }

      if (!event.sender.isDestroyed()) {
        event.sender.send("ai-done", { ...parsed, requestId: requestContext.requestId });
      }
      broadcastAgentState("idle");
      updateWidgetState("idle");

      let finalCoordinate = parsed.coordinate;
      if (layerManager && parsed.coordinate) {
        try {
          const postResult = await layerManager.postprocess({
            coordinate: parsed.coordinate,
            label: parsed.label,
            step: null,
            sessionId: sessionManager?.getSnapshot?.().sessionId || "fast",
            signal: controller?.signal,
          });
          if (postResult.confidence > 0.5 && postResult.coordinate) {
            finalCoordinate = postResult.coordinate;
          }
        } catch (postErr) {
          appLogger.warn("send-message post-layer error (non-fatal)", { error: postErr });
        }
      }

      if (finalCoordinate) {
        debugLog("send-message:pointer", {
          hasCoordinate: true,
          label: parsed.label || null,
        });
        showPointer({
          coordinate: finalCoordinate,
          label: parsed.label,
          explanation: parsed.spokenText,
          shouldPoint: true,
        });
      }

      try {
        await speakAssistantResponse(parsed.spokenText || fullText, settings, event.sender);
      } catch (ttsErr) {
        appLogger.error("send-message:tts-failed", {
          requestId: requestContext.requestId,
          error: ttsErr,
        });
      }
      recordPerformanceMetric("ipc.send-message", startedAt, {
        ok: true,
        meta: {
          requestId: requestContext.requestId,
          textLength: text?.length || 0,
          responseLength: fullText.length,
          imageCount: images?.length || 0,
        },
      });
    } catch (err) {
      recordPerformanceMetric("ipc.send-message", startedAt, {
        ok: false,
        meta: {
          requestId: requestContext.requestId,
          errorName: err?.name || "Error",
          imageCount: images?.length || 0,
        },
      });
      appLogger.error("ipc:send-message failed", {
        requestId: requestContext.requestId,
        error: err,
      });
      if (err.name !== "AbortError" && !event.sender.isDestroyed()) {
        event.sender.send("ai-error", toUiErrorPayload(err, requestContext));
      }
      broadcastAgentState("idle");
    } finally {
      setCurrentAIController(null);
    }
  });

  ipcMain.handle("abort-message", () => {
    debugLog("ipc:abort-message");
    if (getCurrentAIController()) {
      getCurrentAIController().abort();
      setCurrentAIController(null);
    }
    if (taskOrchestrator && typeof taskOrchestrator.abortActiveExecution === "function") {
      taskOrchestrator.abortActiveExecution();
    }
  });

  ipcMain.handle("get-assemblyai-token", async () => {
    debugLog("ipc:get-assemblyai-token");
    const settings = await getRuntimeSettings();
    if (settings.assemblyaiApiKey) {
      const resp = await fetch("https://streaming.assemblyai.com/v3/token?expires_in_seconds=480", {
        headers: { authorization: settings.assemblyaiApiKey },
      });
      if (!resp.ok) {
        const errBody = await resp.text().catch(() => "");
        throw new Error(`AssemblyAI token request failed (${resp.status}): ${errBody || resp.statusText}`);
      }
      const json = await resp.json();
      return json.token;
    }
    throw new Error("No AssemblyAI API key configured. Go to Settings → Voice and add your key.");
  });

  ipcMain.handle("get-ollama-models", async () => {
    debugLog("ipc:get-ollama-models");
    const ollamaUrl = store.get("ollamaUrl") || "http://localhost:11434";
    return fetchOllamaModels(ollamaUrl);
  });

  ipcMain.handle("cancel-active-plan", (_event, options) => {
    debugLog("ipc:cancel-active-plan");
    return taskOrchestrator.cancelActivePlan(options || {});
  });

  ipcMain.handle("get-luna-relationship-state", async () => {
    debugLog("ipc:get-luna-relationship-state");
    const settings = await getRuntimeSettings(PANEL_RUNTIME);
    return getLunaRelationshipState(settings);
  });

  ipcMain.handle("reset-luna-relationship", async () => {
    debugLog("ipc:reset-luna-relationship");
    const freshProfile = emptyProfile();
    store.set("lunaRelationshipProfile", freshProfile);
    if (typeof broadcastSettingsChanged === "function") {
      broadcastSettingsChanged();
    }
    const settings = await getRuntimeSettings(PANEL_RUNTIME);
    return getLunaRelationshipState(settings);
  });
}

module.exports = { registerAiIpc };
