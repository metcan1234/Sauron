const MESSAGE_ROUTES = {
  MICRO_GUIDE: "micro_guide",
  PLAN_GUIDE: "plan_guide",
  ASSISTANT_CHAT: "assistant_chat",
  MICRO_GUIDE_BUSY: "micro_guide_busy",
};

function isGuideAssistantMode(assistantMode) {
  return assistantMode === "guide" || assistantMode === "planning";
}

function resolveMessageRoute({
  assistantMode = "assistant",
  microGuideActive = false,
  microIntent = null,
  text = "",
} = {}) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    return { route: MESSAGE_ROUTES.ASSISTANT_CHAT, reason: "empty" };
  }

  if (microGuideActive) {
    return { route: MESSAGE_ROUTES.MICRO_GUIDE_BUSY, reason: "micro_session_active" };
  }

  if (microIntent?.shouldSuggest) {
    return {
      route: MESSAGE_ROUTES.MICRO_GUIDE,
      reason: microIntent.reason || "screen_guidance",
      confidence: microIntent.confidence ?? 0,
    };
  }

  if (isGuideAssistantMode(assistantMode)) {
    return { route: MESSAGE_ROUTES.PLAN_GUIDE, reason: "guide_mode" };
  }

  return { route: MESSAGE_ROUTES.ASSISTANT_CHAT, reason: "default" };
}

function resolvePanelModeState({ assistantMode = "assistant", sessionSnapshot = null } = {}) {
  const snapshot = sessionSnapshot || {};
  if (snapshot.microGuideSession?.active) {
    return {
      mode: "micro_guide",
      label: "Rehber · Mikro-tur",
      badgeClass: "is-micro-guide",
    };
  }
  if (isGuideAssistantMode(assistantMode) || snapshot.activePlan) {
    return {
      mode: "plan_guide",
      label: "Rehber · Planlı",
      badgeClass: "is-guide",
    };
  }
  return {
    mode: "assistant",
    label: "Asistan",
    badgeClass: "is-assistant",
  };
}

module.exports = {
  MESSAGE_ROUTES,
  isGuideAssistantMode,
  resolveMessageRoute,
  resolvePanelModeState,
};
