import { MAX_AI_CONTEXT_MESSAGES, MAX_STORED_MESSAGES } from "./constants.js";
import { isWebStudioEnabled } from "./feature-visibility.js";

export function createMessagingController({
  api,
  doc = document,
  dom,
  log,
  state,
  ui,
  webStudio,
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
      const screens = await api.invoke("capture-screenshot", { forceFresh: true });
      state.setPendingScreenshots(screens);
      ui.renderScreenshotPreviewStrip(screens, () => {
        state.setPendingScreenshots(null);
        ui.renderScreenshotPreviewStrip(null);
        ui.updateScreenPendingBadge(0);
      });
      ui.updateScreenPendingBadge(screens?.length || 0);
      ui.showToast(`📷 ${screens.length} ekran yakalandı — gönderimde veya Tamamladım ile kullanılacak`);
    } catch (error) {
      ui.showToast("Ekran görüntüsü alınamadı: " + error.message, true);
      log("ipc:capture-screenshot error", error);
    }
  }

  function isGuideMode() {
    const mode = state.getSetting("assistantMode") || "assistant";
    return mode === "guide" || mode === "planning";
  }

  function collectImagesForSend() {
    let images = state.getPendingScreenshots();
    const attachmentPayload = buildAttachmentPayload(state.getPendingAttachments());
    if (attachmentPayload.images.length > 0) {
      images = [...(images || []), ...attachmentPayload.images];
    }
    return { images, attachmentPayload };
  }

  async function sendGuideMessage(text, options = {}) {
    const skipUserPersist = Boolean(options.skipUserPersist);
    const { images } = collectImagesForSend();

    if (!images?.length) {
      ui.showToast("Rehber modunda önce Ekran Al butonuna basın.", true);
      return;
    }

    state.setPendingScreenshots(null);
    state.clearPendingAttachments();
    ui.renderAttachmentPreviewStrip([], null);
    ui.renderScreenshotPreviewStrip(null);
    ui.updateScreenPendingBadge(0);
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
        log("ai:start-goal-session timeout 120s triggered");
        cancelMessage();
        ui.showToast("İstek zaman aşımına uğradı", true);
      }
    }, 120000);

    let typingId = null;
    try {
      if (!skipUserPersist) {
        ui.appendUserMessage(text);
        state.addConversationMessage({ role: "user", content: text });
      }
      typingId = ui.showTypingIndicator();
      await api.invoke("start-goal-session", { text, images });
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
      state.setStreaming(false);
      dom.sendBtn.classList.remove("hidden");
      const stopBtn = doc.getElementById("stop-btn");
      if (stopBtn) stopBtn.classList.add("hidden");
      dom.sendBtn.disabled = false;
      ui.renderAgentState("idle");
    }
  }

  function trimLocalHistory() {
    if (state.getConversationHistory().length > MAX_STORED_MESSAGES) {
      state.replaceConversationHistory(state.getConversationHistory().slice(-MAX_STORED_MESSAGES));
    }
  }

  async function maybeSuggestWebStudio(rawText) {
    if (!rawText || isGuideMode() || !webStudio?.openWizard) {
      return;
    }
    if (!isWebStudioEnabled(state.getSettings())) {
      return;
    }
    try {
      const intent = await api.invoke("detect-web-intent", { text: rawText });
      if (!intent?.suggestWebStudio) {
        return;
      }
      const open = await ui.confirmDialog({
        title: "Web Studio",
        message: "Kurumsal site için Web Studio (🌐) butonunu kullanın. Şimdi açılsın mı?",
        confirmLabel: "Web Studio aç",
        cancelLabel: "Sohbete devam",
      });
      if (open) {
        await webStudio.openWizard();
      }
    } catch (error) {
      log("detect-web-intent error", error);
    }
  }

  function flushMicroGuideConversationUi(sessionSnapshot) {
    const session = sessionSnapshot || state.getSessionSnapshot();
    if (!session) {
      return;
    }
    state.setSessionSnapshot(session);
    const messages = state.getConversationHistory();
    ui.renderConversation(messages);
    ui.scrollToBottom();
    ui.renderAgentState(session.status === "executing" ? "idle" : (session.status || "idle"));
    ui.renderPanelModeState({
      assistantMode: state.getSetting("assistantMode") || "assistant",
      sessionSnapshot: session,
    });
    if (dom.microGuideActions) {
      const micro = session?.microGuideSession;
      const active = Boolean(micro?.active);
      const waiting = micro?.status === "waiting_user" || micro?.status === "limit_reached";
      dom.microGuideActions.classList.toggle("hidden", !(active && waiting));
      if (dom.btnMicroGuideDone) {
        dom.btnMicroGuideDone.disabled = !active || micro?.status === "limit_reached";
      }
      if (dom.btnMicroGuideContinue) {
        dom.btnMicroGuideContinue.classList.toggle("hidden", micro?.status !== "limit_reached");
      }
      if (dom.btnMicroGuideCancel) {
        dom.btnMicroGuideCancel.disabled = !active;
      }
    }
  }

  async function runMicroGuideIpc(channel, payload, goalText) {
    state.setStreaming(true);
    dom.sendBtn.classList.add("hidden");
    const stopBtn = doc.getElementById("stop-btn");
    if (stopBtn) stopBtn.classList.remove("hidden");
    dom.sendBtn.disabled = true;
    ui.renderAgentState("thinking");

    currentAbortController = new AbortController();
    requestTimeoutId = window.setTimeout(() => {
      if (state.isStreaming()) {
        log(`ai:${channel} timeout 120s triggered`);
        cancelMessage();
        ui.showToast("İstek zaman aşımına uğradı", true);
      }
    }, 120000);

    let typingId = null;
    let ipcResult = null;
    try {
      if (goalText) {
        ui.appendUserMessage(goalText);
        state.addConversationMessage({ role: "user", content: goalText });
      }
      typingId = ui.showTypingIndicator();
      ipcResult = await api.invoke(channel, payload);
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
      state.setStreaming(false);
      dom.sendBtn.classList.remove("hidden");
      if (stopBtn) stopBtn.classList.add("hidden");
      dom.sendBtn.disabled = false;
      flushMicroGuideConversationUi(ipcResult?.session);
    }
  }

  async function startMicroGuideSession(goal) {
    const trimmedGoal = String(goal || "").trim() || "Ekranımda yardım et";
    dom.textInput.value = "";
    dom.textInput.style.height = "auto";
    ui.hideErrorBanner();

    let screens;
    try {
      screens = await api.invoke("capture-screenshot", { forceFresh: true });
      if (!screens?.length) {
        ui.showToast("Ekran görüntüsü alınamadı.", true);
        return;
      }
      ui.showToast(`📷 ${screens.length} ekran yakalandı — mikro rehber başlıyor`);
    } catch (error) {
      ui.showToast("Ekran görüntüsü alınamadı: " + error.message, true);
      log("micro-guide capture error", error);
      return;
    }

    await runMicroGuideIpc("start-micro-guide-session", { goal: trimmedGoal, images: screens }, trimmedGoal);
  }

  async function startCodeAgentSession(goal) {
    const trimmedGoal = String(goal || "").trim();
    if (!trimmedGoal) {
      ui.showToast("Görev metni gerekli.", true);
      return;
    }
    dom.textInput.value = "";
    dom.textInput.style.height = "auto";
    ui.hideErrorBanner();
    ui.renderAgentState("working");
    doc.getElementById("code-agent-badge")?.classList.remove("hidden");

    const result = await api.invoke("start-code-agent-session", { goal: trimmedGoal });
    doc.getElementById("code-agent-badge")?.classList.add("hidden");
    ui.renderAgentState("idle");

    if (!result?.ok) {
      ui.showToast(result?.error || "Kod agent başarısız", true);
      return;
    }
    ui.appendAssistantMessage(result.session?.summary || "Kod agent görevi tamamlandı.");
    ui.scrollToBottom();
  }

  async function ackMicroGuide() {
    if (state.isStreaming()) {
      return;
    }

    let screens;
    try {
      screens = await api.invoke("capture-screenshot", { forceFresh: true });
      if (!screens?.length) {
        ui.showToast("Ekran görüntüsü alınamadı.", true);
        return;
      }
      ui.showToast(`📷 Yeni ekran yakalandı — sonraki adım hazırlanıyor`);
    } catch (error) {
      ui.showToast("Ekran görüntüsü alınamadı: " + error.message, true);
      log("micro-guide ack capture error", error);
      return;
    }

    await runMicroGuideIpc("micro-guide-ack", { images: screens });
  }

  async function routeOutgoingMessage(rawText, text, options) {
    const intent = await api.invoke("detect-micro-guide-intent", { text: rawText });
    const codeIntent = await api.invoke("detect-code-intent", { text: rawText });
    const settings = state.getSettings() || {};
    let codeAgentActive = false;
    try {
      const status = await api.invoke("get-code-agent-status", {});
      codeAgentActive = Boolean(status?.active);
    } catch {
      codeAgentActive = false;
    }
    const routeResult = await api.invoke("resolve-message-route", {
      assistantMode: state.getSetting("assistantMode") || "assistant",
      microGuideActive: Boolean(state.getSessionSnapshot()?.microGuideSession?.active),
      microIntent: intent,
      codeAgentActive,
      codeIntent,
      codeAgentNativeEnabled: settings.codeAgentNativeEnabled === true,
      workspacePath: settings.workspacePath || "",
      text: rawText,
    });

    if (routeResult?.route === "micro_guide_busy") {
      ui.showToast("Mikro rehber aktif — Yaptım veya İptal kullanın.", false);
      return true;
    }

    if (routeResult?.route === "code_agent_busy") {
      ui.showToast("Kod agent aktif — tamamlanmasını bekleyin veya iptal edin.", false);
      return true;
    }

    if (routeResult?.route === "code_agent") {
      const confirmed = await ui.confirmDialog({
        title: "Yerel Kod Agent",
        message: "Bu görev yerel kod agent ile workspace'te çalıştırılsın mı? (Cline gerekmez)",
        confirmLabel: "Başlat",
        cancelLabel: "Sohbete devam",
      });
      if (!confirmed) {
        await sendAssistantMessage(text, options);
        return true;
      }
      await startCodeAgentSession(rawText);
      return true;
    }

    if (routeResult?.route === "micro_guide") {
      const confirmed = await ui.confirmDialog({
        title: "Ekran rehberliği",
        message: "Ekran rehberliği başlatılsın mı? Tek adımda yönlendirileceksiniz.",
        confirmLabel: "Başlat",
        cancelLabel: "Sohbete devam",
      });
      if (!confirmed) {
        if (isGuideMode()) {
          await sendGuideMessage(text, options);
        } else {
          await sendAssistantMessage(text, options);
        }
        return true;
      }
      await startMicroGuideSession(rawText);
      return true;
    }

    if (routeResult?.route === "plan_guide") {
      await sendGuideMessage(text, options);
      return true;
    }

    return false;
  }

  async function sendAssistantMessage(text, options = {}, rawText = "") {
    const displayText = rawText || text;

    void maybeSuggestWebStudio(displayText);

    const skipUserPersist = Boolean(options.skipUserPersist);
    const regenerate = Boolean(options.regenerate);

    let { images } = collectImagesForSend();
    if ((!images || images.length === 0) && state.getIncludeScreen()) {
      try {
        const screens = await api.invoke("capture-screenshot", { forceFresh: true });
        images = screens;
        if (screens?.length) {
          ui.renderScreenshotPreviewStrip(screens, null);
          ui.updateScreenPendingBadge(screens.length);
          ui.showToast("Ekran yakalandı — gönderince modele gidecek", false);
        }
      } catch (error) {
        log("auto-capture-screenshot error", error);
        ui.showToast("Ekran görüntüsü alınamadı — 📷 ile manuel deneyin.", true);
      }
    }

    state.setPendingScreenshots(null);
    state.clearPendingAttachments();
    ui.renderAttachmentPreviewStrip([], null);
    ui.renderScreenshotPreviewStrip(null);
    ui.updateScreenPendingBadge(0);
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
      textLength: displayText.length,
      skipUserPersist,
      regenerate,
    });

    try {
      if (!skipUserPersist) {
        ui.appendUserMessage(text);
        state.addConversationMessage({ role: "user", content: text });
      }
      typingId = ui.showTypingIndicator();

      const historyForRequest = skipUserPersist
        ? state.getConversationHistory().slice(-MAX_AI_CONTEXT_MESSAGES)
        : state.getConversationHistory().slice(-MAX_AI_CONTEXT_MESSAGES);

      await api.invoke("send-message", {
        text,
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

  async function sendMessage(overrideText, options = {}) {
    const rawText = typeof overrideText === "string"
      ? overrideText
      : dom.textInput.value.trim();

    const attachmentPayload = buildAttachmentPayload(state.getPendingAttachments());
    const attachmentSuffix = attachmentPayload.textSuffix;
    const text = [rawText, attachmentSuffix].filter(Boolean).join("\n\n").trim();

    if (!text || state.isStreaming()) {
      return;
    }

    try {
      const routed = await routeOutgoingMessage(rawText, text, options);
      if (routed) {
        return;
      }
    } catch (error) {
      log("route-outgoing-message error", error);
    }

    await sendAssistantMessage(text, options, rawText);
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

  function buildAttachmentPayload(attachments) {
    const images = [];
    const textParts = [];
    for (const attachment of attachments || []) {
      if (attachment?.type === "image" && attachment.base64Jpeg) {
        images.push({ base64Jpeg: attachment.base64Jpeg });
      } else if (attachment?.type === "text" && attachment.content) {
        textParts.push(`[${attachment.name || "dosya"}]\n${attachment.content}`);
      }
    }
    return {
      images,
      textSuffix: textParts.join("\n\n"),
    };
  }

  async function editMessage(index) {
    if (state.isStreaming()) {
      return;
    }
    const history = state.getConversationHistory().slice();
    const message = history[index];
    if (!message?.content) {
      return;
    }

    const newContent = await ui.promptDialog({
      title: "Mesajı düzenle",
      message: "Yeni mesaj metnini girin:",
      defaultValue: message.content,
      confirmLabel: "Kaydet",
      cancelLabel: "İptal",
    });
    if (newContent === null) {
      return;
    }
    const trimmed = String(newContent).trim();
    if (!trimmed) {
      ui.showToast("Mesaj boş olamaz", true);
      return;
    }

    const hadFollowingMessages = index < history.length - 1;
    try {
      const result = await api.invoke("edit-chat-message", { index, content: trimmed });
      if (!result?.ok) {
        ui.showToast(result?.error || "Mesaj güncellenemedi", true);
        return;
      }
      state.setSessionSnapshot(result.snapshot);
      ui.renderConversation(result.snapshot.messages || []);

      if (message.role === "user" && (hadFollowingMessages || result.snapshot.messages.length - 1 === index)) {
        await sendMessage(trimmed, { skipUserPersist: true, regenerate: false });
      }
    } catch (error) {
      log("edit-chat-message error", error);
      ui.showToast("Mesaj güncellenemedi", true);
    }
  }

  async function deleteMessage(index) {
    if (state.isStreaming()) {
      return;
    }
    const history = state.getConversationHistory();
    const message = history[index];
    if (!message) {
      return;
    }

    const shouldDelete = await ui.confirmDialog({
      title: "Mesaj silinsin mi?",
      message: "Bu mesaj kalıcı olarak silinecek.",
      confirmLabel: "Sil",
      cancelLabel: "İptal",
      confirmDanger: true,
    });
    if (!shouldDelete) {
      return;
    }

    try {
      const result = await api.invoke("delete-chat-message", { index });
      if (!result?.ok) {
        ui.showToast(result?.error || "Mesaj silinemedi", true);
        return;
      }
      state.setSessionSnapshot(result.snapshot);
      ui.renderConversation(result.snapshot.messages || []);
    } catch (error) {
      log("delete-chat-message error", error);
      ui.showToast("Mesaj silinemedi", true);
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
    collectImagesForSend,
    isGuideMode,
    syncSession,
    onAIDone,
    onAIError,
    cancelMessage,
    deleteMessage,
    editMessage,
    regenerateLastResponse,
    sendMessage,
    startMicroGuideSession,
    startCodeAgentSession,
    ackMicroGuide,
  };
}
