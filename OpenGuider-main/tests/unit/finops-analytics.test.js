const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  getUsageTimeSeries,
  trackCall,
  resetWriteQueueForTests,
  flushWriteQueueForTests,
} = require("../../src/sauron/finops/usage-tracker");

test("getUsageTimeSeries aggregates daily cost buckets", async () => {
  resetWriteQueueForTests();
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "finops-analytics-"));
  try {
    const settings = { workspacePath: workspace };
    trackCall({
      provider: "openai",
      model: "gpt-4o-mini",
      promptTokens: 100,
      completionTokens: 50,
      costTl: 1.5,
      operation: "chat",
      timestamp: new Date().toISOString().slice(0, 10) + "T12:00:00.000Z",
    }, settings);
    trackCall({
      provider: "gemini",
      model: "flash",
      promptTokens: 80,
      completionTokens: 20,
      costTl: 0.5,
      operation: "browser-goal",
      timestamp: new Date().toISOString().slice(0, 10) + "T15:00:00.000Z",
    }, settings);

    await new Promise((resolve) => setImmediate(resolve));
    await flushWriteQueueForTests();

    const series = await getUsageTimeSeries(settings, { days: 3 });
    assert.equal(series.length, 3);
    const today = new Date().toISOString().slice(0, 10);
    const targetDay = series.find((entry) => entry.date === today);
    assert.ok(targetDay);
    assert.equal(targetDay.costTl, 2);
    assert.equal(targetDay.calls, 2);
    assert.equal(targetDay.promptTokens, 180);
    assert.equal(targetDay.completionTokens, 70);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
