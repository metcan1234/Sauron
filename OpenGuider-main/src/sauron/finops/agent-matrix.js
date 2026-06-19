const { mergeCostOptimizerConfig } = require("./cost-optimizer-config");

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
  medium: "gemini",
  high: "openai",
};

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

function pickAvailableAgent(settings, preferredOrder) {
  for (const agentId of preferredOrder) {
    if (hasAgentCredential(settings, agentId)) {
      return AGENT_DEFINITIONS[agentId];
    }
  }
  return null;
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

function resolveAgentForCore(operation = "chat", complexityHint = "low", settings = {}) {
  const optimizer = mergeCostOptimizerConfig(settings);
  if (!optimizer.enabled) {
    return null;
  }

  if (shouldUseOllamaFallback(settings)) {
    const agent = AGENT_DEFINITIONS.ollama;
    return buildCoreOverlay(agent);
  }

  const hint = normalizeHint(complexityHint);
  let agentId = CORE_COMPLEXITY_MAP[hint] || "gemini";

  if (hint === "high" && (operation === "context-analyzer" || operation === "chat")) {
    agentId = "gemini";
  }

  const agent =
    pickAvailableAgent(settings, [agentId, "gemini", "deepseek", "openai", "ollama"]) ||
    AGENT_DEFINITIONS.gemini;

  return buildCoreOverlay(agent);
}

function resolveAgentForCline(complexityHint = "low", settings = {}, options = {}) {
  const optimizer = mergeCostOptimizerConfig(settings);
  if (!optimizer.enabled) {
    return null;
  }

  if (shouldUseOllamaFallback(settings)) {
    return buildClineSelection(AGENT_DEFINITIONS.ollama, "budget-fallback");
  }

  let hint = normalizeHint(complexityHint);
  if (options.downgradeOneTier && hint === "high") {
    hint = "medium";
  } else if (options.downgradeOneTier && hint === "medium") {
    hint = "low";
  }

  const preferredId = CLINE_COMPLEXITY_MAP[hint] || "deepseek";
  const agent =
    pickAvailableAgent(settings, [preferredId, "deepseek", "gemini", "openai", "ollama"]) ||
    AGENT_DEFINITIONS.deepseek;

  return buildClineSelection(agent, `complexity-${hint}`);
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

function buildAgentMatrixForWorkspace(settings = {}) {
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
    })),
    routing: {
      core: CORE_COMPLEXITY_MAP,
      cline: CLINE_COMPLEXITY_MAP,
    },
  };
}

module.exports = {
  AGENT_IDS,
  AGENT_DEFINITIONS,
  hasAgentCredential,
  resolveAgentForCore,
  resolveAgentForCline,
  syncAgentMatrixFromSettings,
  buildAgentMatrixForWorkspace,
  buildOptimizerModelsFromMatrix,
};
