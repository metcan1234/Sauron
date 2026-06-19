const { trackCall } = require("./usage-tracker");
const { calculateCostTl } = require("./finops-pricing");
const { resolveTokenCounts } = require("./token-counter");
const { checkPreCallBudgetAlert, maybePostCallBudgetAlert } = require("./budget-alert");
const { resolveCoreModelOverlay } = require("./cost-optimizer-config");
const { resolveAgentForCore } = require("./agent-matrix");

const OVERLAY_SKIP_OPERATIONS = new Set(["handoff-summary"]);

let budgetContext = {
  getWindows: () => [],
  persistSettings: async () => {},
  getSettings: () => ({}),
};

function configureFinOpsContext(context = {}) {
  budgetContext = {
    ...budgetContext,
    ...context,
  };
}

function persistDiscoveredModel(settings, discovery) {
  if (!discovery?.provider || !discovery?.model) return null;

  const key = `${discovery.provider}:${discovery.model}`;
  const existing = settings.finopsDiscoveredModels || {};
  if (existing[key]) return null;

  const next = {
    ...existing,
    [key]: {
      pricePerMillionTokensTl: discovery.pricePerMillionTokensTl,
      discoveredAt: new Date().toISOString(),
    },
  };

  return { finopsDiscoveredModels: next };
}

async function recordLlmUsage({
  settings,
  operation = "chat",
  provider,
  model,
  promptText = "",
  completionText = "",
  providerUsage = null,
  latencyMs = 0,
  sessionId = "",
}) {
  const liveSettings = {
    ...budgetContext.getSettings(),
    ...settings,
  };

  let discoveredPatch = null;
  const tokenCounts = resolveTokenCounts({ promptText, completionText, providerUsage });
  const pricing = calculateCostTl({
    provider,
    model,
    promptTokens: tokenCounts.promptTokens,
    completionTokens: tokenCounts.completionTokens,
    settings: liveSettings,
    onDiscovered: (discovery) => {
      discoveredPatch = persistDiscoveredModel(liveSettings, discovery);
    },
  });

  if (discoveredPatch) {
    await budgetContext.persistSettings(discoveredPatch);
    Object.assign(liveSettings, discoveredPatch);
  }

  trackCall(
    {
      provider,
      model,
      promptTokens: tokenCounts.promptTokens,
      completionTokens: tokenCounts.completionTokens,
      costTl: pricing.costTl,
      operation,
      latencyMs,
      timestamp: new Date().toISOString(),
      sessionId: String(sessionId || "").trim() || undefined,
    },
    liveSettings,
  );

  setImmediate(() => {
    maybePostCallBudgetAlert(liveSettings, budgetContext.getWindows, budgetContext.persistSettings).catch(() => {});
  });
}

async function prepareLlmCall(settings = {}, options = {}) {
  const operation = options.operation || "chat";
  const complexityHint = options.complexityHint || "low";
  const liveSettings = {
    ...budgetContext.getSettings(),
    ...settings,
  };
  await checkPreCallBudgetAlert(liveSettings, budgetContext.getWindows);

  if (OVERLAY_SKIP_OPERATIONS.has(operation)) {
    return liveSettings;
  }

  const overlay =
    resolveAgentForCore(operation, complexityHint, liveSettings) ||
    resolveCoreModelOverlay(liveSettings);
  if (!overlay) {
    return liveSettings;
  }

  return {
    ...liveSettings,
    aiProvider: overlay.aiProvider,
    aiModel: overlay.aiModel,
    _finopsCoreOverlay: {
      coreModelTier: overlay.coreModelTier,
      agentId: overlay.agentId,
      originalProvider: liveSettings.aiProvider,
      originalModel: liveSettings.aiModel,
    },
  };
}

module.exports = {
  configureFinOpsContext,
  recordLlmUsage,
  prepareLlmCall,
};
