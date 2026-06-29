const fs = require("fs");
const path = require("path");

const LEDGER_FILENAME = "gamedev-finops.jsonl";

function getLedgerPath(workspacePath) {
  return path.join(String(workspacePath || "").trim(), ".sauron", LEDGER_FILENAME);
}

function appendGamedevLedgerEvent(workspacePath, event = {}) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return false;
  }
  const ledgerPath = getLedgerPath(resolved);
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    ...event,
  });
  fs.appendFileSync(ledgerPath, `${line}\n`, "utf8");
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
  for (const event of events) {
    if (event.type === "session-start") {
      sessions += 1;
    }
    if (event.type === "mcp-tool") {
      mcpToolCalls += Number(event.count) || 1;
    }
    if (event.type === "llm-usage") {
      llmTokensEst += Number(event.tokens) || 0;
    }
  }
  return { sessions, mcpToolCalls, llmTokensEst, eventCount: events.length };
}

module.exports = {
  LEDGER_FILENAME,
  appendGamedevLedgerEvent,
  readRecentGamedevLedger,
  summarizeGamedevLedger,
};
