const fs = require("fs");
const path = require("path");
const { trackCall } = require("./finops/usage-tracker");
const { estimateTokensLite } = require("./finops/tiktoken-estimator");

const LEDGER_FILENAME = "gamedev-finops.jsonl";

function getLedgerPath(workspacePath) {
  return path.join(String(workspacePath || "").trim(), ".sauron", LEDGER_FILENAME);
}

function syncGamedevEventToMainLedger(workspacePath, event = {}, settings = {}) {
  const type = String(event.type || "");
  if (type === "llm-usage") {
    const tokens = Math.max(0, Number(event.tokens) || 0);
    trackCall({
      provider: String(event.provider || "gamedev"),
      model: String(event.model || "mcp-session"),
      promptTokens: tokens,
      completionTokens: 0,
      costTl: Math.max(0, Number(event.costTl) || 0),
      operation: "gamedev-llm-usage",
      latencyMs: 0,
      timestamp: event.timestamp || new Date().toISOString(),
      channel: "gamedev",
      source: "gamedev",
      recordId: event.recordId,
    }, { ...settings, workspacePath });
    return true;
  }

  if (type === "session-start") {
    const promptTokens = estimateTokensLite(String(event.goal || event.handoffId || ""), "gamedev");
    trackCall({
      provider: "gamedev",
      model: String(event.engine || "unity"),
      promptTokens,
      completionTokens: 0,
      costTl: 0,
      operation: "gamedev-session-start",
      latencyMs: 0,
      timestamp: event.timestamp || new Date().toISOString(),
      channel: "gamedev",
      source: "gamedev",
      recordId: event.handoffId ? `gamedev:${event.handoffId}` : undefined,
      sessionId: event.handoffId,
    }, { ...settings, workspacePath });
    return true;
  }

  return false;
}

function appendGamedevLedgerEvent(workspacePath, event = {}, settings = {}) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return false;
  }
  const ledgerPath = getLedgerPath(resolved);
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  const payload = {
    timestamp: new Date().toISOString(),
    ...event,
  };
  const line = JSON.stringify(payload);
  fs.appendFileSync(ledgerPath, `${line}\n`, "utf8");
  syncGamedevEventToMainLedger(resolved, payload, settings);
  return true;
}

function readRecentGamedevLedger(workspacePath, limit = 20) {
  const ledgerPath = getLedgerPath(workspacePath);
  try {
    if (!fs.existsSync(ledgerPath)) {
      return [];
    }
    const lines = fs.readFileSync(ledgerPath, "utf8").trim().split("\n").filter(Boolean);
    return lines.slice(-limit).map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);
  } catch {
    return [];
  }
}

function summarizeGamedevLedger(workspacePath) {
  const events = readRecentGamedevLedger(workspacePath, 50);
  let mcpToolCalls = 0;
  let llmTokensEst = 0;
  let sessions = 0;
  const byEngine = { unity: 0, unreal: 0, other: 0 };
  for (const event of events) {
    if (event.type === "session-start") {
      sessions += 1;
      const key = String(event.engine || "other").toLowerCase();
      if (key === "unity" || key === "unreal") {
        byEngine[key] += 1;
      } else {
        byEngine.other += 1;
      }
    }
    if (event.type === "mcp-tool") {
      mcpToolCalls += Number(event.count) || 1;
    }
    if (event.type === "llm-usage") {
      llmTokensEst += Number(event.tokens) || 0;
    }
  }
  return { sessions, mcpToolCalls, llmTokensEst, eventCount: events.length, byEngine };
}

module.exports = {
  LEDGER_FILENAME,
  appendGamedevLedgerEvent,
  readRecentGamedevLedger,
  summarizeGamedevLedger,
  syncGamedevEventToMainLedger,
};
