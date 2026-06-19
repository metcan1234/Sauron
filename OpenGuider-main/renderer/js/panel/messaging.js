import { MAX_AI_CONTEXT_MESSAGES, MAX_STORED_MESSAGES } from "./constants.js";

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

    if (state.isStreaming()) {
      return;
    }

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
    ui.showToast("Ekran görüntüsü alınıyor…");
    log("ipc:capture-screenshot invoke");

    try {
      const screens = await api.invoke("capture-screenshot");
      state.setPendingScreenshots(screens);
      ui.showToast(`📷 ${screens.length} ekran yakalandı — sonraki mesaja eklenecek`);
    } catch (error) {
      ui.showToast("Ekran görüntüsü alınamadı: " + error.message, true);
      log("ipc:capture-screenshot error", error);
    }
  }

  function trimLocalHistory() {
    if (state.getConversationHistory().length > MAX_STORED_MESSAGES) {
      state.replaceConversationHistory(state.getConversationHistory().slice(-MAX_STORED_MESSAGES));
    }
  }

  async function sendMessage(overrideText, options = {}) {
    const rawText = typeof overrideText === "string"
      ? overrideText
      : dom.textInput.value.trim();

    if (!rawText || state.isStreaming()) {
      return;
    }

    const skipUserPersist = Boolean(options.skipUserPersist);
    const regenerate = Boolean(options.regenerate);

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
        ui.showToast("İstek zaman aşımına uğradı", true);
      }
    }, 60000);

    let typingId = null;
    log("ai:send-message start", {
      hasImages: Boolean(images && images.length),
      historyCount: state.getConversationHistory().length,
      textLength: rawText.length,
      skipUserPersist,
      regenerate,
    });

    try {
      if (!skipUserPersist) {
        ui.appendUserMessage(rawText);
        state.addConversationMessage({ role: "user", content: rawText });
      }
      typingId = ui.showTypingIndicator();

      const historyForRequest = skipUserPersist
        ? state.getConversationHistory().slice(-MAX_AI_CONTEXT_MESSAGES)
        : state.getConversationHistory().slice(-MAX_AI_CONTEXT_MESSAGES);

      await api.invoke("send-message", {
        text: rawText,
        images: images || [],
        history: historyForRequest,
        fastMode: true,
        skipUserPersist,
        regenerate,
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

  async function regenerateLastResponse() {
    if (state.isStreaming()) {
      return;
    }

    const history = state.getConversationHistory().slice();
    let lastUser = null;
    for (let index = history.length - 1; index >= 0; index -= 1) {
      if (history[index]?.role === "user") {
        lastUser = history[index];
        break;
      }
    }

    if (!lastUser?.content) {
      ui.showToast("Yeniden üretilecek kullanıcı mesajı yok", true);
      return;
    }

    let removedAssistant = false;
    for (let index = history.length - 1; index >= 0; index -= 1) {
      if (history[index]?.role === "assistant") {
        history.splice(index, 1);
        removedAssistant = true;
        break;
      }
    }

    if (!removedAssistant) {
      ui.showToast("Yeniden üretilecek yanıt yok", true);
      return;
    }

    const assistantMessages = dom.chatMessages.querySelectorAll(".message.assistant");
    if (assistantMessages.length > 0) {
      assistantMessages[assistantMessages.length - 1].remove();
    }

    state.replaceConversationHistory(history);

    try {
      await api.invoke("remove-last-assistant-message");
    } catch (error) {
      log("remove-last-assistant-message error", error);
    }

    await sendMessage(lastUser.content, { skipUserPersist: true, regenerate: true });
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

    const localHistory = state.getConversationHistory();
    const lastMessage = localHistory[localHistory.length - 1];
    if (!lastMessage || lastMessage.role !== "assistant" || lastMessage.content !== finalText) {
      state.addConversationMessage({ role: "assistant", content: finalText });
    }
    trimLocalHistory();

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
    const safeMessage = payload.message || "Beklenmeyen hata";
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
      title: "İstek başarısız",
      message: safeMessage,
      requestId: payload.requestId || "",
      actionLabel: payload.actionLabel || "Ayarları aç",
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
    cancelMessage,
    regenerateLastResponse,
    sendMessage,
  };
}
