const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { buildPreCallAlert, evaluateBudgetState } = require("../../src/sauron/finops/budget-alert");
const { BudgetExceededError, configureFinOpsContext, prepareLlmCall } = require("../../src/sauron/finops/llm-tracker");
const { trackCall, resetWriteQueueForTests, flushWriteQueueForTests } = require("../../src/sauron/finops/usage-tracker");

test("buildPreCallAlert sets blocked when hard budget enabled and exhausted", () => {
  const state = evaluateBudgetState({ finopsTotalBudgetTl: 100 }, 120);
  const alert = buildPreCallAlert(state, { finopsHardBudgetEnabled: true });
  assert.ok(alert);
  assert.equal(alert.blocked, true);
  assert.match(alert.message, /engellendi/i);
});

test("buildPreCallAlert does not block when hard budget disabled", () => {
  const state = evaluateBudgetState({ finopsTotalBudgetTl: 100 }, 120);
  const alert = buildPreCallAlert(state, { finopsHardBudgetEnabled: false });
  assert.ok(alert);
  assert.equal(alert.blocked, false);
});

test("prepareLlmCall throws BudgetExceededError when hard budget blocks", async () => {
  resetWriteQueueForTests();
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "finops-hard-budget-"));
  const settings = {
    finopsTotalBudgetTl: 50,
    finopsHardBudgetEnabled: true,
    workspacePath: workspace,
  };

  trackCall({
    provider: "openai",
    model: "gpt-4o-mini",
    promptTokens: 1000,
    completionTokens: 500,
    costTl: 75,
    operation: "chat",
    timestamp: new Date().toISOString(),
  }, settings);

  await new Promise((resolve) => setImmediate(resolve));
  await flushWriteQueueForTests();

  configureFinOpsContext({
    getSettings: () => settings,
    persistSettings: async () => {},
    getWindows: () => [],
  });

  try {
    await assert.rejects(
      () => prepareLlmCall(settings, { operation: "chat" }),
      (error) => error instanceof BudgetExceededError,
    );
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
