const fs = require("fs");
const os = require("os");
const path = require("path");
const { createLogger } = require("../../logger");
const { summarizeByAgent, buildAgentWalletSummary, summarizeAgentChannelBreakdown } = require("./agent-usage");
const { inferChannel, summarizeByChannel } = require("./tiktoken-estimator");
const { readTokenUltraCache } = require("../token-ultra/delta-store");

const logger = createLogger("usage-tracker");
const LOG_FILENAME = "logs.jsonl";

let writeChain = Promise.resolve();

function resolveUsageLogPath(settings = {}) {
  const workspacePath = String(settings.workspacePath || "").trim();
  if (workspacePath) {
    return path.join(workspacePath, ".sauron", "usage", LOG_FILENAME);
  }
  return path.join(os.homedir(), ".sauron", "usage", LOG_FILENAME);
}

function ensureLogDirectory(logPath) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
}

function appendUsageRecord(logPath, record) {
  ensureLogDirectory(logPath);
  const line = `${JSON.stringify(record)}\n`;
  writeChain = writeChain
    .then(() => fs.promises.appendFile(logPath, line, "utf8"))
    .catch((error) => {
      logger.error("usage-tracker:write-failed", {
        error: error?.message || String(error),
        logPath,
        operation: record?.operation,
      });
    });
  return writeChain;
}

function normalizeRecord(record = {}) {
  const normalized = {
    provider: String(record.provider || "unknown"),
    model: String(record.model || "default"),
    promptTokens: Math.max(0, Number(record.promptTokens) || 0),
    completionTokens: Math.max(0, Number(record.completionTokens) || 0),
    costTl: Math.max(0, Number(record.costTl) || 0),
    operation: String(record.operation || "chat"),
    latencyMs: Math.max(0, Number(record.latencyMs) || 0),
    timestamp: record.timestamp || new Date().toISOString(),
  };
  const sessionId = String(record.sessionId || "").trim();
  if (sessionId) {
    normalized.sessionId = sessionId;
  }
  const recordId = String(record.recordId || "").trim();
  if (recordId) {
    normalized.recordId = recordId;
  }
  const sourceNote = String(record.sourceNote || "").trim();
  if (sourceNote) {
    normalized.sourceNote = sourceNote;
  }
  if (record.estimated === true) {
    normalized.estimated = true;
  }
  if (Number.isFinite(Number(record.costUsd))) {
    normalized.costUsd = Math.max(0, Number(record.costUsd));
  }
  const source = String(record.source || "").trim();
  if (source) {
    normalized.source = source;
  }
  normalized.channel = inferChannel(record);
  return normalized;
}

function trackCall(record, settings = {}) {
  const normalized = normalizeRecord(record);
  const logPath = resolveUsageLogPath(settings);

  setImmediate(() => {
    appendUsageRecord(logPath, normalized).catch(() => {});
  });

  return normalized;
}

function importRecord(record, settings = {}) {
  return trackCall({ ...record, operation: record.operation || "external" }, settings);
}

