export function createVoiceChatModeController({ api, doc, dom, ptt, state, ui, log }) {
  const toggleBtn = doc.getElementById("btn-voice-chat-loop");
  let active = false;

  function syncUi() {
    if (!toggleBtn) {
      return;
    }
    toggleBtn.classList.toggle("is-active", active);
    toggleBtn.title = active
      ? "Sesli sohbet modu açık — tekrar bas kapat"
      : "Sesli sohbet modu — sürekli dinle/konuş";
  }

  function stopLoop() {
    active = false;
    syncUi();
    if (state.isRecording?.()) {
      ptt?.stopPTT?.();
    }
  }

  function startLoop() {
    if (state.getSettings?.()?.voiceChatLoopEnabled === false) {
      ui.showToast("Sesli sohbet modu ayarlardan kapalı.", true);
      return;
    }
    active = true;
    syncUi();
    ui.showToast("Sesli sohbet modu açık — konuşmak için basılı tut", false);
  }

  toggleBtn?.addEventListener("click", () => {
    if (active) {
      stopLoop();
      return;
    }
    startLoop();
  });

  api.on?.("ai-done", () => {
    if (!active || state.getSettings?.()?.voiceChatLoopEnabled === false) {
      return;
    }
    window.setTimeout(() => {
      if (active && !state.isRecording?.() && !state.isStreaming?.()) {
        ptt?.startPTT?.();
      }
    }, 600);
  });

  return { startLoop, stopLoop, isActive: () => active };
}
