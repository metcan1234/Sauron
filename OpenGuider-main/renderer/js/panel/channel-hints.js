export function createChannelHintsController({ api, doc, log, state, messaging, webStudio, onOpenWorkspace, onOpenGamedev, onOpenGoose }) {
  const container = doc.getElementById("channel-hint-chips");
  let debounceId = null;
  let lastText = "";

  function hideHints() {
    if (!container) {
      return;
    }
    container.classList.add("hidden");
    container.replaceChildren();
  }

  async function refreshHints(text) {
    if (!container || state.getSettings()?.channelHintChipsEnabled === false) {
      hideHints();
      return;
    }
    const trimmed = String(text || "").trim();
    if (trimmed.length < 4) {
      hideHints();
      return;
    }
    try {
      const result = await api.invoke("resolve-channel-hints", { text: trimmed });
      const hints = result?.hints || [];
      if (hints.length === 0) {
        hideHints();
        return;
      }
      container.replaceChildren();
      for (const hint of hints) {
        const chip = doc.createElement("button");
        chip.type = "button";
        chip.className = "channel-hint-chip";
        chip.textContent = `${hint.icon || ""} ${hint.label}`.trim();
        chip.title = hint.label;
        chip.addEventListener("click", () => void handleHintAction(hint, trimmed));
        container.appendChild(chip);
      }
      container.classList.remove("hidden");
    } catch (error) {
      log?.("resolve-channel-hints error", error);
      hideHints();
    }
  }

  async function handleHintAction(hint, text) {
    hideHints();
    switch (hint.action) {
      case "route_code_agent":
        await messaging.startCodeAgentSession(text);
        break;
      case "route_micro_guide":
        await messaging.startMicroGuideSession(text);
        break;
      case "open_web_studio":
        if (webStudio?.openWizard) {
          await webStudio.openWizard();
        }
        break;
      case "open_workspace":
        if (typeof onOpenWorkspace === "function") {
          await onOpenWorkspace(text);
        }
        break;
      case "open_gamedev":
        if (typeof onOpenGamedev === "function") {
          await onOpenGamedev(text);
        }
        break;
      case "open_goose":
        if (typeof onOpenGoose === "function") {
          await onOpenGoose(text);
        }
        break;
      default:
        break;
    }
  }

  function bindInput(textInput) {
    if (!textInput) {
      return;
    }
    textInput.addEventListener("input", () => {
      lastText = textInput.value;
      clearTimeout(debounceId);
      debounceId = window.setTimeout(() => {
        void refreshHints(lastText);
      }, 350);
    });
    textInput.addEventListener("blur", () => {
      window.setTimeout(() => hideHints(), 180);
    });
  }

  return { bindInput, hideHints, refreshHints };
}
