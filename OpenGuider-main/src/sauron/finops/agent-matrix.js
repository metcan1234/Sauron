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

  if (hint === "high" && (operation === "context-analyzer" || operation === "chat")) {
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

  let preferredId = CLINE_COMPLEXITY_MAP[hint] || "deepseek";
  let reason = `complexity-${hint}`;

  if (budgetGovernorActive && hint === "high") {
    preferredId = "deepseek";
    reason = "budget-governor-high-to-deepseek";
  }

  if (hint === "high" && preferredId === "openai" && !hasAgentCredential(settings, "openai")) {
    preferredId = "deepseek";
    reason = "complexity-high-fallback-deepseek";
  }

  const routed = resolveRoutedAgent(settings, preferredId, CLINE_CLOUD_FALLBACK_ORDER, agentWallets);

  if (routed.reason.startsWith("wallet-exhausted")) {
    reason = routed.reason;
  } else if (reason === "complexity-high-fallback-deepseek" || reason === "budget-governor-high-to-deepseek") {
    // keep explicit fallback reason
  } else if (routed.reason !== `complexity-route-${routed.agent.id}`) {
    reason = routed.reason;
  } else {
    reason = `complexity-${hint}`;
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