async function readUsageEntries(logPath) {
  try {
    const raw = await fs.promises.readFile(logPath, "utf8");
    return dedupeUsageEntries(
      raw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean),
    );
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function dedupeUsageEntries(entries = []) {
  const byRecordId = new Map();
  const withoutId = [];

  for (const entry of entries) {
    const recordId = entry?.recordId ? String(entry.recordId) : "";
    if (!recordId) {
      withoutId.push(entry);
      continue;
    }
    byRecordId.set(recordId, entry);
  }

  return [...withoutId, ...byRecordId.values()];
}

function summarizeBreakdown(entries = []) {
  const byOperation = {};
  const byProvider = {};

  for (const entry of entries) {
    const operation = String(entry.operation || "unknown");
    const provider = String(entry.provider || "unknown");
    const costTl = Number(entry.costTl) || 0;

    byOperation[operation] = (byOperation[operation] || 0) + costTl;
    byProvider[provider] = (byProvider[provider] || 0) + costTl;
  }

  return { byOperation, byProvider };
}

async function getTotalSpentTl(settings = {}) {
  const logPath = resolveUsageLogPath(settings);
  const entries = await readUsageEntries(logPath);
  return entries.reduce((sum, entry) => sum + (Number(entry.costTl) || 0), 0);
}

async function getUsageSummary(settings = {}, options = {}) {
  const logPath = resolveUsageLogPath(settings);
  const entries = await readUsageEntries(logPath);
  const totalSpentTl = entries.reduce((sum, entry) => sum + (Number(entry.costTl) || 0), 0);
  const chatSessionId = String(options.chatSessionId || "").trim();
  const sessionSpentTl = chatSessionId
    ? entries
      .filter((entry) => String(entry.sessionId || "") === chatSessionId)
      .reduce((sum, entry) => sum + (Number(entry.costTl) || 0), 0)
    : 0;
  const budget = Number(settings.finopsTotalBudgetTl) || 0;
  const remainingTl = budget > 0 ? budget - totalSpentTl : null;
  const remainingPct = budget > 0 ? Math.max(0, (remainingTl / budget) * 100) : null;
  const { byOperation, byProvider } = summarizeBreakdown(entries);
  const byChannel = summarizeByChannel(entries);
  const byAgent = summarizeByAgent(entries, settings);
  const agentChannelBreakdown = summarizeAgentChannelBreakdown(entries, settings);
  const agentWallets = buildAgentWalletSummary(settings, byAgent, agentChannelBreakdown);
  const workspacePath = String(settings.workspacePath || "").trim();
  const tokenUltraCache = workspacePath ? readTokenUltraCache(workspacePath) : null;
  const tokenUltraStats = {
    estimatedCharsSaved: Number(tokenUltraCache?.savings?.estimatedCharsSaved) || 0,
    handoffCount: Number(tokenUltraCache?.savings?.handoffCount) || 0,
    lastHandoffId: tokenUltraCache?.lastHandoffId || null,
  };
  const clineReadonlyEntries = entries.filter((entry) => entry.operation === "cline-task-readonly");
  const clineReadonlyEntryCount = clineReadonlyEntries.length;
  const clineReadonlySpentTl = clineReadonlyEntries.reduce(
    (sum, entry) => sum + (Number(entry.costTl) || 0),
    0,
  );

  return {
    totalSpentTl,
    sessionSpentTl,
    chatSessionId: chatSessionId || null,
    remainingTl,
    remainingPct,
    budgetTl: budget,
    logPath,
    entryCount: entries.length,
    byOperation,
    byProvider,
    byChannel,
    byAgent,
    agentChannelBreakdown,
    agentWallets,
    tokenUltraStats,
    clineReadonlyEntryCount,
    clineReadonlySpentTl,
    clineReadonlyNote: clineReadonlyEntryCount > 0
      ? "Cline kayıtları tahmini — Cline görev geçmişinden periyodik okundu."
      : null,
  };
}

function getRemainingBudgetTl(settings = {}, totalSpentTl = null) {
  const budget = Number(settings.finopsTotalBudgetTl) || 0;
  if (budget <= 0) return null;
  const spent = Number.isFinite(totalSpentTl) ? totalSpentTl : 0;
  return budget - spent;
}

async function getUsageTimeSeries(settings = {}, options = {}) {
  const days = Math.max(1, Math.min(365, Number(options.days) || 7));
  const logPath = resolveUsageLogPath(settings);
  const entries = await readUsageEntries(logPath);

  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));

  const buckets = {};
  for (let offset = 0; offset < days; offset += 1) {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + offset);
    const key = day.toISOString().slice(0, 10);
    buckets[key] = {
      date: key,
      costTl: 0,
      calls: 0,
      promptTokens: 0,
      completionTokens: 0,
    };
  }

  for (const entry of entries) {
    const key = String(entry.timestamp || "").slice(0, 10);
    if (!buckets[key]) {
      continue;
    }
    buckets[key].costTl += Number(entry.costTl) || 0;
    buckets[key].calls += 1;
    buckets[key].promptTokens += Number(entry.promptTokens) || 0;
    buckets[key].completionTokens += Number(entry.completionTokens) || 0;
  }

  return Object.values(buckets).sort((a, b) => a.date.localeCompare(b.date));
}

function resetWriteQueueForTests() {
  writeChain = Promise.resolve();
}

async function flushWriteQueueForTests() {
  await writeChain;
}

module.exports = {
  resolveUsageLogPath,
  trackCall,
  importRecord,
  getTotalSpentTl,
  getUsageSummary,
  getUsageTimeSeries,
  getRemainingBudgetTl,
  readUsageEntries,
  dedupeUsageEntries,
  summarizeBreakdown,
  summarizeByChannel,
  resetWriteQueueForTests,
  flushWriteQueueForTests,
};
