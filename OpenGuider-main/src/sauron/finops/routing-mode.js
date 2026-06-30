const AGENT_CONTROL_MODES = ["auto", "manual", "mixed"];
const CHANNEL_ROUTING_MODES = ["auto", "manual"];
const MANUAL_AGENTS = ["gemini", "deepseek", "openai", "ollama"];
const GOOSE_MODES = ["economy", "balanced", "premium"];

function getAgentMatrixModule() {
  return require("./agent-matrix");
}

function normalizeAgentControlMode(value) {
  const mode = String(value || "").trim().toLowerCase();
  return AGENT_CONTROL_MODES.includes(mode) ? mode : "auto";
}

function normalizeChannelRoutingMode(value, fallback = "auto") {
  const mode = String(value || fallback).trim().toLowerCase();
  return CHANNEL_ROUTING_MODES.includes(mode) ? mode : fallback;
}

function normalizeManualAgent(value, fallback = "gemini") {
  const agentId = String(value || fallback).trim().toLowerCase();
  return MANUAL_AGENTS.includes(agentId) ? agentId : fallback;
}

function normalizeGooseMode(value, fallback = "balanced") {
  const mode = String(value || fallback).trim().toLowerCase();
  return GOOSE_MODES.includes(mode) ? mode : fallback;
}

function resolveAgentControlMode(settings = {}) {
  const explicit = settings.agentControlMode;
  if (explicit && AGENT_CONTROL_MODES.includes(explicit)) {
    return explicit;
  }
  if (settings.finopsTrackingOnly === true) {
    return "manual";
  }
  return "auto";
}

function isChannelAuto(settings = {}, channel) {
  const mode = resolveAgentControlMode(settings);
  if (mode === "auto") {
    return true;
  }
  if (mode === "manual") {
    return false;
  }
  const key = `${channel}RoutingMode`;
  return normalizeChannelRoutingMode(settings[key], "auto") === "auto";
}

function shouldAutoRouteCore(settings = {}) {
  if (settings.finopsCostOptimizerEnabled === false) {
    return false;
  }
  return isChannelAuto(settings, "core");
}

function shouldAutoRouteCline(settings = {}) {
  if (settings.finopsCostOptimizerEnabled === false) {
    return false;
  }
  return isChannelAuto(settings, "cline");
}

function shouldAutoRouteGoose(settings = {}) {
  if (settings.gooseAutoMode === false) {
    return false;
  }
  if (settings.gooseAutoMode === true) {
    return true;
  }
  return isChannelAuto(settings, "goose");
}

function resolveManualAgentModel(settings = {}, agentId) {
  const { AGENT_DEFINITIONS } = getAgentMatrixModule();
  const agent = AGENT_DEFINITIONS[agentId];
  if (!agent) {
    return { aiProvider: "gemini", aiModel: AGENT_DEFINITIONS.gemini.coreModel };
  }

  const customKey = `${agent.coreProvider}ModelCustom`;
  const customModel = String(settings[customKey] || "").trim();
  const model = customModel || agent.coreModel;

  return {
    aiProvider: agent.coreProvider,
    aiModel: model,
    agentId: agent.id,
  };
}

function resolveManualCoreAgent(settings = {}) {
  const requested = String(settings.coreManualAgent || settings.aiProvider || "gemini")
    .trim()
    .toLowerCase();
  if (MANUAL_AGENTS.includes(requested)) {
    const resolved = resolveManualAgentModel(settings, requested);
    return {
      ...resolved,
      coreModelTier: requested,
      optimizerEnabled: true,
      reason: "manual-core",
    };
  }
  return {
    aiProvider: requested,
    aiModel: String(settings.aiModel || "").trim() || "default",
    coreModelTier: requested,
    optimizerEnabled: true,
    reason: "manual-core-direct",
  };
}

