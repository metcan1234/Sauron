import { t } from "../i18n/index.js";

const PROVIDER_COLORS = {
  groq: "#f97316",
  claude: "#f59e0b",
  openrouter: "#10a37f",
  openai: "#10b981",
  gemini: "#3b82f6",
  deepseek: "#06b6d4",
  ollama: "#a855f7",
};

const BLINK_ASSETS = [
  "assets/logo.png",
  "assets/half-opened.png",
  "assets/full-closed.png",
  "assets/half-opened.png",
  "assets/logo.png",
];

export function queryPanelDom(doc = document) {
  return {
    panelRoot: doc.querySelector(".panel"),
    agentStatus: doc.getElementById("agent-status"),
    assistantModeBadge: doc.getElementById("assistant-mode-badge"),
    microGuideBadge: doc.getElementById("micro-guide-badge"),
    btnMicroGuide: doc.getElementById("btn-micro-guide"),
    btnCaptureScreen: doc.getElementById("btn-capture-screen"),
    btnAttachFile: doc.getElementById("btn-attach-file"),
    attachmentFileInput: doc.getElementById("attachment-file-input"),
    screenPendingBadge: doc.getElementById("screen-pending-badge"),
    modeBar: doc.getElementById("mode-bar"),
    modeBarPlugin: doc.getElementById("mode-bar-plugin"),
    modeBarTrust: doc.getElementById("mode-bar-trust"),
    modeBarStep: doc.getElementById("mode-bar-step"),
    browserTaskView: doc.getElementById("browser-task-view"),
    stepApprovalSection: doc.getElementById("step-approval-section"),
    stepApprovalCard: doc.getElementById("step-approval-card"),
    chatArea: doc.getElementById("chat-area"),
    chatMessages: doc.getElementById("chat-messages"),
    chatBackground: doc.getElementById("chat-background"),
    chatBackgroundLogo: doc.getElementById("chat-background-logo"),
    textInput: doc.getElementById("text-input"),
    sendBtn: doc.getElementById("send-btn"),
    modelSelect: doc.getElementById("model-select"),
    providerSelect: doc.getElementById("provider-select"),
    providerDot: doc.getElementById("provider-dot"),
    pttBtn: doc.getElementById("ptt-btn"),
    waveform: doc.getElementById("waveform"),
    btnSettings: doc.getElementById("btn-settings"),
    btnChatHistory: doc.getElementById("btn-chat-history"),
    btnGoose: doc.getElementById("btn-goose"),
    btnGamedev: doc.getElementById("btn-gamedev"),
    btnWorkspace: doc.getElementById("btn-workspace"),
    btnClose: doc.getElementById("btn-close"),
    btnClear: doc.getElementById("btn-clear"),
    planGoal: doc.getElementById("plan-goal"),
    planPanel: doc.getElementById("plan-panel"),
    panelActions: doc.getElementById("panel-actions"),
    microGuideActions: doc.getElementById("micro-guide-actions"),
    planProgress: doc.getElementById("plan-progress"),
    planSteps: doc.getElementById("plan-steps"),
    btnPlanDone: doc.getElementById("btn-plan-done"),
    btnPlanPrev: doc.getElementById("btn-plan-prev"),
    btnPlanSkip: doc.getElementById("btn-plan-skip"),
    btnPlanHelp: doc.getElementById("btn-plan-help"),
    btnPlanRegenerate: doc.getElementById("btn-plan-regenerate"),
    btnPlanRecheck: doc.getElementById("btn-plan-recheck"),
    btnPlanCancel: doc.getElementById("btn-plan-cancel"),
    btnMicroGuideDone: doc.getElementById("btn-micro-guide-done"),
    btnMicroGuideContinue: doc.getElementById("btn-micro-guide-continue"),
    btnMicroGuideCancel: doc.getElementById("btn-micro-guide-cancel"),
    errorBanner: doc.getElementById("error-banner"),
    errorBannerTitle: doc.getElementById("error-banner-title"),
    errorBannerMessage: doc.getElementById("error-banner-message"),
    errorBannerRequest: doc.getElementById("error-banner-request"),
    errorBannerAction: doc.getElementById("error-banner-action"),
    errorBannerDismiss: doc.getElementById("error-banner-dismiss"),
    workspaceStatusBanner: doc.getElementById("workspace-status-banner"),
    workspaceStatusTitle: doc.getElementById("workspace-status-title"),
    workspaceStatusMessage: doc.getElementById("workspace-status-message"),
    workspaceStatusFocus: doc.getElementById("workspace-status-focus"),
    workspaceStatusDismiss: doc.getElementById("workspace-status-dismiss"),
    handoffHistoryPanel: doc.getElementById("handoff-history-panel"),
    handoffHistoryList: doc.getElementById("handoff-history-list"),
    buildPipelinePanel: doc.getElementById("build-pipeline-panel"),
    buildPipelineMeta: doc.getElementById("build-pipeline-meta"),
    buildPipelineAdvance: doc.getElementById("build-pipeline-advance"),
    chatDrawerOverlay: doc.getElementById("chat-drawer-overlay"),
    chatDrawerClose: doc.getElementById("chat-drawer-close"),
    chatDrawerSearch: doc.getElementById("chat-drawer-search"),
    chatDrawerNew: doc.getElementById("chat-drawer-new"),
    chatDrawerMemory: doc.getElementById("chat-drawer-memory"),
    chatDrawerCreateFolder: doc.getElementById("chat-drawer-create-folder"),
    chatDrawerEphemeral: doc.getElementById("chat-drawer-ephemeral"),
    chatDrawerList: doc.getElementById("chat-drawer-list"),
    chatDrawerExportActive: doc.getElementById("chat-drawer-export-active"),
    onboardingOverlay: doc.getElementById("onboarding-overlay"),
    onboardingSkip: doc.getElementById("onboarding-skip"),
    onboardingOpenSettings: doc.getElementById("onboarding-open-settings"),
    confirmOverlay: doc.getElementById("confirm-overlay"),
    confirmTitle: doc.getElementById("confirm-title"),
    confirmMessage: doc.getElementById("confirm-message"),
    confirmCancel: doc.getElementById("confirm-cancel"),
    confirmConfirm: doc.getElementById("confirm-confirm"),
    promptOverlay: doc.getElementById("prompt-overlay"),
    promptTitle: doc.getElementById("prompt-title"),
    promptMessage: doc.getElementById("prompt-message"),
    promptInput: doc.getElementById("prompt-input"),
    promptCancel: doc.getElementById("prompt-cancel"),
    promptConfirm: doc.getElementById("prompt-confirm"),
    finopsBadge: doc.getElementById("finops-badge"),
    toast: doc.getElementById("toast"),
    attachmentPreviewStrip: doc.getElementById("attachment-preview-strip"),
    artifactPanel: doc.getElementById("artifact-panel"),
    artifactPanelTitle: doc.getElementById("artifact-panel-title"),
    artifactPanelContent: doc.getElementById("artifact-panel-content"),
    artifactPanelClose: doc.getElementById("artifact-panel-close"),
    artifactPanelCopy: doc.getElementById("artifact-panel-copy"),
    artifactPanelDownload: doc.getElementById("artifact-panel-download"),
  };
}

