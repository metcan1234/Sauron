const { mergeCostOptimizerConfig } = require("./cost-optimizer-config");
const {
  CLOUD_AGENT_IDS,
  isAgentWalletAvailable,
  areAllCloudAgentsWalletExhausted,
} = require("./agent-usage");

const AGENT_IDS = ["gemini", "deepseek", "openai", "ollama"];

const AGENT_DEFINITIONS = {
  gemini: {
    id: "gemini",
    coreProvider: "gemini",
    coreModel: "gemini-2.5-flash-lite",
    clineProviderId: "gemini",
    clineModelId: "gemini-2.5-flash",
    credentialKey: "geminiApiKey",
  },
  deepseek: {
    id: "deepseek",
    coreProvider: "deepseek",
    coreModel: "deepseek-chat",
    clineProviderId: "deepseek",
    clineModelId: "deepseek-chat",
    credentialKey: "deepseekApiKey",
  },
  openai: {
    id: "openai",
    coreProvider: "openai",
    coreModel: "gpt-4o-mini",
    clineProviderId: "openai",
    clineModelId: "gpt-4o-mini",
    credentialKey: "openaiApiKey",
  },
  ollama: {
    id: "ollama",
    coreProvider: "ollama",
    coreModel: "qwen2.5-coder:7b",
    clineProviderId: "ollama",
    clineModelId: "qwen2.5-coder:7b",
    credentialKey: "ollamaUrl",
  },
};

const CORE_COMPLEXITY_MAP = {
  low: "gemini",
  medium: "gemini",
  high: "deepseek",
};

const CLINE_COMPLEXITY_MAP = {
  low: "deepseek",
  medium: "deepseek",
  high: "openai",
};

const CORE_CLOUD_FALLBACK_ORDER = ["gemini", "deepseek", "openai"];
const CLINE_CLOUD_FALLBACK_ORDER = ["deepseek", "gemini", "openai"];

const ECONOMY_VISION_OPERATIONS = new Set([
  "guide-micro-instruct",
  "planner",
  "locator",
  "locator_strict",
  "evaluator",
  "handoff-task-clarify",
  "handoff-summary",
  "code-grep-context",
  "code-read-summarize",
  "code-agent-summarize",
  "code-agent-plan",
]);

function normalizeHint(hint) {
  if (hint === "medium" || hint === "high" || hint === "low") {
    return hint;
  }
  return "low";
}

function hasAgentCredential(settings = {}, agentId) {
  const agent = AGENT_DEFINITIONS[agentId];
  if (!agent) {
    return false;
  }
  if (agentId === "ollama") {
    const url = String(settings.ollamaUrl || "").trim();
    const model = String(settings.ollamaModelCustom || "").trim();
    if (!url) {
      return false;
    }
    if (model) {
      return true;
    }
    return url !== "http://localhost:11434";
  }
  return Boolean(String(settings[agent.credentialKey] || "").trim());
}

function isAgentRoutable(settings = {}, agentId, agentWallets = null) {
  if (!hasAgentCredential(settings, agentId)) {
    return false;
  }
  if (!agentWallets) {
    return true;
  }
  return isAgentWalletAvailable(agentId, agentWallets);
}

function buildCloudFallbackOrder(preferredId, cloudOrder) {
  const order = [];
  const seen = new Set();
  for (const agentId of [preferredId, ...cloudOrder]) {
    if (!agentId || seen.has(agentId) || !CLOUD_AGENT_IDS.includes(agentId)) {
      continue;
    }
    seen.add(agentId);
    order.push(agentId);
  }
  return order;
}

function pickRoutableAgent(settings, preferredOrder, agentWallets = null) {
  for (const agentId of preferredOrder) {
    if (isAgentRoutable(settings, agentId, agentWallets)) {
      return AGENT_DEFINITIONS[agentId];
    }
  }
  return null;
}

function pickAvailableAgent(settings, preferredOrder) {
  return pickRoutableAgent(settings, preferredOrder, null);
}

function resolveRoutedAgent(settings, preferredId, cloudOrder, agentWallets = null) {
  const preferredOrder = buildCloudFallbackOrder(preferredId, cloudOrder);
  const skippedExhausted = preferredOrder.filter(
    (agentId) => hasAgentCredential(settings, agentId)
      && agentWallets
      && !isAgentWalletAvailable(agentId, agentWallets),
  );
  const agent = pickRoutableAgent(settings, preferredOrder, agentWallets);

  if (agent) {
    let reason = `complexity-route-${agent.id}`;
    if (skippedExhausted.includes(preferredId) && agent.id !== preferredId) {
      reason = `wallet-exhausted-fallback-${preferredId}`;
    }
    return { agent, reason, skippedExhausted, allCloudExhausted: false };
  }

  const credentialFallback = pickRoutableAgent(
    settings,
    preferredOrder.filter((id) => CLOUD_AGENT_IDS.includes(id)),
    null,
  );
  if (credentialFallback) {
    return {
      agent: credentialFallback,
      reason: areAllCloudAgentsWalletExhausted(agentWallets)
        ? "wallet-exhausted-all-cloud"
        : `wallet-exhausted-fallback-${preferredId}`,
      skippedExhausted,
      allCloudExhausted: areAllCloudAgentsWalletExhausted(agentWallets),
    };
  }

  return {
    agent: AGENT_DEFINITIONS.gemini,
    reason: "wallet-exhausted-all-cloud",
    skippedExhausted,
    allCloudExhausted: true,
  };
}

