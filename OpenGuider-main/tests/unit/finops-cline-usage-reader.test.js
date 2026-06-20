const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  computeUsageDelta,
  syncClineUsageFromDisk,
  taskMatchesWorkspace,
  getSyncStatePath,
} = require("../../src/sauron/finops/cline-usage-reader");
const {
  flushWriteQueueForTests,
  readUsageEntries,
  resetWriteQueueForTests,
} = require("../../src/sauron/finops/usage-tracker");

test("taskMatchesWorkspace compares paths case-insensitively on Windows", () => {
  const workspace = "C:\\Users\\Can\\OneDrive\\Desktop\\denemeler";
  assert.equal(taskMatchesWorkspace({
    cwdOnTaskInitialization: "c:\\Users\\Can\\OneDrive\\Desktop\\denemeler",
  }, workspace), true);
  assert.equal(taskMatchesWorkspace({
    cwdOnTaskInitialization: "C:\\Users\\Can\\Desktop",
  }, workspace), false);
});

test("computeUsageDelta returns null for unchanged task metrics", () => {
  const previous = { totalCost: 0.01, tokensIn: 10, tokensOut: 20, ts: 1, modelId: "gpt-4o" };
  const delta = computeUsageDelta({
    totalCost: 0.01,
    tokensIn: 10,
    tokensOut: 20,
    ts: 1,
    modelId: "gpt-4o",
  }, previous);
  assert.equal(delta, null);
});

test("computeUsageDelta returns incremental cost when task grows", () => {
  const previous = { totalCost: 0.01, tokensIn: 10, tokensOut: 20, ts: 1, modelId: "gpt-4o" };
  const delta = computeUsageDelta({
    totalCost: 0.015,
    tokensIn: 10,
    tokensOut: 35,
    ts: 2,
    modelId: "gpt-4o",
  }, previous);
  assert.equal(delta.tokensIn, 0);
  assert.equal(delta.tokensOut, 15);
  assert.ok(Math.abs(delta.totalCost - 0.005) < 1e-9);
  assert.equal(delta.ts, 2);
  assert.equal(delta.modelId, "gpt-4o");
});

test("syncClineUsageFromDisk imports cline-task-readonly records from taskHistory.json", async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "og-cline-usage-"));
  const historyPath = path.join(workspace, "taskHistory.json");
  const settings = {
    workspacePath: workspace,
    finopsUsdToTl: 40,
  };

  fs.writeFileSync(historyPath, JSON.stringify([
    {
      id: "task-100",
      ts: Date.now(),
      task: "demo",
      tokensIn: 100,
      tokensOut: 50,
      totalCost: 0.01,
      modelId: "deepseek-v4-flash",
      cwdOnTaskInitialization: workspace,
    },
  ]), "utf8");

  resetWriteQueueForTests();

  const first = await syncClineUsageFromDisk(settings, { historyPath });
  assert.equal(first.ok, true);
  assert.equal(first.imported, 1);

  await new Promise((resolve) => setImmediate(resolve));
  await flushWriteQueueForTests();

  const logPath = path.join(workspace, ".sauron", "usage", "logs.jsonl");
  const entries = await readUsageEntries(logPath);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].operation, "cline-task-readonly");
  assert.equal(entries[0].provider, "cline");
  assert.equal(entries[0].model, "deepseek-v4-flash");
  assert.equal(entries[0].costUsd, 0.01);
  assert.equal(entries[0].costTl, 0.4);
  assert.equal(entries[0].estimated, true);
  assert.match(entries[0].sourceNote, /Cline geçmişinden/i);

  const second = await syncClineUsageFromDisk(settings, { historyPath });
  assert.equal(second.imported, 0);

  fs.writeFileSync(historyPath, JSON.stringify([
    {
      id: "task-100",
      ts: Date.now(),
      task: "demo",
      tokensIn: 100,
      tokensOut: 80,
      totalCost: 0.015,
      modelId: "deepseek-v4-flash",
      cwdOnTaskInitialization: workspace,
    },
  ]), "utf8");

  const third = await syncClineUsageFromDisk(settings, { historyPath });
  assert.equal(third.imported, 1);
  await new Promise((resolve) => setImmediate(resolve));
  await flushWriteQueueForTests();

  const updatedEntries = await readUsageEntries(logPath);
  assert.equal(updatedEntries.length, 2);
  assert.ok(Math.abs(updatedEntries[1].costUsd - 0.005) < 1e-9);
  assert.equal(fs.existsSync(getSyncStatePath(workspace)), true);

  fs.rmSync(workspace, { recursive: true, force: true });
});

test("syncClineUsageFromDisk skips when workspace is not configured", async () => {
  const result = await syncClineUsageFromDisk({}, { historyPath: "missing.json" });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "workspace-not-configured");
});
