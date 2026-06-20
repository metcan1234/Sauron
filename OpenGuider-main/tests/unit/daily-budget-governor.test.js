const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  shouldActivateBudgetGovernor,
  buildGovernorAlertPayload,
  GOVERNOR_ALERT_MESSAGE,
} = require("../../src/sauron/finops/daily-budget-governor");
const { flushWriteQueueForTests, trackCall } = require("../../src/sauron/finops/usage-tracker");

test("shouldActivateBudgetGovernor is disabled when daily budget is zero", async () => {
  const active = await shouldActivateBudgetGovernor({
    finopsCostOptimizerEnabled: true,
    finopsDailyBudgetTl: 0,
  });
  assert.equal(active, false);
});

test("shouldActivateBudgetGovernor activates when spend exceeds burn-rate threshold", async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "daily-governor-"));
  const settings = {
    workspacePath: workspace,
    finopsCostOptimizerEnabled: true,
    finopsDailyBudgetTl: 10,
  };

  try {
    trackCall({
      provider: "openai",
      model: "gpt-4o-mini",
      promptTokens: 1000,
      completionTokens: 500,
      costTl: 20,
      operation: "chat",
      timestamp: new Date().toISOString(),
    }, settings);
    await new Promise((resolve) => setImmediate(resolve));
    await flushWriteQueueForTests();

    const active = await shouldActivateBudgetGovernor(settings);
    assert.equal(active, true);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("buildGovernorAlertPayload returns user-facing message", () => {
  const payload = buildGovernorAlertPayload();
  assert.equal(payload.message, GOVERNOR_ALERT_MESSAGE);
  assert.equal(payload.governorActive, true);
});