function shouldUseOllamaFallback(settings = {}) {
  const optimizer = mergeCostOptimizerConfig(settings);
  if (!optimizer.budgetGovernor?.enabled) {
    return false;
  }
  const dailyBudget = Number(optimizer.budgetGovernor.dailyBudgetTl) || 0;
  if (dailyBudget <= 0) {
    return false;
  }
  return !hasAgentCredential(settings, "gemini")
    && !hasAgentCredential(settings, "deepseek")
    && !hasAgentCredential(settings, "openai")
    && hasAgentCredential(settings, "ollama");
}

function resolveAgentForCore(operation = "chat", complexityHint = "low", settings = {}, options = {}) {
  const optimizer = mergeCostOptimizerConfig(settings);
  if (!optimizer.enabled) {
    return null;
  }

  const agentWallets = options.agentWallets || null;

  if (shouldUseOllamaFallback(settings)) {
    const agent = AGENT_DEFINITIONS.ollama;
    return buildCoreOverlay(agent);
  }

  const hint = normalizeHint(complexityHint);
  let agentId = CORE_COMPLEXITY_MAP[hint] || "gemini";

  if (optimizer.mode === "economy" && hint === "high") {
    agentId = "gemini";
  } else if (hint === "high" && (operation === "context-analyzer" || operation === "chat")) {
    agentId = "gemini";
  }

  const routed = resolveRoutedAgent(settings, agentId, CORE_CLOUD_FALLBACK_ORDER, agentWallets);
  return {
    ...buildCoreOverlay(routed.agent),
    reason: routed.reason,
    walletFallbackFrom: routed.skippedExhausted[0] || null,
    allCloudExhausted: routed.allCloudExhausted,
  };
}

function resolveCheapestRoutableClineAgent(settings = {}, agentWallets = null) {
  const order = ["ollama", "gemini", "deepseek", "openai"];
  for (const agentId of order) {
    if (isAgentRoutable(settings, agentId, agentWallets)) {
      return agentId;
    }
  }
  return "gemini";
}

function applyGovernorTierToCline(hint, preferredId, governorTier) {
  if (governorTier === "hard") {
    return { preferredId: null, reason: "governor-hard-cheapest" };
  }
  if (governorTier !== "soft") {
    return { preferredId, reason: null };
  }
  if (hint === "high") {
    return { preferredId: "deepseek", reason: "governor-soft-high-to-deepseek" };
  }
  if (hint === "medium") {
    return { preferredId: "gemini", reason: "governor-soft-medium-to-gemini" };
  }
  return { preferredId, reason: null };
}

function resolveAgentForCline(complexityHint = "low", settings = {}, options = {}) {
  const optimizer = mergeCostOptimizerConfig(settings);
  if (!optimizer.enabled) {
    return null;
  }

  const agentWallets = options.agentWallets || null;

  if (shouldUseOllamaFallback(settings)) {
    return buildClineSelection(AGENT_DEFINITIONS.ollama, "budget-fallback");
  }

  const hint = normalizeHint(complexityHint);
  const budgetGovernorActive = options.budgetGovernorActive === true || options.downgradeOneTier === true;
  const governorTier = options.governorTier
    || (budgetGovernorActive ? "soft" : "none");

  let preferredId = CLINE_COMPLEXITY_MAP[hint] || "deepseek";
  let reason = `complexity-${hint}`;

  if (hint === "low" && settings.finopsClineOllamaForLow === true && hasAgentCredential(settings, "ollama")) {
    preferredId = "ollama";
    reason = "cline-ollama-low";
  }

  if (hint === "high") {
    if (optimizer.mode === "economy") {
      preferredId = "deepseek";
      reason = "economy-mode-high-to-deepseek";
    } else if (optimizer.mode === "performance") {
      preferredId = "openai";
      reason = "performance-mode-high-to-openai";
    }
  }

  const governorAdjust = applyGovernorTierToCline(hint, preferredId, governorTier);
  if (governorAdjust.reason) {
    reason = governorAdjust.reason;
  }
  if (governorTier === "hard") {
    preferredId = resolveCheapestRoutableClineAgent(settings, agentWallets);
    reason = "governor-hard-cheapest";
  } else if (governorAdjust.preferredId) {
    preferredId = governorAdjust.preferredId;
  }

  if (budgetGovernorActive && hint === "high" && governorTier === "none") {
    preferredId = "deepseek";
    reason = "budget-governor-high-to-deepseek";
  }

  if (hint === "high" && preferredId === "openai" && !hasAgentCredential(settings, "openai")) {
    preferredId = "deepseek";
    reason = "complexity-high-fallback-deepseek";
  }

  if (preferredId === "ollama") {
    if (isAgentRoutable(settings, "ollama", agentWallets)) {
      return {
        ...buildClineSelection(AGENT_DEFINITIONS.ollama, reason),
        walletFallbackFrom: null,
        allCloudExhausted: false,
      };
    }
    preferredId = CLINE_COMPLEXITY_MAP[hint] || "gemini";
    reason = "cline-ollama-unavailable-fallback";
  }

  const routed = resolveRoutedAgent(settings, preferredId, CLINE_CLOUD_FALLBACK_ORDER, agentWallets);

  const explicitReasons = new Set([
    "complexity-high-fallback-deepseek",
    "budget-governor-high-to-deepseek",
    "economy-mode-high-to-deepseek",
    "performance-mode-high-to-openai",
    "cline-ollama-low",
    "governor-soft-high-to-deepseek",
    "governor-soft-medium-to-gemini",
    "governor-hard-cheapest",
    "cline-ollama-unavailable-fallback",
  ]);

  if (routed.reason.startsWith("wallet-exhausted")) {
    reason = routed.reason;
  } else if (!explicitReasons.has(reason)) {
    if (routed.reason !== `complexity-route-${routed.agent.id}`) {
      reason = routed.reason;
    } else {
      reason = `complexity-${hint}`;
    }
  }

  return {
    ...buildClineSelection(routed.agent, reason),
    walletFallbackFrom: routed.skippedExhausted[0] || null,
    allCloudExhausted: routed.allCloudExhausted,
  };
}

