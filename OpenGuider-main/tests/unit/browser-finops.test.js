const test = require("node:test");
const assert = require("node:assert/strict");

const { recordBrowserGoalUsage } = require("../../src/plugins/browser/browser-finops");
const { prepareBrowserPluginLlmConfig } = require("../../src/plugins/browser/llm-config");
const { configureFinOpsContext, BudgetExceededError } = require("../../src/sauron/finops/llm-tracker");

test("recordBrowserGoalUsage skips empty token usage", async () => {
  const result = await recordBrowserGoalUsage({
    settings: { aiProvider: "openai", aiModel: "gpt-4o-mini" },
    sessionId: "sess-1",
    usage: { provider: "openai", model: "gpt-4o-mini", promptTokens: 0, completionTokens: 0 },
  });
  assert.equal(result, null);
});

test("prepareBrowserPluginLlmConfig applies finops overlay for browser-goal", async () => {
  configureFinOpsContext({
    getSettings: () => ({
      aiProvider: "gemini",
      aiModel: "gemini-2.0-flash",
      finopsCostOptimizerEnabled: false,
    }),
    persistSettings: async () => {},
    getWindows: () => [],
  });

  const prepared = await prepareBrowserPluginLlmConfig({
    aiProvider: "gemini",
    aiModel: "gemini-2.0-flash",
    geminiApiKey: "test-key",
    finopsTotalBudgetTl: 0,
  });

  assert.equal(prepared.llmProvider, "gemini");
  assert.ok(prepared.settings);
  assert.equal(typeof prepared.llmApiKey, "string");
});

test("BudgetExceededError is exported for stream handling", () => {
  const error = new BudgetExceededError("blocked", { blocked: true });
  assert.equal(error.name, "BudgetExceededError");
  assert.equal(error.alert.blocked, true);
});
