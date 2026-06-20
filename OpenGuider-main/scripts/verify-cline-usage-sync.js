#!/usr/bin/env node
/**
 * One-shot sync from Cline taskHistory.json into workspace usage logs.
 * Usage: node scripts/verify-cline-usage-sync.js
 */
const fs = require("fs");
const path = require("path");
const { syncClineUsageFromDisk, resolveClineTaskHistoryPath } = require("../src/sauron/finops/cline-usage-reader");
const { flushWriteQueueForTests, readUsageEntries } = require("../src/sauron/finops/usage-tracker");

function readWorkspaceFromConfig() {
  const configPath = path.join(process.env.APPDATA || "", "openguider", "config.json");
  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const workspacePath = String(config.workspacePath || "").trim();
    if (workspacePath && fs.existsSync(workspacePath)) {
      return workspacePath;
    }
  } catch {
    // fall through
  }
  return "";
}

async function main() {
  const workspacePath = readWorkspaceFromConfig();
  const settings = {
    workspacePath,
    finopsUsdToTl: 34.5,
  };

  const historyPath = resolveClineTaskHistoryPath();
  console.log(JSON.stringify({
    historyPath,
    historyExists: Boolean(historyPath && fs.existsSync(historyPath)),
    workspacePath,
  }, null, 2));

  const result = await syncClineUsageFromDisk(settings);
  await new Promise((resolve) => setImmediate(resolve));
  await flushWriteQueueForTests();

  const logPath = path.join(workspacePath, ".sauron", "usage", "logs.jsonl");
  const entries = fs.existsSync(logPath)
    ? await readUsageEntries(logPath)
    : [];
  const clineEntries = entries.filter((entry) => entry.operation === "cline-task-readonly");

  console.log(JSON.stringify({
    syncResult: result,
    logPath,
    clineReadonlyCount: clineEntries.length,
    clineReadonlySample: clineEntries.slice(-3),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
