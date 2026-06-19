export function createMessagingController({
  api,
  doc = document,
  dom,
  log,
  state,
  ui,
}) {
  let syncQueue = Promise.resolve();
  let currentAbortController = null;
  let requestTimeoutId = null;

  function cancelMessage() {
    if (!state.isStreaming()) return;

    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
    }

    if (requestTimeoutId) {
      clearTimeout(requestTimeoutId);
      requestTimeoutId = null;
    }

    log("ai:cancel-message invoke");
    api.invoke("abort-message").catch(err => log("ipc:abort-message error", err));

    state.setStreaming(false);
    dom.sendBtn.classList.remove("hidden");
    const stopBtn = doc.getElementById("stop-btn");
    if (stopBtn) stopBtn.classList.add("hidden");
    dom.sendBtn.disabled = false;

    ui.renderAgentState("idle");
    ui.removeAllTypingIndicators();

    if (state.getStreamingBubble()) {
      state.clearStreamingSession();
    }
  }

  function syncSession(session) {
    syncQueue = syncQueue.then(() => syncSessionInternal(session)).catch((error) => {
      log("sync-session error", error);
    });
  }

  async function syncSessionInternal(session) {
    const previousMessages = state.getConversationHistory().slice();
    state.setSessionSnapshot(session);
    const nextMessages = state.getConversationHistory();

    if (
      previousMessages.length > nextMessages.length ||
      !nextMessages.every((message, index) =>
        index >= previousMessages.length ||
        (previousMessages[index].role === message.role &&
         previousMessages[index].content === message.content),
      )
    ) {
      ui.renderConversation(nextMessages);
      ui.scrollToBottom();
      return;
    }

    const newMessages = nextMessages.slice(previousMessages.length);
    if (newMessages.length === 0) {
      return;
    }

    for (const message of newMessages) {
      if (message.role === "user") {
        ui.appendUserMessage(message.content);
      } else {
        await ui.streamAssistantMessage(message.content);
      }
    }
    ui.scrollToBottom();
  }

  async function captureScreenshot() {
    ui.showToast("Capturing screen…");
    log("ipc:capture-screenshot invoke");

    try {
      const screens = await api.invoke("capture-screenshot");
      state.setPendingScreenshots(screens);
      ui.showToast(`📷 ${screens.length} screen(s) captured — will attach to next message`);
    } catch (error) {
      ui.showToast("Screenshot failed: " + error.message, true);
      log("ipc:capture-screenshot error", error);
    }
  }

  async function sendMessage(overrideText) {
    const rawText = typeof overrideText === "string"
      ? overrideText
      : dom.textInput.value.trim();

    if (!rawText || state.isStreaming()) {
      return;
    }

    let images = state.getPendingScreenshots();
    if (state.getIncludeScreen() && !images) {
      try {
        log("ipc:capture-screenshot invoke auto");
        images = await api.invoke("capture-screenshot");
      } catch (error) {
        log("ipc:capture-screenshot auto error", error);
      }
    }

    state.setPendingScreenshots(null);
    ui.hideErrorBanner();
    dom.textInput.value = "";
    dom.textInput.style.height = "auto";
    state.setStreaming(true);

    const stopBtn = doc.getElementById("stop-btn");
    dom.sendBtn.classList.add("hidden");
    if (stopBtn) stopBtn.classList.remove("hidden");
    dom.sendBtn.disabled = true;

    ui.renderAgentState("thinking");

    currentAbortController = new AbortController();
    requestTimeoutId = window.setTimeout(() => {
      if (state.isStreaming()) {
        log("ai:send-message timeout 60s triggered");
        cancelMessage();
        ui.showToast("Request timed out", true);
      }
    }, 60000);

    let typingId = null;
    log("ai:send-message start", {
      hasImages: Boolean(images && images.length),
      historyCount: state.getConversationHistory().length,
      textLength: rawText.length,
    });

    try {
      ui.appendUserMessage(rawText);
      state.addConversationMessage({ role: "user", content: rawText });
      typingId = ui.showTypingIndicator();

      await api.invoke("send-message", {
        text: rawText,
        images: images || [],
        history: state.getConversationHistory().slice(-8),
        fastMode: true,
      });
    } catch (error) {
      onAIError(error.message);
    } finally {
      if (requestTimeoutId) {
        clearTimeout(requestTimeoutId);
        requestTimeoutId = null;
      }
      if (typingId !== null) {
        ui.removeTypingIndicator(typingId);
      }
    }
  }

  function appendStreamChunk(chunk) {
    if (!state.getStreamingBubble()) {
      const { bubble } = ui.appendAssistantMessage("");
      state.setStreamingBubble(bubble);
      state.setStreamingText("");
    }

    state.appendStreamingText(chunk);
    state.getStreamingBubble().innerHTML = ui.simpleMarkdown(state.getStreamingText());
    ui.scrollToBottom();
    log("ipc:ai-chunk received", chunk.length);
  }

  function onAIDone(parsed) {
    const result = parsed || {};
    if (requestTimeoutId) {
      clearTimeout(requestTimeoutId);
      requestTimeoutId = null;
    }
    state.setStreaming(false);
    dom.sendBtn.classList.remove("hidden");
    const stopBtn = doc.getElementById("stop-btn");
    if (stopBtn) stopBtn.classList.add("hidden");
    dom.sendBtn.disabled = false;
    ui.renderAgentState("idle");

    const finalText = result.spokenText || state.getStreamingText();
    const streamingBubble = state.getStreamingBubble();
    if (streamingBubble) {
      ui.applyAssistantContent({
        messageElement: streamingBubble.closest(".message"),
        bubble: streamingBubble,
        text: finalText,
      });
      state.clearStreamingSession();
    }

    state.addConversationMessage({ role: "assistant", content: finalText });
    if (state.getConversationHistory().length > 40) {
      state.replaceConversationHistory(state.getConversationHistory().slice(-40));
    }

    if (result.coordinate) {
      window.setTimeout(() => api.send("hide-cursor"), 6000);
    }

    ui.scrollToBottom();
    log("ipc:ai-done received", {
      requestId: result.requestId || null,
      hasCoordinate: Boolean(result.coordinate),
      textLength: finalText.length,
    });
  }

  function onAIError(errorMessage) {
    const payload = typeof errorMessage === "string"
      ? { message: errorMessage, code: "unknown_error", action: "open-settings", requestId: "" }
      : (errorMessage || {});
    const safeMessage = payload.message || "Unexpected error";
    if (requestTimeoutId) {
      clearTimeout(requestTimeoutId);
      requestTimeoutId = null;
    }
    state.setStreaming(false);
    dom.sendBtn.classList.remove("hidden");
    const stopBtn = doc.getElementById("stop-btn");
    if (stopBtn) stopBtn.classList.add("hidden");
    dom.sendBtn.disabled = false;
    ui.renderAgentState("idle");
    ui.removeAllTypingIndicators();

    if (state.getStreamingBubble()) {
      state.clearStreamingSession();
    }

    ui.appendErrorMessage(safeMessage);
    ui.showErrorBanner({
      title: "Request failed",
      message: safeMessage,
      requestId: payload.requestId || "",
      actionLabel: payload.actionLabel || "Open settings",
      onAction: () => {
        if (payload.action === "retry") {
          ui.hideErrorBanner();
          return;
        }
        api.invoke("open-settings");
      },
    });
    log("ipc:ai-error received", payload);
  }

  return {
    appendStreamChunk,
    captureScreenshot,
    syncSession,
    onAIDone,
    onAIError,
    sendMessage,
    cancelMessage,
  };
}
