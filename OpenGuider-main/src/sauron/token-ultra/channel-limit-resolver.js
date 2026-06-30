const { mergeCostOptimizerConfig } = require("../finops/cost-optimizer-config");

const CHANNEL_DEFAULTS = {
  workspace: 4500,
  goose: 4000,
  gamedev: 4500,
};

const CHANNEL_SETTING_KEYS = {
  workspace: "tokenUltraWorkspaceMaxChars",
  goose: "tokenUltraGooseMaxChars",
  gamedev: "tokenUltraGamedevMaxChars",
};

function resolveGlobalMaxChars(settings = {}) {
  const value = Number(settings.tokenUltraMaxHandoffChars);
  return Number.isFinite(value) && value > 0 ? value : 6000;
}

function resolveChannelMaxChars(settings = {}, channel = "workspace") {
  const fallback = resolveGlobalMaxChars(settings);
  const key = CHANNEL_SETTING_KEYS[channel];
  if (!key) {
    return fallback;
  }
  const value = Number(settings[key]);
  if (Number.isFinite(value) && value > 0) {
    return value;
  }
  return CHANNEL_DEFAULTS[channel] ?? fallback;
}

function resolveGamedevTaskMaxChars(settings = {}) {
  const value = Number(settings.tokenUltraGamedevTaskMaxChars);
  if (Number.isFinite(value) && value > 0) {
    return value;
  }
  return 600;
}

function resolveWorkspaceHandoffMaxChars(settings = {}) {
  const optimizer = mergeCostOptimizerConfig(settings);
  const finopsMax = Number(optimizer.routing?.handoffMaxChars) || 4000;
  const workspaceMax = resolveChannelMaxChars(settings, "workspace");
  return Math.min(finopsMax, workspaceMax);
}

function buildChannelLimitsPayload(settings = {}) {
  return {
    global: resolveGlobalMaxChars(settings),
    workspace: resolveChannelMaxChars(settings, "workspace"),
    goose: resolveChannelMaxChars(settings, "goose"),
    gamedev: resolveChannelMaxChars(settings, "gamedev"),
    gamedevTask: resolveGamedevTaskMaxChars(settings),
    gamedevBrief: Number(settings.gamedevBriefMaxChars) > 0
      ? Number(settings.gamedevBriefMaxChars)
      : 8000,
  };
}

module.exports = {
  CHANNEL_DEFAULTS,
  CHANNEL_SETTING_KEYS,
  buildChannelLimitsPayload,
  resolveChannelMaxChars,
  resolveGamedevTaskMaxChars,
  resolveGlobalMaxChars,
  resolveWorkspaceHandoffMaxChars,
};
