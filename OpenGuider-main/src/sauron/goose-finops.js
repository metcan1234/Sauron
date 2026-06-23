const { trackCall, readUsageEntries, resolveUsageLogPath } = require("./finops/usage-tracker");
const { GOOSE_TOKEN_MODES } = require("./goose-config");

const GOOSE_OPERATION_PREFIX = "goose-session-";

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

function estimateGooseSessionCostTl(mode) {
  const key = String(mode || "balanced");
  const configured = GOOSE_TOKEN_MODES[key]?.estimatedCostTl;
  if (configured != null) {
    return Number(configured);
  }
  return 0.12;
}

async function recordGooseSessionStart({
  settings = {},
  mode = "balanced",
  provider,
  model,
  sessionId = "",
}) {
  const costTl = estimateGooseSessionCostTl(mode);
  trackCall({
    provider: String(provider || "unknown"),
    model: String(model || "default"),
    promptTokens: 0,
    completionTokens: 0,
    costTl,
    operation: `${GOOSE_OPERATION_PREFIX}${mode}`,
    latencyMs: 0,
    timestamp: new Date().toISOString(),
    sessionId: String(sessionId || "").trim() || undefined,
    sourceNote: "Goose terminal session (estimated)",
    estimated: true,
  }, settings);
  return { costTl, estimated: true };
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
      const mode = operation.replace(GOOSE_OPERATION_PREFIX, "");
      if (byMode[mode] != null) {
        byMode[mode] += cost;
      }
    }
  } catch {
    // ignore
  }

  return { total, count, byMode };
}

module.exports = {
  GOOSE_OPERATION_PREFIX,
  getGooseTodaySpentTl,
  estimateGooseSessionCostTl,
  recordGooseSessionStart,
  summarizeGooseUsage,
};
