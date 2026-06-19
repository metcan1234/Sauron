const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  resolveUsageLogPath,
  trackCall,
  getTotalSpentTl,
  resetWriteQueueForTests,
} = require("../../src/sauron/finops/usage-tracker");

test("resolveUsageLogPath uses workspace when configured", () => {
  const logPath = resolveUsageLogPath({ workspacePath: "C:/Projects/demo" });
  assert.match(logPath, /[\\/]\.sauron[\\/]usage[\\/]logs\.jsonl$/);
  assert.match(logPath, /Projects[\\/]demo/);
});

test("resolveUsageLogPath falls back to home directory", () => {
  const logPath = resolveUsageLogPath({});
  assert.equal(logPath, path.join(os.homedir(), ".sauron", "usage", "logs.jsonl"));
});

test("trackCall writes jsonl records through write queue", async () => {
  resetWriteQueueForTests();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "finops-usage-"));
  const settings = { workspacePath: tempRoot };

  trackCall(
    {
      provider: "openai",
      model: "gpt-4o",
      promptTokens: 10,
      completionTokens: 20,
      costTl: 0.5,
      operation: "chat",
      latencyMs: 120,
      timestamp: "2026-06-19T12:00:00.000Z",
    },
    settings,
  );

  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setTimeout(resolve, 50));

  const logPath = resolveUsageLogPath(settings);
  const raw = fs.readFileSync(logPath, "utf8").trim();
  const parsed = JSON.parse(raw.split("\n").pop());

  assert.equal(parsed.provider, "openai");
  assert.equal(parsed.model, "gpt-4o");
  assert.equal(parsed.promptTokens, 10);
  assert.equal(parsed.completionTokens, 20);
  assert.equal(parsed.costTl, 0.5);
  assert.equal(parsed.operation, "chat");
  assert.equal(parsed.latencyMs, 120);
  assert.equal(parsed.timestamp, "2026-06-19T12:00:00.000Z");

  const total = await getTotalSpentTl(settings);
  assert.equal(total, 0.5);

  fs.rmSync(tempRoot, { recursive: true, force: true });
});
