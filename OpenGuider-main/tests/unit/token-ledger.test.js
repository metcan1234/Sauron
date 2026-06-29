const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  inferChannel,
  summarizeByChannel,
  estimateTokensLite,
} = require("../../src/sauron/finops/tiktoken-estimator");
const {
  trackCall,
  readUsageEntries,
  flushWriteQueueForTests,
  resetWriteQueueForTests,
} = require("../../src/sauron/finops/usage-tracker");

test("inferChannel maps goose and workspace operations", () => {
  assert.equal(inferChannel({ operation: "goose-session-balanced" }), "goose");
  assert.equal(inferChannel({ operation: "cline-task", source: "cline" }), "workspace");
  assert.equal(inferChannel({ operation: "chat", channel: "core" }), "core");
});

test("summarizeByChannel aggregates token counts", () => {
  const summary = summarizeByChannel([
    { channel: "core", promptTokens: 100, completionTokens: 20, costTl: 1 },
    { channel: "workspace", promptTokens: 50, completionTokens: 10, costTl: 0.5 },
  ]);
  assert.equal(summary.core.promptTokens, 100);
  assert.equal(summary.workspace.promptTokens, 50);
});

test("usage tracker persists channel field", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-ledger-"));
  const settings = { workspacePath: tmp };
  resetWriteQueueForTests();
  trackCall({
    provider: "gamedev",
    model: "unity",
    promptTokens: 12,
    completionTokens: 0,
    costTl: 0,
    operation: "gamedev-session-start",
    channel: "gamedev",
  }, settings);
  await new Promise((resolve) => setImmediate(resolve));
  await flushWriteQueueForTests();
  const entries = await readUsageEntries(path.join(tmp, ".sauron", "usage", "logs.jsonl"));
  assert.equal(entries[0].channel, "gamedev");
});