function resolveManualClineAgent(settings = {}) {
  const { AGENT_DEFINITIONS } = getAgentMatrixModule();
  const agentId = normalizeManualAgent(settings.clineManualAgent, "deepseek");
  const agent = AGENT_DEFINITIONS[agentId];
  const customKey = `${agent.clineProviderId}ModelCustom`;
  const customModel = String(settings[customKey] || "").trim();
  const modelId = customModel || agent.clineModelId;

  return {
    providerId: agent.clineProviderId,
    modelId,
    agentId: agent.id,
    reason: "manual-cline",
  };
}

function resolveManualGooseMode(settings = {}) {
  const mode = normalizeGooseMode(
    settings.gooseManualMode || settings.gooseDefaultMode,
    "balanced",
  );
  return {
    mode,
    reason: "manual-goose",
  };
}

function buildManualAgentsPayload(settings = {}) {
  return {
    core: normalizeManualAgent(settings.coreManualAgent || settings.aiProvider, "gemini"),
    cline: normalizeManualAgent(settings.clineManualAgent, "deepseek"),
    goose: normalizeGooseMode(settings.gooseManualMode || settings.gooseDefaultMode, "balanced"),
  };
}

function buildAgentControlPayload(settings = {}) {
  const mode = resolveAgentControlMode(settings);
  return {
    agentControlMode: mode,
    coreRoutingMode: normalizeChannelRoutingMode(settings.coreRoutingMode, "auto"),
    clineRoutingMode: normalizeChannelRoutingMode(settings.clineRoutingMode, "auto"),
    gooseRoutingMode: normalizeChannelRoutingMode(settings.gooseRoutingMode, "auto"),
    manualAgents: buildManualAgentsPayload(settings),
    shouldAutoRoute: {
      core: shouldAutoRouteCore(settings),
      cline: shouldAutoRouteCline(settings),
      goose: shouldAutoRouteGoose(settings),
    },
  };
}

function syncLegacyRoutingFlags(settings = {}) {
  const mode = resolveAgentControlMode(settings);
  const autoCore = shouldAutoRouteCore(settings);
  const autoCline = shouldAutoRouteCline(settings);
  const autoGoose = shouldAutoRouteGoose(settings);

  return {
    ...settings,
    agentControlMode: mode,
    finopsTrackingOnly: !(autoCore || autoCline),
    finopsCoreModelOverlay: autoCore,
    gooseAutoMode: autoGoose,
    gooseDefaultMode: normalizeGooseMode(
      settings.gooseManualMode || settings.gooseDefaultMode,
      "balanced",
    ),
    aiProvider: normalizeManualAgent(
      settings.coreManualAgent || settings.aiProvider,
      "gemini",
    ),
  };
}

function applyPanelProviderOverride(settings = {}, providerId) {
  const agentId = normalizeManualAgent(providerId, "gemini");
  const mode = resolveAgentControlMode(settings);
  const next = {
    ...settings,
    coreManualAgent: agentId,
    aiProvider: getAgentMatrixModule().AGENT_DEFINITIONS[agentId]?.coreProvider || agentId,
  };

  if (mode === "auto") {
    next.agentControlMode = "mixed";
    next.coreRoutingMode = "manual";
    next.clineRoutingMode = "auto";
    next.gooseRoutingMode = "auto";
  }

  return syncLegacyRoutingFlags(next);
}

function isManualAgentConfigured(settings = {}, agentId) {
  return getAgentMatrixModule().hasAgentCredential(settings, normalizeManualAgent(agentId, "gemini"));
}

module.exports = {
  AGENT_CONTROL_MODES,
  CHANNEL_ROUTING_MODES,
  MANUAL_AGENTS,
  GOOSE_MODES,
  normalizeAgentControlMode,
  normalizeChannelRoutingMode,
  normalizeManualAgent,
  normalizeGooseMode,
  resolveAgentControlMode,
  isChannelAuto,
  shouldAutoRouteCore,
  shouldAutoRouteCline,
  shouldAutoRouteGoose,
  resolveManualCoreAgent,
  resolveManualClineAgent,
  resolveManualGooseMode,
  buildManualAgentsPayload,
  buildAgentControlPayload,
  syncLegacyRoutingFlags,
  applyPanelProviderOverride,
  isManualAgentConfigured,
};
