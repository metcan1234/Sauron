const { trackCall, readUsageEntries, resolveUsageLogPath } = require("./finops/usage-tracker");
const { estimateTokensLite } = require("./finops/tiktoken-estimator");
const { GOOSE_TOKEN_MODES } = require("./goose-config");
const { resolveGovernorTier } = require("./finops/daily-budget-governor");
const { buildBudgetWarnNotice } = require("./goose-budget-policy");

const GOOSE_OPERATION_PREFIX = "goose-session-";

function wordCountMultiplier(wordCount) {
  const words = Number(wordCount) || 0;
  if (words <= 20) {
    return 1;
  }
  if (words <= 50) {
    return 1.15;
  }
  if (words <= 100) {
    return 1.35;
  }
  return 1.6;
}

async function getGooseTodaySpentTl(settings = {}) {
  const logPath = resolveUsageLogPath(settings);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const cutoff = start.toISOString();

  let total = 0;
  try {
    const entries = await readUsageEntries(logPath);
    for (const entry of entries) {
      if (!entry.timestamp || entry.timestamp < cutoff) {
        continue;
      }
      const operation = String(entry.operation || "");
      if (!operation.startsWith(GOOSE_OPERATION_PREFIX)) {
        continue;
      }
      total += Number(entry.costTl) || 0;
    }
  } catch {
    return 0;
  }
  return total;
}

function estimateGooseSessionCostTl(mode, options = {}) {
  const key = String(mode || "balanced");
  const configured = GOOSE_TOKEN_MODES[key]?.estimatedCostTl;
  const base = configured != null ? Number(configured) : 0.12;
  if (key === "economy") {
    return 0;
  }
  const multiplier = wordCountMultiplier(options.wordCount);
  return Math.round(base * multiplier * 10000) / 10000;
}

async function recordGooseSessionStart({
  settings = {},
  mode = "balanced",
  provider,
  model,
  sessionId = "",
  wordCount = 0,
  taskText = "",
}) {
  const costTl = estimateGooseSessionCostTl(mode, { wordCount });
  const promptTokens = estimateTokensLite(String(taskText || ""), model);
  trackCall({
    provider: String(provider || "unknown"),
    model: String(model || "default"),
    promptTokens,
    completionTokens: 0,
    costTl,
    operation: `${GOOSE_OPERATION_PREFIX}${mode}`,
    latencyMs: 0,
    timestamp: new Date().toISOString(),
    sessionId: String(sessionId || "").trim() || undefined,
    sourceNote: `Goose terminal session (estimated, ${wordCount} words)`,
    estimated: true,
    wordCount: Number(wordCount) || 0,
    channel: "goose",
    source: "goose",
  }, settings);
  return { costTl, estimated: true, wordCount, promptTokens };
}

async function summarizeGooseUsage(settings = {}) {
  const logPath = resolveUsageLogPath(settings);
  const byMode = { economy: 0, balanced: 0, premium: 0 };
  let total = 0;
  let count = 0;

  try {
    const entries = await readUsageEntries(logPath);
    for (const entry of entries) {
      const operation = String(entry.operation || "");
      if (!operation.startsWith(GOOSE_OPERATION_PREFIX)) {
        continue;
      }
      const cost = Number(entry.costTl) || 0;
      total += cost;
      count += 1;
      const modeKey = operation.replace(GOOSE_OPERATION_PREFIX, "");
      if (byMode[modeKey] != null) {
        byMode[modeKey] += cost;
      }
    }
  } catch {
    // ignore
  }

  return { total, count, byMode };
}

async function getGooseDailySpendSummary(settings = {}) {
  const spentTl = await getGooseTodaySpentTl(settings);
  const summary = await summarizeGooseUsage(settings);
  const dailyBudgetTl = Number(settings.gooseDailyBudgetTl) || 0;
  const budgetWarn = buildBudgetWarnNotice(settings, spentTl);

  let governorTier = { level: "none", spendRatio: 0 };
  if (settings.gooseFinopsShareGlobalBudget !== false) {
    try {
      governorTier = await resolveGovernorTier(settings);
    } catch {
      governorTier = { level: "none", spendRatio: 0 };
    }
  }

  return {
    ok: true,
    spentTl,
    dailyBudgetTl,
    remainingTl: dailyBudgetTl > 0 ? Math.max(0, dailyBudgetTl - spentTl) : null,
    summary,
    budgetWarn,
    governorTier,
  };
}

module.exports = {
  GOOSE_OPERATION_PREFIX,
  wordCountMultiplier,
  getGooseTodaySpentTl,
  estimateGooseSessionCostTl,
  recordGooseSessionStart,
  summarizeGooseUsage,
  getGooseDailySpendSummary,
};
