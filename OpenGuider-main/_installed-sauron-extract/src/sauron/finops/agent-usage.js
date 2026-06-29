const { convertUsdToTl } = require("./finops-pricing");

const AGENT_IDS = ["gemini", "deepseek", "openai", "ollama"];
const CLOUD_AGENT_IDS = ["gemini", "deepseek", "openai"];

const NON_BILLABLE_OPERATIONS = new Set([
  "cost-optimizer-hint",
  "cline-agent-routing",
]);

const EMPTY_AGENT_STATS = () => ({
  spentUsd: 0,
  spentTl: 0,
  promptTokens: 0,
  completionTokens: 0,
  entryCount: 0,
});

function normalizeAgentId(value) {
  const key = String(value || "").trim().toLowerCase();
  return AGENT_IDS.includes(key) ? key : null;
}

function resolveAgentIdFromModel(model = "") {
  const normalized = String(model || "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized.startsWith("gemini")) {
    return "gemini";
  }
  if (normalized.startsWith("deepseek")) {
    return "deepseek";
  }
  if (normalized.startsWith("gpt") || normalized.startsWith("o1") || normalized.startsWith("o3")) {
    return "openai";
  }
  if (normalized.startsWith("qwen") || normalized.startsWith("llama") || normalized.startsWith("mistral")) {
    return "ollama";
  }
  return null;
}

function resolveAgentIdFromEntry(entry = {}) {
  const provider = String(entry.provider || "").trim().toLowerCase();
  const model = String(entry.model || "").trim().toLowerCase();

  const direct = normalizeAgentId(provider);
  if (direct) {
    return direct;
  }

  if (provider === "google") {
    return "gemini";
  }

  if (provider === "cline") {
    return resolveAgentIdFromModel(model);
  }

  if (provider === "sauron") {
    return null;
  }

  return resolveAgentIdFromModel(model);
}

function resolveEntryCostUsd(entry = {}, settings = {}) {
  if (Number.isFinite(Number(entry.costUsd))) {
    return Math.max(0, Number(entry.costUsd));
  }

  const costTl = Number(entry.costTl);
  if (!Number.isFinite(costTl) || costTl <= 0) {
    return 0;
  }

  const rate = Number(settings.finopsUsdToTl);
  if (!Number.isFinite(rate) || rate <= 0) {
    return 0;
  }

  return costTl / rate;
}

function summarizeByAgent(entries = [], settings = {}) {
  const byAgent = Object.fromEntries(AGENT_IDS.map((id) => [id, EMPTY_AGENT_STATS()]));

  for (const entry of entries) {
    const operation = String(entry.operation || "");
    if (NON_BILLABLE_OPERATIONS.has(operation)) {
      continue;
    }

    const agentId = resolveAgentIdFromEntry(entry);
    if (!agentId || !byAgent[agentId]) {
      continue;
    }

    const bucket = byAgent[agentId];
    bucket.entryCount += 1;
    bucket.promptTokens += Math.max(0, Number(entry.promptTokens) || 0);
    bucket.completionTokens += Math.max(0, Number(entry.completionTokens) || 0);
    bucket.spentTl += Math.max(0, Number(entry.costTl) || 0);
    bucket.spentUsd += resolveEntryCostUsd(entry, settings);
  }

  for (const agentId of AGENT_IDS) {
    byAgent[agentId].spentUsd = Number(byAgent[agentId].spentUsd.toFixed(6));
    byAgent[agentId].spentTl = Number(byAgent[agentId].spentTl.toFixed(6));
  }

  return byAgent;
}

function normalizeWalletEntry(raw = {}) {
  return {
    limitUsd: Math.max(0, Number(raw.limitUsd) || 0),
    topUpUsd: Math.max(0, Number(raw.topUpUsd) || 0),
  };
}

function normalizeAgentWallets(raw = {}) {
  const wallets = {};
  for (const agentId of AGENT_IDS) {
    wallets[agentId] = normalizeWalletEntry(raw[agentId] || {});
  }
  return wallets;
}