function buildCoreOverlay(agent) {
  return {
    aiProvider: agent.coreProvider,
    aiModel: agent.coreModel,
    agentId: agent.id,
    coreModelTier: agent.id,
    optimizerEnabled: true,
  };
}

function buildClineSelection(agent, reason) {
  return {
    providerId: agent.clineProviderId,
    modelId: agent.clineModelId,
    agentId: agent.id,
    reason,
  };
}

function buildOptimizerModelsFromMatrix() {
  return {
    economy: {
      providerId: AGENT_DEFINITIONS.gemini.clineProviderId,
      modelId: AGENT_DEFINITIONS.gemini.coreModel,
    },
    standard: {
      providerId: AGENT_DEFINITIONS.deepseek.clineProviderId,
      modelId: AGENT_DEFINITIONS.deepseek.coreModel,
    },
    premium: {
      providerId: AGENT_DEFINITIONS.openai.clineProviderId,
      modelId: AGENT_DEFINITIONS.openai.coreModel,
    },
    local: {
      providerId: AGENT_DEFINITIONS.ollama.clineProviderId,
      modelId: AGENT_DEFINITIONS.ollama.coreModel,
    },
  };
}

function syncAgentMatrixFromSettings(settings = {}) {
  return {
    finopsCostOptimizerEnabled: true,
    aiProvider: "gemini",
    geminiModelCustom: AGENT_DEFINITIONS.gemini.coreModel,
    deepseekModelCustom: AGENT_DEFINITIONS.deepseek.coreModel,
    openaiModelCustom: AGENT_DEFINITIONS.openai.coreModel,
    ollamaModelCustom: AGENT_DEFINITIONS.ollama.coreModel,
    finopsOptimizerModels: buildOptimizerModelsFromMatrix(),
    agentMatrixVersion: 1,
  };
}

function buildAgentMatrixForWorkspace(settings = {}, agentWallets = null) {
  return {
    version: 1,
    agents: AGENT_IDS.map((id) => ({
      id,
      core: {
        provider: AGENT_DEFINITIONS[id].coreProvider,
        model: AGENT_DEFINITIONS[id].coreModel,
      },
      cline: {
        providerId: AGENT_DEFINITIONS[id].clineProviderId,
        modelId: AGENT_DEFINITIONS[id].clineModelId,
      },
      configured: hasAgentCredential(settings, id),
      walletAvailable: agentWallets ? isAgentWalletAvailable(id, agentWallets) : true,
    })),
    routing: {
      core: CORE_COMPLEXITY_MAP,
      cline: CLINE_COMPLEXITY_MAP,
    },
  };
}

module.exports = {
  AGENT_IDS,
  CLOUD_AGENT_IDS,
  AGENT_DEFINITIONS,
  ECONOMY_VISION_OPERATIONS,
  CORE_CLOUD_FALLBACK_ORDER,
  CLINE_CLOUD_FALLBACK_ORDER,
  hasAgentCredential,
  isAgentRoutable,
  pickAvailableAgent,
  pickRoutableAgent,
  resolveAgentForCore,
  resolveAgentForCline,
  syncAgentMatrixFromSettings,
  buildAgentMatrixForWorkspace,
  buildOptimizerModelsFromMatrix,
};
