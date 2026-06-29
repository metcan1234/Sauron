const fs = require("fs");
const path = require("path");
const { mergeCostOptimizerConfig } = require("./cost-optimizer-config");
const { buildAgentMatrixForWorkspace } = require("./agent-matrix");
const { resolveAgentWalletState } = require("./agent-usage");
const { buildChannelLimitsPayload } = require("../token-ultra/channel-limit-resolver");

const HANDOFF_DIR = ".sauron";
const FINOPS_CONFIG_FILENAME = "finops-config.json";

const DEFAULT_FINOPS_CONFIG = {
  enabled: true,
  finopsUsdToTl: 34.5,
  pollIntervalMs: 5000,
  emitMode: "task-complete",
};

function getFinOpsConfigPath(workspacePath) {
  return path.join(String(workspacePath || "").trim(), HANDOFF_DIR, FINOPS_CONFIG_FILENAME);
}

async function buildFinOpsConfigFromSettings(settings = {}) {
  const costOptimizer = mergeCostOptimizerConfig(settings);
  const { agentWallets } = await resolveAgentWalletState(settings);
  return {
    enabled: true,
    trackingOnly: settings.finopsTrackingOnly !== false,
    restrictModels: settings.finopsRestrictModels === true,
    finopsUsdToTl: Number.isFinite(Number(settings.finopsUsdToTl))
      ? Number(settings.finopsUsdToTl)
      : DEFAULT_FINOPS_CONFIG.finopsUsdToTl,
    pollIntervalMs: DEFAULT_FINOPS_CONFIG.pollIntervalMs,
    emitMode: DEFAULT_FINOPS_CONFIG.emitMode,
    costOptimizer: {
      ...costOptimizer,
      agentMatrix: buildAgentMatrixForWorkspace(settings, agentWallets),
    },
    tokenUltra: {
      channelLimits: buildChannelLimitsPayload(settings),
    },
  };
}

async function readFinOpsWorkspaceConfig(workspacePath) {
  const configPath = getFinOpsConfigPath(workspacePath);
  try {
    const raw = await fs.promises.readFile(configPath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function syncFinOpsConfigToWorkspace(settings = {}) {
  const workspacePath = String(settings.workspacePath || "").trim();
  if (!workspacePath) {
    return { ok: false, reason: "missing-workspace" };
  }

  const configPath = getFinOpsConfigPath(workspacePath);
  const payload = await buildFinOpsConfigFromSettings(settings);
  await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
  await fs.promises.writeFile(configPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return { ok: true, configPath, payload };
}

module.exports = {
  DEFAULT_FINOPS_CONFIG,
  getFinOpsConfigPath,
  buildFinOpsConfigFromSettings,
  readFinOpsWorkspaceConfig,
  syncFinOpsConfigToWorkspace,
};
