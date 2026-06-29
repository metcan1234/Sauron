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
}) {
  const { buildMemoryChatHistory } = require("../session/memory-chat-context");
  const { maybeCompressMemoryChat } = require("../session/memory-chat-compressor");
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
    const runtimeSettings = await getRuntimeSettings();

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
    const runtimeSettings = await getRuntimeSettings();
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
    const runtimeSettings = await getRuntimeSettings();
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

  ipcMain.handle("send-message", async (event, { text, images, history, fastMode, skipUserPersist, regenerate }) => {
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

    const settings = await getRuntimeSettings();
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
    }

    broadcastAgentState("thinking");
    updateWidgetState("thinking");
    const requestSettings = { ...settings };
    if (fastMode !== false) {
      const userPrompt = settings.systemPromptOverride || "";
      requestSettings.systemPromptOverride = `${userPrompt}\n\n${ASSISTANT_CHAT_PROMPT}`.trim();
    }
    try {
      const layerManager = taskOrchestrator?.isAwareAssistanceEnabled?.()
        ? taskOrchestrator.interactionPipeline
        : null;
      let enrichedText = text;
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
    throw new Error("AssemblyAI API anahtarı yok. Ayarlar → Ses bölümünden key girin.");
  });

  ipcMain.handle("get-stt-readiness", async () => {
    debugLog("ipc:get-stt-readiness");
    const settings = await getRuntimeSettings();
    const { resolveSttReadiness } = require("../sauron/stt-readiness");
    return resolveSttReadiness(settings);
  });

  ipcMain.handle("transcribe-whisper-audio", async (_event, payload = {}) => {
    debugLog("ipc:transcribe-whisper-audio");
    const settings = await getRuntimeSettings();
    const { resolveWhisperApiKey } = require("../sauron/stt-readiness");
    const apiKey = resolveWhisperApiKey(settings);
    if (!apiKey) {
      throw new Error("Whisper/OpenAI API anahtarı yok. Ayarlar → Ses bölümünden key girin.");
    }

    const audioBase64 = String(payload.audioBase64 || "").trim();
    if (!audioBase64) {
      throw new Error("Ses verisi alınamadı.");
    }

    const buffer = Buffer.from(audioBase64, "base64");
    const baseUrl = String(settings.whisperBaseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
    const endpoint = baseUrl.endsWith("/audio/transcriptions")
      ? baseUrl
      : `${baseUrl}/audio/transcriptions`;

    const form = new FormData();
    form.append(
      "file",
      new Blob([buffer], { type: payload.mimeType || "audio/webm" }),
      payload.fileName || "audio.webm",
    );
    form.append("model", settings.whisperModel || "whisper-1");
    const language = String(payload.language || "").trim();
    if (language) {
      form.append("language", language.split("-")[0]);
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      throw new Error(`Whisper Error ${response.status}: ${errBody || response.statusText}`);
    }

    const data = await response.json();
    return {
      ok: true,
      text: String(data.text || "").trim(),
    };
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
}

module.exports = { registerAiIpc };