export function createPanelUI({ api, doc = document, dom, log, state }) {
  let workspaceStatusFocusCallback = null;

  function normalizeUrl(url) {
    const trimmed = String(url || "").trim();
    if (!trimmed) {
      return "";
    }
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
    if (/^www\./i.test(trimmed)) {
      return `https://${trimmed}`;
    }
    return "";
  }

  function buildLink(url, label) {
    const href = normalizeUrl(url);
    if (!href) {
      return label;
    }
    return `<a class="message-link" href="${href}" data-external-link="1">${label}</a>`;
  }

  function linkifyText(text) {
    return text.replace(/(^|[\s(])((?:https?:\/\/|www\.)[^\s<]+)/gim, (full, prefix, candidate) => {
      let raw = candidate;
      let trailing = "";
      while (/[),.!?:;]$/.test(raw)) {
        trailing = raw.slice(-1) + trailing;
        raw = raw.slice(0, -1);
      }
      const anchor = buildLink(raw, raw);
      return `${prefix}${anchor}${trailing}`;
    });
  }

  function makeCopyButton(messageElement) {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "copy-icon-btn";
    button.title = "Yanıtı kopyala";
    button.setAttribute("aria-label", "Yanıtı kopyala");
    button.textContent = "⧉";

    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const text = messageElement.dataset.copyText || "";
      if (!text) {
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        button.classList.add("copied");
        showToast("Kopyalandı");
        window.setTimeout(() => button.classList.remove("copied"), 700);
      } catch (error) {
        showToast("Kopyalama başarısız", true);
      }
    });

    return button;
  }

  function makeRegenerateButton() {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "regenerate-icon-btn";
    button.title = "Yeniden üret";
    button.setAttribute("aria-label", "Yeniden üret");
    button.textContent = "↻";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      doc.dispatchEvent(new CustomEvent("openguide:regenerate-response"));
    });
    return button;
  }

  function makeEditButton(messageIndex, role) {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "message-action-btn edit-msg-btn";
    button.title = "Düzenle";
    button.setAttribute("aria-label", "Mesajı düzenle");
    button.textContent = "✏️";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      doc.dispatchEvent(new CustomEvent("openguide:edit-message", {
        detail: { index: messageIndex, role },
      }));
    });
    return button;
  }

  function makeDeleteButton(messageIndex) {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "message-action-btn delete-msg-btn";
    button.title = "Sil";
    button.setAttribute("aria-label", "Mesajı sil");
    button.textContent = "🗑";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      doc.dispatchEvent(new CustomEvent("openguide:delete-message", {
        detail: { index: messageIndex },
      }));
    });
    return button;
  }

  function makeOpenArtifactButton(code, language) {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "artifact-open-btn";
    button.title = "Panelde aç";
    button.textContent = "⧉ Panel";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openArtifactPanel(code, language);
    });
    return button;
  }

  function splitThinkingText(text, collapseThinking = false) {
    const source = String(text || "");
    const thoughtParts = [];

    let visibleText = source.replace(/<think>([\s\S]*?)<\/think>/gi, (_match, part) => {
      if (part && part.trim()) {
        thoughtParts.push(part.trim());
      }
      return "";
    });

    if (collapseThinking) {
      const keptLines = [];
      for (const line of visibleText.split("\n")) {
        if (/^\s*(thinking|reasoning|analysis|thought process)\s*[:\-]/i.test(line)) {
          const cleaned = line.replace(/^\s*(thinking|reasoning|analysis|thought process)\s*[:\-]\s*/i, "").trim();
          if (cleaned) {
            thoughtParts.push(cleaned);
          }
          continue;
        }
        keptLines.push(line);
      }
      visibleText = keptLines.join("\n");
    }

    return {
      visibleText: visibleText.trim(),
      thinkingText: thoughtParts.join("\n\n").trim(),
    };
  }

  function buildAssistantMeta(messageElement, messageIndex) {
    const meta = doc.createElement("span");
    meta.className = "msg-meta";

    const time = doc.createElement("span");
    time.textContent = new Date().toLocaleString([], {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    const badge = doc.createElement("span");
    badge.className = "msg-badge";
    badge.textContent = "AI";

    const actions = doc.createElement("span");
    actions.className = "assistant-meta-actions";
    if (Number.isFinite(messageIndex)) {
      actions.appendChild(makeEditButton(messageIndex, "assistant"));
      actions.appendChild(makeDeleteButton(messageIndex));
    }
    actions.appendChild(makeRegenerateButton());
    actions.appendChild(makeCopyButton(messageElement));

    meta.appendChild(time);
    meta.appendChild(badge);
    meta.appendChild(actions);
    return meta;
  }

  function applyAssistantContent({ messageElement, bubble, text, collapseThinking = false }) {
    const { visibleText, thinkingText } = splitThinkingText(text, collapseThinking);
    bubble.innerHTML = simpleMarkdown(visibleText || "...");
    messageElement.dataset.copyText = visibleText || "";

    const existingThinking = messageElement.querySelector(".thinking-box");
    if (existingThinking) {
      existingThinking.remove();
    }

    if (collapseThinking && thinkingText) {
      const details = doc.createElement("details");
      details.className = "thinking-box";

      const summary = doc.createElement("summary");
      summary.textContent = "Thinking";
      details.appendChild(summary);

      const content = doc.createElement("div");
      content.className = "thinking-content";
      content.innerHTML = simpleMarkdown(thinkingText);
      details.appendChild(content);

      messageElement.appendChild(details);
    }
  }

  function startBackgroundBlinkLoop() {
    if (!dom.chatBackgroundLogo) {
      return;
    }
    const delay = 3000 + Math.random() * 2000;
    window.setTimeout(() => executeBackgroundBlink(0), delay);
  }

  function executeBackgroundBlink(index) {
    if (!dom.chatBackgroundLogo) {
      return;
    }
    if (index >= BLINK_ASSETS.length) {
      startBackgroundBlinkLoop();
      return;
    }
    dom.chatBackgroundLogo.src = BLINK_ASSETS[index];
    window.setTimeout(() => executeBackgroundBlink(index + 1), 80);
  }

  function updateChatBackgroundState(messageCount) {
    const hasMessages = messageCount > 0;
    dom.chatArea.classList.toggle("has-messages", hasMessages);
  }

  function resolveCoreRoutingMode(settings = {}) {
    if (settings.agentControlMode === "manual") return "manual";
    if (settings.agentControlMode === "mixed") {
      return settings.coreRoutingMode || "auto";
    }
    return "auto";
  }

  function buildProviderSelector() {
    if (!dom.providerSelect) {
      return;
    }
    const settings = state.getSettings();
    const provider = settings.coreManualAgent || settings.aiProvider || "gemini";
    dom.providerSelect.value = provider;
    updateProviderDot();
  }

  function buildModelSelector() {
    const settings = state.getSettings();
    const provider = settings.coreManualAgent || settings.aiProvider || "gemini";
    const customKey = provider + "ModelCustom";
    const savedModel = settings[customKey] || settings.aiModel || "";

    dom.modelSelect.innerHTML = "";

    if (savedModel) {
      const option = doc.createElement("option");
      option.value = savedModel;
      option.textContent = savedModel;
      dom.modelSelect.appendChild(option);
      dom.modelSelect.value = savedModel;
    } else {
      const option = doc.createElement("option");
      option.value = "";
      option.textContent = "— Configure model in Settings —";
      option.disabled = true;
      option.selected = true;
      dom.modelSelect.appendChild(option);
    }

    if (provider === "ollama") {
      api.invoke("get-ollama-models").then((ollamaModels) => {
        if (ollamaModels && ollamaModels.length > 0) {
          dom.modelSelect.innerHTML = "";
          for (const modelName of ollamaModels) {
            const option = doc.createElement("option");
            option.value = modelName;
            option.textContent = modelName;
            dom.modelSelect.appendChild(option);
          }

          if (savedModel && ollamaModels.includes(savedModel)) {
            dom.modelSelect.value = savedModel;
          } else {
            dom.modelSelect.value = ollamaModels[0];
            state.setSetting("aiModel", ollamaModels[0]);
          }
        }
      }).catch((error) => {
        log("ipc:get-ollama-models error", error);
      });
    }
  }

  function updateProviderDot() {
    const settings = state.getSettings();
    const provider = settings.coreManualAgent || state.getSetting("aiProvider") || "gemini";
    const routingMode = resolveCoreRoutingMode(settings);
    const modeLabel = routingMode === "manual" ? "MANUAL" : "AUTO";
    dom.providerDot.style.background = PROVIDER_COLORS[provider] || "#64748b";
    dom.providerDot.title = `${modeLabel} · ${provider}`;
    if (dom.providerSelect && dom.providerSelect.value !== provider) {
      dom.providerSelect.value = provider;
    }
  }

  function appendMemorySummaryMessage(text, messageIndex) {
    const messageElement = doc.createElement("div");
    messageElement.className = "message memory-summary";
    if (Number.isFinite(messageIndex)) {
      messageElement.dataset.messageIndex = String(messageIndex);
    }

    const card = doc.createElement("div");
    card.className = "memory-summary-card";

    const heading = doc.createElement("div");
    heading.className = "memory-summary-title";
    heading.textContent = "Geçmiş özeti";

    const body = doc.createElement("p");
    body.textContent = String(text || "").trim();

    card.appendChild(heading);
    card.appendChild(body);
    messageElement.appendChild(card);
    dom.chatMessages.appendChild(messageElement);
    scrollToBottom();
  }

  function appendUserMessage(text, images, messageIndex) {
    const messageElement = doc.createElement("div");
    messageElement.className = "message user";
    if (Number.isFinite(messageIndex)) {
      messageElement.dataset.messageIndex = String(messageIndex);
    }

    const bubble = doc.createElement("div");
    bubble.className = "bubble";

    if (images && images.length > 0) {
      const image = doc.createElement("img");
      image.className = "screenshot-thumb";
      image.src = `data:image/jpeg;base64,${images[0].base64Jpeg}`;
      bubble.appendChild(image);
    }

    const paragraph = doc.createElement("p");
    paragraph.textContent = text;
    bubble.appendChild(paragraph);

    const meta = doc.createElement("span");
    meta.className = "msg-meta";
    const time = doc.createElement("span");
    time.textContent = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    meta.appendChild(time);

    if (Number.isFinite(messageIndex)) {
      const actions = doc.createElement("span");
      actions.className = "user-meta-actions";
      actions.appendChild(makeEditButton(messageIndex, "user"));
      actions.appendChild(makeDeleteButton(messageIndex));
      meta.appendChild(actions);
    }

    messageElement.appendChild(bubble);
    messageElement.appendChild(meta);
    dom.chatMessages.appendChild(messageElement);
    updateChatBackgroundState(dom.chatMessages.childElementCount);
    scrollToBottom();
  }

  function appendAssistantMessage(text, messageIndex) {
    const collapseThinking = false;
    const messageElement = doc.createElement("div");
    messageElement.className = "message assistant";
    if (Number.isFinite(messageIndex)) {
      messageElement.dataset.messageIndex = String(messageIndex);
    }

    const bubble = doc.createElement("div");
    bubble.className = "bubble";
    applyAssistantContent({
      messageElement,
      bubble,
      text,
      collapseThinking,
    });

    messageElement.appendChild(bubble);
    messageElement.appendChild(buildAssistantMeta(messageElement, messageIndex));
    dom.chatMessages.appendChild(messageElement);
    updateChatBackgroundState(dom.chatMessages.childElementCount);
    scrollToBottom();

    return { el: messageElement, bubble };
  }

  async function streamAssistantMessage(text, { collapseThinking = false } = {}) {
    const messageElement = doc.createElement("div");
    messageElement.className = "message assistant";

    const bubble = doc.createElement("div");
    bubble.className = "bubble";
    messageElement.appendChild(bubble);
    messageElement.appendChild(buildAssistantMeta(messageElement));
    dom.chatMessages.appendChild(messageElement);
    updateChatBackgroundState(dom.chatMessages.childElementCount);

    const { visibleText } = splitThinkingText(text, collapseThinking);
    const targetText = visibleText || "...";
    const step = Math.max(2, Math.ceil(targetText.length / 80));
    let cursor = 0;

    while (cursor < targetText.length) {
      cursor = Math.min(targetText.length, cursor + step);
      bubble.innerHTML = simpleMarkdown(targetText.slice(0, cursor));
      scrollToBottom();
      // Small delay for perceived streaming.
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => window.setTimeout(resolve, 12));
    }

    applyAssistantContent({
      messageElement,
      bubble,
      text,
      collapseThinking,
    });
    scrollToBottom();
    return { el: messageElement, bubble };
  }

  function appendErrorMessage(message) {
    const element = doc.createElement("div");
    element.className = "message assistant";
    element.innerHTML = `<div class="bubble" style="border-color:rgba(239,68,68,0.3);color:#fca5a5">⚠ ${escapeHtml(message)}</div>`;
    dom.chatMessages.appendChild(element);
    updateChatBackgroundState(dom.chatMessages.childElementCount);
    scrollToBottom();
  }

  function appendRawElement(element) {
    dom.chatMessages.appendChild(element);
    updateChatBackgroundState(dom.chatMessages.childElementCount);
    scrollToBottom();
  }

  function injectSystemNotice(text, type = "info", options = {}) {
    if (!dom.chatMessages) {
      return null;
    }

    const notice = doc.createElement("div");
    notice.className = `system-notice system-notice-${type}`;
    if (options?.richText) {
      notice.classList.add("system-notice-rich");
    }

    const textNode = doc.createElement("span");
    textNode.className = "system-notice-text";
    if (options?.richText) {
      textNode.innerHTML = simpleMarkdown(text);
    } else {
      textNode.textContent = text;
    }

    notice.appendChild(textNode);
    dom.chatMessages.appendChild(notice);
    updateChatBackgroundState(dom.chatMessages.childElementCount);
    scrollToBottom();
    return notice;
  }

  function showTypingIndicator() {
    const id = state.nextTypingId();
    const element = doc.createElement("div");
    element.className = "message assistant";
    element.id = `typing-${id}`;
    element.innerHTML = `<div class="typing-indicator"><span></span><span></span><span></span></div>`;
    dom.chatMessages.appendChild(element);
    updateChatBackgroundState(dom.chatMessages.childElementCount);
    scrollToBottom();
    return id;
  }

  function removeTypingIndicator(id) {
    const element = doc.getElementById(`typing-${id}`);
    if (element) {
      element.remove();
    }
  }

  function removeAllTypingIndicators() {
    doc.querySelectorAll('[id^="typing-"]').forEach((element) => element.remove());
  }

  function clearConversation() {
    renderConversation([]);
  }

  function renderConversation(messages) {
    dom.chatMessages.innerHTML = "";

    if (!Array.isArray(messages) || messages.length === 0) {
      updateChatBackgroundState(0);
      return;
    }

    messages.forEach((message, index) => {
      if (message.role === "memory-summary") {
        appendMemorySummaryMessage(message.content, index);
      } else if (message.role === "user") {
        appendUserMessage(message.content, message.images, index);
      } else {
        appendAssistantMessage(message.content, index);
      }
    });
    updateChatBackgroundState(dom.chatMessages.childElementCount);
  }

  function renderAgentState(nextState) {
    if (!dom.agentStatus) {
      return;
    }

    const value = nextState || "idle";
    dom.agentStatus.textContent = value.replace(/_/g, " ");
    dom.agentStatus.dataset.state = value;
  }

  function scrollToBottom() {
    dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
  }

  function highlightCode(code, language) {
    let html = escapeHtml(code);
    const lang = String(language || "text").toLowerCase();

    if (["javascript", "js", "typescript", "ts", "jsx", "tsx"].includes(lang)) {
      html = html.replace(/\b(const|let|var|function|return|if|else|async|await|import|from|export|class|new|try|catch|throw|typeof|instanceof)\b/g, '<span class="tok-keyword">$1</span>');
      html = html.replace(/(\/\/[^\n]*)/g, '<span class="tok-comment">$1</span>');
      html = html.replace(/(&quot;[^&]*?&quot;|'[^']*'|`[^`]*`)/g, '<span class="tok-string">$1</span>');
    } else if (["python", "py"].includes(lang)) {
      html = html.replace(/\b(def|class|return|if|elif|else|for|while|import|from|as|try|except|with|async|await|pass|raise|True|False|None)\b/g, '<span class="tok-keyword">$1</span>');
      html = html.replace(/(#[^\n]*)/g, '<span class="tok-comment">$1</span>');
      html = html.replace(/(&quot;[^&]*?&quot;|'[^']*')/g, '<span class="tok-string">$1</span>');
    } else if (["bash", "sh", "shell", "powershell", "ps1"].includes(lang)) {
      html = html.replace(/(#[^\n]*)/g, '<span class="tok-comment">$1</span>');
      html = html.replace(/(&quot;[^&]*?&quot;|'[^']*')/g, '<span class="tok-string">$1</span>');
    }

    return html;
  }

  function buildCodeBlock(language, code) {
    const lang = String(language || "text").trim() || "text";
    const highlighted = highlightCode(code, lang);
    const encoded = encodeURIComponent(String(code || ""));
    return [
      '<div class="code-block">',
      `<div class="code-block-header"><span class="code-lang">${escapeHtml(lang)}</span>`,
      `<button type="button" class="code-artifact-btn" data-code="${encoded}" data-lang="${escapeHtml(lang)}" title="Panelde aç" aria-label="Panelde aç">⧉ Panel</button>`,
      `<button type="button" class="code-copy-btn" data-code="${encoded}" title="Kopyala" aria-label="Kodu kopyala">⧉</button></div>`,
      `<pre><code class="language-${escapeHtml(lang)}">${highlighted}</code></pre>`,
      "</div>",
    ].join("");
  }

  function simpleMarkdown(text) {
    const placeholders = [];
    const stash = (html) => {
      const key = `@@HTML${placeholders.length}@@`;
      placeholders.push({ key, html });
      return key;
    };

    let rendered = String(text || "")
      .replace(/\r\n/g, "\n")
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "  ")
      .replace(/\[POINT:[^\]]+\]/gi, "")
      .replace(/\{[^{}]*"point"\s*:\s*\[\d+,\s*\d+\][^{}]*"label"\s*:\s*"[^"]+"[^{}]*\}/gi, "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/```([\w+-]*)\n([\s\S]*?)```/g, (_match, lang, code) => stash(buildCodeBlock(lang, code)))
      .replace(/`([^`]+)`/g, (_match, code) => stash(`<code class="inline-code">${code}</code>`))
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label, url) => {
        return stash(buildLink(url, label));
      });

    rendered = linkifyText(rendered)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/^### (.+)$/gm, "<strong>$1</strong>")
      .replace(/^## (.+)$/gm, "<strong>$1</strong>")
      .replace(/^# (.+)$/gm, "<strong>$1</strong>")
      .replace(/^[\*\-] (.+)$/gm, "<li>$1</li>")
      .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br/>")
      .replace(/^(?!<)(.+?)(?=$)/gm, "<p>$1</p>");

    placeholders.forEach(({ key, html }) => {
      rendered = rendered.replaceAll(key, html);
    });
    return rendered;
  }

  function escapeHtml(value) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function showToast(message, isError = false) {
    dom.toast.textContent = message;
    dom.toast.classList.remove("hidden");
    dom.toast.style.borderColor = isError ? "rgba(239,68,68,0.4)" : "";
    dom.toast.style.color = isError ? "#fca5a5" : "";

    clearTimeout(state.getToastTimer());
    state.setToastTimer(
      window.setTimeout(() => dom.toast.classList.add("hidden"), 3000),
    );
  }

  function hideErrorBanner() {
    if (!dom.errorBanner) {
      return;
    }
    dom.errorBanner.classList.add("hidden");
  }

  function showErrorBanner({
    title = "Bir hata oluştu",
    message = "Bilinmeyen hata",
    requestId = "",
    actionLabel = "Ayarları aç",
    onAction = null,
  } = {}) {
    if (!dom.errorBanner) {
      showToast(message, true);
      return;
    }
    dom.errorBannerTitle.textContent = title;
    dom.errorBannerMessage.textContent = message;
    dom.errorBannerRequest.textContent = requestId ? `Request ID: ${requestId}` : "";
    dom.errorBannerAction.textContent = actionLabel;
    dom.errorBanner.classList.remove("hidden");

    dom.errorBannerAction.onclick = () => {
      if (typeof onAction === "function") {
        onAction();
      }
    };
    dom.errorBannerDismiss.onclick = () => {
      hideErrorBanner();
    };
  }

  function hideWorkspaceStatus() {
    if (!dom.workspaceStatusBanner) {
      return;
    }
    dom.workspaceStatusBanner.classList.add("hidden");
    dom.workspaceStatusBanner.classList.remove("is-success", "is-warning");
    workspaceStatusFocusCallback = null;
  }

  async function invokeWorkspaceStatusFocus() {
    if (typeof workspaceStatusFocusCallback === "function") {
      await workspaceStatusFocusCallback();
      return true;
    }
    return false;
  }

  function showWorkspaceStatus({
    title = "Çalışma Kısmı",
    message = "",
    tone = "default",
    onFocus = null,
  } = {}) {
    if (!dom.workspaceStatusBanner) {
      showToast(message);
      return;
    }
    dom.workspaceStatusTitle.textContent = title;
    dom.workspaceStatusMessage.textContent = message;
    dom.workspaceStatusBanner.classList.remove("hidden", "is-success", "is-warning");
    if (tone === "success") {
      dom.workspaceStatusBanner.classList.add("is-success");
    } else if (tone === "warning") {
      dom.workspaceStatusBanner.classList.add("is-warning");
    }

    workspaceStatusFocusCallback = typeof onFocus === "function" ? onFocus : null;
  }

  function renderHandoffHistory(items = []) {
    if (!dom.handoffHistoryList) {
      return;
    }

    const pendingCount = items.filter((item) => item?.status === "pending").length;
    if (dom.btnWorkspace) {
      dom.btnWorkspace.classList.toggle("has-pending-handoff", pendingCount > 0);
      if (pendingCount > 0) {
        dom.btnWorkspace.title = `Çalışma Kısmı — ${pendingCount} bekleyen handoff`;
      }
    }

    if (!Array.isArray(items) || items.length === 0) {
      dom.handoffHistoryPanel?.classList.add("hidden");
      dom.handoffHistoryList.innerHTML = "";
      return;
    }

    dom.handoffHistoryPanel?.classList.remove("hidden");

    dom.handoffHistoryList.innerHTML = items.map((item) => {
      const status = escapeHtml(String(item?.status || "unknown"));
      const fileName = escapeHtml(String(item?.fileName || ""));
      const createdAt = escapeHtml(String(item?.createdAt || "").slice(0, 19).replace("T", " "));
      const goal = escapeHtml(String(item?.goal || item?.taskSummary || "").slice(0, 80));
      const rejectBtn = status === "pending"
        ? `<button type="button" class="workspace-status-btn ghost handoff-reject-btn" data-handoff-file="${fileName}">Reddet</button>`
        : "";
      return `<li class="handoff-history-item ${status}"><div><strong>${fileName}</strong><span class="handoff-history-meta">${createdAt} · ${status}${goal ? ` · ${goal}` : ""}</span></div>${rejectBtn}</li>`;
    }).join("");

    dom.handoffHistoryList.querySelectorAll(".handoff-reject-btn").forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        const handoffFileName = button.getAttribute("data-handoff-file");
        if (!handoffFileName) return;
        try {
          await api.invoke("reject-handoff-file", { handoffFileName });
          showToast("Handoff reddedildi", false);
          if (typeof state.refreshHandoffHistory === "function") {
            await state.refreshHandoffHistory();
          }
        } catch (error) {
          showToast(error?.message || "Handoff reddedilemedi", true);
        }
      });
    });
  }

  function renderBuildPipeline(status = {}) {
    const pipeline = status?.pipeline;
    if (!dom.buildPipelinePanel || !dom.buildPipelineMeta) {
      return;
    }
    if (!pipeline || pipeline.status === "completed") {
      dom.buildPipelinePanel.classList.add("hidden");
      return;
    }
    dom.buildPipelinePanel.classList.remove("hidden");
    const est = pipeline.totalEstimatedCostTl ? ` · ~${pipeline.totalEstimatedCostTl} TL` : "";
    dom.buildPipelineMeta.textContent = `${pipeline.label || pipeline.templateId} — faz ${pipeline.currentPhase}/${pipeline.totalPhases}${est}`;
    if (dom.buildPipelineAdvance) {
      dom.buildPipelineAdvance.classList.toggle("hidden", !status.pendingComplete);
    }
  }

  function showOnboarding() {
    if (dom.onboardingOverlay) {
      dom.onboardingOverlay.classList.remove("hidden");
    }
  }

  function hideOnboarding() {
    if (dom.onboardingOverlay) {
      dom.onboardingOverlay.classList.add("hidden");
    }
  }

  function confirmDialog(message, options = {}) {
    if (!dom.confirmOverlay || !dom.confirmCancel || !dom.confirmConfirm) {
      return Promise.resolve(true);
    }

    const config = typeof message === "object" && message !== null
      ? { ...options, ...message }
      : { message, ...options };

    return new Promise((resolve) => {
      if (dom.confirmTitle) {
        dom.confirmTitle.textContent = config.title || "Clear Conversation?";
      }
      dom.confirmMessage.textContent = config.message || "";
      dom.confirmCancel.textContent = config.cancelLabel || "Cancel";
      dom.confirmConfirm.textContent = config.confirmLabel || "Clear";
      dom.confirmConfirm.classList.toggle(
        "danger",
        config.confirmDanger ?? (config.confirmLabel || "Clear") === "Clear",
      );
      dom.confirmOverlay.classList.remove("hidden");
      dom.confirmConfirm.focus();

      let settled = false;

      function finish(result) {
        if (settled) {
          return;
        }
        settled = true;
        dom.confirmOverlay.classList.add("hidden");
        dom.confirmCancel.removeEventListener("click", onCancel);
        dom.confirmConfirm.removeEventListener("click", onConfirm);
        doc.removeEventListener("keydown", onKeydown);
        dom.confirmOverlay.removeEventListener("click", onBackdrop);
        resolve(result);
      }

      function onCancel() {
        finish(false);
      }

      function onConfirm() {
        finish(true);
      }

      function onBackdrop(event) {
        if (event.target === dom.confirmOverlay) {
          finish(false);
        }
      }

      function onKeydown(event) {
        if (event.key === "Escape") {
          event.preventDefault();
          finish(false);
        } else if (event.key === "Enter") {
          event.preventDefault();
          finish(true);
        }
      }

      dom.confirmCancel.addEventListener("click", onCancel);
      dom.confirmConfirm.addEventListener("click", onConfirm);
      dom.confirmOverlay.addEventListener("click", onBackdrop);
      doc.addEventListener("keydown", onKeydown);
    });
  }

  function confirmClearConversation() {
    return confirmDialog({
      title: t("confirmClearTitle"),
      message: t("confirmClearMessage"),
      confirmLabel: t("confirmClear"),
      cancelLabel: t("cancel"),
      confirmDanger: true,
    });
  }

  function promptDialog({
    title = "Giriş",
    message = "",
    defaultValue = "",
    confirmLabel = "Kaydet",
    cancelLabel = "İptal",
  } = {}) {
    if (!dom.promptOverlay || !dom.promptInput) {
      return Promise.resolve(window.prompt(message, defaultValue));
    }

    return new Promise((resolve) => {
      dom.promptTitle.textContent = title;
      if (dom.promptMessage) {
        dom.promptMessage.textContent = message;
      }
      dom.promptInput.value = defaultValue;
      dom.promptConfirm.textContent = confirmLabel;
      dom.promptCancel.textContent = cancelLabel;
      dom.promptOverlay.classList.remove("hidden");

      const finish = (value) => {
        dom.promptOverlay.classList.add("hidden");
        dom.promptCancel.removeEventListener("click", onCancel);
        dom.promptConfirm.removeEventListener("click", onConfirm);
        dom.promptOverlay.removeEventListener("click", onBackdrop);
        doc.removeEventListener("keydown", onKeydown);
        resolve(value);
      };

      const onCancel = () => finish(null);
      const onConfirm = () => finish(dom.promptInput.value);
      const onBackdrop = (event) => {
        if (event.target === dom.promptOverlay) {
          finish(null);
        }
      };
      const onKeydown = (event) => {
        if (event.key === "Escape") {
          finish(null);
        } else if (event.key === "Enter") {
          event.preventDefault();
          finish(dom.promptInput.value);
        }
      };

      dom.promptCancel.addEventListener("click", onCancel);
      dom.promptConfirm.addEventListener("click", onConfirm);
      dom.promptOverlay.addEventListener("click", onBackdrop);
      doc.addEventListener("keydown", onKeydown);
      window.setTimeout(() => {
        dom.promptInput.focus();
        dom.promptInput.select();
      }, 0);
    });
  }

  function renderFinOpsBadge(summary) {
    if (!dom.finopsBadge) {
      return;
    }
    const budget = Number(summary?.budgetTl) || 0;
    const totalSpent = Number(summary?.totalSpentTl) || 0;
    const sessionSpent = Number(summary?.sessionSpentTl) || 0;
    const hasSessionCost = sessionSpent > 0;

    if (budget <= 0) {
      if (!hasSessionCost && totalSpent <= 0) {
        dom.finopsBadge.classList.add("hidden");
        dom.finopsBadge.textContent = "";
        return;
      }
      dom.finopsBadge.classList.remove("hidden");
      dom.finopsBadge.textContent = hasSessionCost
        ? `${sessionSpent.toFixed(2)} / ${totalSpent.toFixed(2)} ₺`
        : `${totalSpent.toFixed(2)} ₺`;
      dom.finopsBadge.title = t("finopsSessionNoBudget", {
        session: sessionSpent.toFixed(2),
        total: totalSpent.toFixed(2),
      });
      if (summary?.clineReadonlyNote) {
        dom.finopsBadge.title = `${dom.finopsBadge.title} · ${summary.clineReadonlyNote}`;
      }
      return;
    }

    const remainingPct = Number(summary?.remainingPct);
    const pctLabel = Number.isFinite(remainingPct) ? Math.round(remainingPct) : 0;
    dom.finopsBadge.textContent = hasSessionCost
      ? `${sessionSpent.toFixed(2)} · ${totalSpent.toFixed(2)} ₺`
      : `${totalSpent.toFixed(2)} ₺ · %${pctLabel}`;
    dom.finopsBadge.classList.remove("hidden");
    dom.finopsBadge.title = t("finopsSessionBudget", {
      session: sessionSpent.toFixed(2),
      total: totalSpent.toFixed(2),
      pct: pctLabel,
    });
    if (summary?.clineReadonlyNote) {
      dom.finopsBadge.title = `${dom.finopsBadge.title} · ${summary.clineReadonlyNote}`;
    }
    dom.finopsBadge.classList.toggle("is-warning", remainingPct <= 20);
    dom.finopsBadge.classList.toggle("is-danger", remainingPct <= 5);
  }

  function renderScreenshotPreviewStrip(screenshots, onClear) {
    if (!dom.attachmentPreviewStrip) {
      return;
    }
    const screenItems = Array.isArray(screenshots)
      ? screenshots.map((screen, index) => ({
          type: "image",
          base64Jpeg: screen.base64Jpeg,
          name: screen.label || `Ekran ${index + 1}`,
        }))
      : [];
    if (screenItems.length === 0) {
      dom.attachmentPreviewStrip.innerHTML = "";
      dom.attachmentPreviewStrip.classList.add("hidden");
      return;
    }
    renderAttachmentPreviewStrip(screenItems, onClear ? () => onClear() : null);
  }

  function updateScreenPendingBadge(screenCount) {
    if (!dom.screenPendingBadge) {
      return;
    }
    const count = Number(screenCount) || 0;
    if (count <= 0) {
      dom.screenPendingBadge.classList.add("hidden");
      dom.screenPendingBadge.textContent = "";
      return;
    }
    dom.screenPendingBadge.classList.remove("hidden");
    dom.screenPendingBadge.textContent = t("screenPendingBadge", { count });
  }

  function normalizePanelAssistantMode(mode) {
    if (mode === "guide" || mode === "planning") {
      return "guide";
    }
    return "assistant";
  }

  function renderPanelModeState({ assistantMode, sessionSnapshot } = {}) {
    const snapshot = sessionSnapshot || {};
    const microActive = Boolean(snapshot.microGuideSession?.active);
    const normalized = normalizePanelAssistantMode(assistantMode);
    const planActive = normalized === "guide" || Boolean(snapshot.activePlan);

    if (dom.assistantModeBadge) {
      let label = t("modeAssistant");
      let badgeClass = "is-assistant";
      if (microActive) {
        label = "Rehber · Mikro-tur";
        badgeClass = "is-micro-guide";
      } else if (planActive) {
        label = "Rehber · Planlı";
        badgeClass = "is-guide";
      }
      dom.assistantModeBadge.textContent = label;
      dom.assistantModeBadge.dataset.mode = microActive ? "micro_guide" : normalized;
      dom.assistantModeBadge.classList.remove("is-assistant", "is-guide", "is-micro-guide");
      dom.assistantModeBadge.classList.add(badgeClass);
    }

    if (dom.microGuideBadge) {
      dom.microGuideBadge.classList.add("hidden");
    }
  }

  function renderAssistantModeBadge(mode) {
    renderPanelModeState({ assistantMode: mode });
  }

  function renderMicroGuideBadge(microGuideSession) {
    renderPanelModeState({
      assistantMode: dom.assistantModeBadge?.dataset?.mode === "guide" ? "guide" : "assistant",
      sessionSnapshot: { microGuideSession },
    });
  }

  function renderAttachmentPreviewStrip(attachments, onRemove) {
    if (!dom.attachmentPreviewStrip) {
      return;
    }
    dom.attachmentPreviewStrip.innerHTML = "";
    if (!Array.isArray(attachments) || attachments.length === 0) {
      dom.attachmentPreviewStrip.classList.add("hidden");
      return;
    }
    dom.attachmentPreviewStrip.classList.remove("hidden");

    for (let index = 0; index < attachments.length; index += 1) {
      const attachment = attachments[index];
      const chip = doc.createElement("div");
      chip.className = "attachment-chip";

      if (attachment.type === "image" && attachment.base64Jpeg) {
        const thumb = doc.createElement("img");
        thumb.className = "attachment-chip-thumb";
        thumb.src = `data:image/jpeg;base64,${attachment.base64Jpeg}`;
        thumb.alt = attachment.name || "ek";
        chip.appendChild(thumb);
      } else {
        const icon = doc.createElement("span");
        icon.className = "attachment-chip-icon";
        icon.textContent = "📎";
        chip.appendChild(icon);
      }

      const label = doc.createElement("span");
      label.className = "attachment-chip-name";
      label.textContent = attachment.name || "dosya";
      chip.appendChild(label);

      const removeBtn = doc.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "attachment-chip-remove";
      removeBtn.title = "Kaldır";
      removeBtn.textContent = "✕";
      removeBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof onRemove === "function") {
          onRemove(index);
        }
      });
      chip.appendChild(removeBtn);
      dom.attachmentPreviewStrip.appendChild(chip);
    }
  }

  let activeArtifact = null;

  function openArtifactPanel(code, language = "text") {
    if (!dom.artifactPanel || !dom.artifactPanelContent) {
      return;
    }
    activeArtifact = {
      code: String(code || ""),
      language: String(language || "text"),
    };
    if (dom.artifactPanelTitle) {
      dom.artifactPanelTitle.textContent = `Artifact · ${activeArtifact.language}`;
    }
    dom.artifactPanelContent.value = activeArtifact.code;
    dom.artifactPanel.classList.remove("hidden");
    dom.artifactPanel.setAttribute("aria-hidden", "false");
  }

  function closeArtifactPanel() {
    if (!dom.artifactPanel) {
      return;
    }
    activeArtifact = null;
    dom.artifactPanel.classList.add("hidden");
    dom.artifactPanel.setAttribute("aria-hidden", "true");
  }

  function getActiveArtifact() {
    return activeArtifact;
  }

  async function refreshFinOpsBadge() {
    if (!dom.finopsBadge) {
      return;
    }
    try {
      const summary = await api.invoke("get-finops-summary");
      renderFinOpsBadge(summary);
    } catch (error) {
      log("get-finops-summary error", error);
    }
  }

  function startWaveformAnimation() {
    const bars = doc.querySelectorAll(".waveform-bar");
    const interval = window.setInterval(() => {
      bars.forEach((bar) => {
        bar.style.height = 4 + Math.random() * 10 + "px";
      });
    }, 100);
    state.setWaveInterval(interval);
  }

  function stopWaveformAnimation() {
    clearInterval(state.getWaveInterval());
    doc.querySelectorAll(".waveform-bar").forEach((bar) => {
      bar.style.height = "4px";
    });
  }

  dom.chatMessages?.addEventListener("click", (event) => {
    const artifactButton = event.target.closest(".code-artifact-btn");
    if (artifactButton) {
      event.preventDefault();
      event.stopPropagation();
      const encoded = artifactButton.getAttribute("data-code") || "";
      const lang = artifactButton.getAttribute("data-lang") || "text";
      openArtifactPanel(decodeURIComponent(encoded), lang);
      return;
    }

    const copyButton = event.target.closest(".code-copy-btn");
    if (copyButton) {
      event.preventDefault();
      event.stopPropagation();
      const encoded = copyButton.getAttribute("data-code") || "";
      const text = decodeURIComponent(encoded);
      navigator.clipboard.writeText(text).then(() => {
        copyButton.classList.add("copied");
        showToast("Kod kopyalandı");
        window.setTimeout(() => copyButton.classList.remove("copied"), 700);
      }).catch(() => showToast("Kopyalama başarısız", true));
      return;
    }

    const linkElement = event.target.closest("a[data-external-link]");
    if (!linkElement) {
      return;
    }
    event.preventDefault();
    const href = linkElement.getAttribute("href");
    const url = normalizeUrl(href);
    if (!url) {
      return;
    }
    api.invoke("open-external-link", url).catch((error) => {
      log("ipc:open-external-link error", error);
      showToast("Bağlantı açılamadı", true);
    });
  });

  if (dom.artifactPanelClose) {
    dom.artifactPanelClose.addEventListener("click", closeArtifactPanel);
  }
  if (dom.artifactPanelCopy) {
    dom.artifactPanelCopy.addEventListener("click", async () => {
      const text = dom.artifactPanelContent?.value || activeArtifact?.code || "";
      if (!text) {
        return;
      }
      try {
        await navigator.clipboard.writeText(text);
        showToast("Kopyalandı");
      } catch (error) {
        showToast("Kopyalama başarısız", true);
      }
    });
  }
  if (dom.artifactPanelDownload) {
    dom.artifactPanelDownload.addEventListener("click", () => {
      const text = dom.artifactPanelContent?.value || activeArtifact?.code || "";
      if (!text) {
        return;
      }
      const lang = activeArtifact?.language || "txt";
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = doc.createElement("a");
      anchor.href = url;
      anchor.download = `artifact.${lang === "text" ? "txt" : lang}`;
      anchor.click();
      URL.revokeObjectURL(url);
      showToast("İndirildi");
    });
  }

  startBackgroundBlinkLoop();
  updateChatBackgroundState(0);

  return {
    applyAssistantContent,
    appendAssistantMessage,
    appendErrorMessage,
    injectSystemNotice,
    appendRawElement,
    appendUserMessage,
    buildModelSelector,
    buildProviderSelector,
    clearConversation,
    escapeHtml,
    removeAllTypingIndicators,
    removeTypingIndicator,
    renderAgentState,
    renderConversation,
    scrollToBottom,
    showToast,
    showErrorBanner,
    hideErrorBanner,
    showWorkspaceStatus,
    hideWorkspaceStatus,
    invokeWorkspaceStatusFocus,
    renderHandoffHistory,
    renderBuildPipeline,
    showOnboarding,
    hideOnboarding,
    closeArtifactPanel,
    confirmClearConversation,
    confirmDialog,
    getActiveArtifact,
    openArtifactPanel,
    promptDialog,
    refreshFinOpsBadge,
    renderAttachmentPreviewStrip,
    renderScreenshotPreviewStrip,
    updateScreenPendingBadge,
    renderPanelModeState,
    renderAssistantModeBadge,
    renderMicroGuideBadge,
    renderFinOpsBadge,
    confirmDialog,
    showTypingIndicator,
    simpleMarkdown,
    streamAssistantMessage,
    startWaveformAnimation,
    stopWaveformAnimation,
    updateProviderDot,
  };
}
