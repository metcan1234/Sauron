const { mergeCostOptimizerConfig } = require("./finops/cost-optimizer-config");
const { resolveAgentForCline } = require("./finops/agent-matrix");

const GAMEDEV_MODES = ["economy", "balanced", "premium"];

function buildGameDevPlanBullets(taskText, maxItems = 5) {
  const raw = String(taskText || "").trim();
  if (!raw) {
    return "";
  }
  const segments = raw
    .split(/(?:[.!?;]\s+|\n+)/)
    .map((part) => part.trim())
    .filter(Boolean);
  const items = (segments.length > 1 ? segments : raw.split(/\s+/).reduce((acc, word) => {
    const last = acc[acc.length - 1] || "";
    const next = last ? `${last} ${word}` : word;
    if (next.length > 80 && last) {
      acc.push(last);
      acc.push(word);
    } else if (last) {
      acc[acc.length - 1] = next;
    } else {
      acc.push(word);
    }
    return acc;
  }, [])).slice(0, maxItems);

  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function resolveGamedevMode(settings = {}) {
  const optimizer = mergeCostOptimizerConfig(settings);
  const configured = String(settings.gamedevDefaultMode || "economy").trim().toLowerCase();
  const mode = GAMEDEV_MODES.includes(configured) ? configured : "economy";

  if (optimizer.mode === "economy" || optimizer.coreModelTier === "economy") {
    return {
      mode: "economy",
      reason: "finops-economy-default",
      llmTier: "economy",
      useOllamaPlan: Boolean(String(settings.ollamaUrl || "").trim()),
    };
  }

  return {
    mode,
    reason: "configured",
    llmTier: optimizer.coreModelTier || "economy",
    useOllamaPlan: mode === "economy",
  };
}

function resolveGamedevClineAgent(settings = {}, options = {}) {
  const routed = resolveAgentForCline("low", settings, {
    budgetGovernorActive: options.budgetGovernorActive === true,
    agentWallets: options.agentWallets || null,
  });

  if (routed) {
    return {
      providerId: routed.providerId,
      modelId: routed.modelId,
      agentId: routed.agentId,
      reason: routed.reason || "gamedev-agent-matrix",
      walletFallbackFrom: routed.walletFallbackFrom || null,
      allCloudExhausted: routed.allCloudExhausted === true,
    };
  }

  return {
    providerId: "deepseek",
    modelId: String(settings.deepseekModelCustom || "deepseek-chat").trim() || "deepseek-chat",
    agentId: "deepseek",
    reason: "gamedev-fallback",
  };
}

module.exports = {
  GAMEDEV_MODES,
  buildGameDevPlanBullets,
  resolveGamedevMode,
  resolveGamedevClineAgent,
};