function buildAgentWalletSummary(settings = {}, byAgent = {}) {
  const wallets = normalizeAgentWallets(settings.finopsAgentWallets || {});
  const agentWallets = {};

  for (const agentId of AGENT_IDS) {
    const wallet = wallets[agentId];
    const usage = byAgent[agentId] || EMPTY_AGENT_STATS();
    const totalCreditUsd = wallet.limitUsd + wallet.topUpUsd;
    const remainingUsd = totalCreditUsd > 0
      ? Number((totalCreditUsd - usage.spentUsd).toFixed(6))
      : null;
    const remainingPct = totalCreditUsd > 0
      ? Math.max(0, ((remainingUsd ?? 0) / totalCreditUsd) * 100)
      : null;

    agentWallets[agentId] = {
      limitUsd: wallet.limitUsd,
      topUpUsd: wallet.topUpUsd,
      totalCreditUsd,
      spentUsd: usage.spentUsd,
      spentTl: usage.spentTl,
      remainingUsd,
      remainingPct,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      entryCount: usage.entryCount,
      unlimited: totalCreditUsd <= 0,
    };
  }

  return agentWallets;
}

function isAgentWalletAvailable(agentId, walletSummary = {}) {
  const wallet = walletSummary[agentId];
  if (!wallet) {
    return true;
  }
  if (wallet.unlimited === true) {
    return true;
  }
  const remaining = Number(wallet.remainingUsd);
  return Number.isFinite(remaining) && remaining > 0;
}

async function resolveAgentWalletState(settings = {}) {
  const { readUsageEntries, resolveUsageLogPath } = require("./usage-tracker");
  const logPath = resolveUsageLogPath(settings);
  const entries = await readUsageEntries(logPath);
  const byAgent = summarizeByAgent(entries, settings);
  const agentWallets = buildAgentWalletSummary(settings, byAgent);
  return { byAgent, agentWallets };
}

function buildExhaustedAgentAlerts(agentWallets = {}) {
  const alerts = [];
  for (const agentId of AGENT_IDS) {
    const wallet = agentWallets[agentId];
    if (!wallet || wallet.unlimited) {
      continue;
    }
    if (Number(wallet.remainingUsd) > 0) {
      continue;
    }
    alerts.push({
      level: "warning",
      message: `${agentId} bakiyesi tükendi — routing bu agent'ı atlayacak.`,
      agentId,
      exhausted: true,
      remainingUsd: wallet.remainingUsd,
    });
  }
  return alerts;
}

function areAllCloudAgentsWalletExhausted(agentWallets = {}) {
  return CLOUD_AGENT_IDS.every((agentId) => !isAgentWalletAvailable(agentId, agentWallets));
}

function buildWalletFallbackAlert(fromAgentId, toAgentId) {
  return {
    level: "warning",
    message: `${fromAgentId} bakiyesi tükendi — ${toAgentId} kullanılıyor.`,
    fromAgentId,
    toAgentId,
    walletFallback: true,
  };
}

function buildLowAgentWalletAlerts(agentWallets = {}, settings = {}) {
  const alerts = [];
  const lastAlertDate = String(settings.finopsAgentWalletLastAlertDate || "");

  for (const agentId of AGENT_IDS) {
    const wallet = agentWallets[agentId];
    if (!wallet || wallet.unlimited || wallet.remainingPct == null) {
      continue;
    }
    if (wallet.remainingPct > 20) {
      continue;
    }
    alerts.push({
      level: "warning",
      message: `${agentId} bakiyesi azalıyor — yaklaşık $${Math.max(0, wallet.remainingUsd ?? 0).toFixed(2)} kaldı.`,
      agentId,
      remainingUsd: wallet.remainingUsd,
      remainingPct: wallet.remainingPct,
      markAlertDate: lastAlertDate,
    });
  }

  if (!alerts.length) {
    return [];
  }

  const today = new Date().toISOString().slice(0, 10);
  if (lastAlertDate === today) {
    return [];
  }

  return alerts.map((alert) => ({ ...alert, markAlertDate: today }));
}

module.exports = {
  AGENT_IDS,
  CLOUD_AGENT_IDS,
  NON_BILLABLE_OPERATIONS,
  resolveAgentIdFromEntry,
  resolveAgentIdFromModel,
  summarizeByAgent,
  normalizeAgentWallets,
  buildAgentWalletSummary,
  isAgentWalletAvailable,
  resolveAgentWalletState,
  buildExhaustedAgentAlerts,
  areAllCloudAgentsWalletExhausted,
  buildWalletFallbackAlert,
  buildLowAgentWalletAlerts,
  convertUsdToTl,
};
