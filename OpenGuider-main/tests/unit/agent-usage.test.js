const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  resolveAgentIdFromEntry,
  summarizeByAgent,
  buildAgentWalletSummary,
  isAgentWalletAvailable,
  buildExhaustedAgentAlerts,
  areAllCloudAgentsWalletExhausted,
} = require("../../src/sauron/finops/agent-usage");
const { flushWriteQueueForTests, trackCall } = require("../../src/sauron/finops/usage-tracker");

test("resolveAgentIdFromEntry maps cline model ids to agents", () => {
  assert.equal(resolveAgentIdFromEntry({ provider: "cline", model: "deepseek-chat" }), "deepseek");
  assert.equal(resolveAgentIdFromEntry({ provider: "cline", model: "gemini-2.5-flash" }), "gemini");
  assert.equal(resolveAgentIdFromEntry({ provider: "gemini", model: "gemini-2.5-flash-lite" }), "gemini");
});

test("summarizeByAgent aggregates spend and tokens", () => {
  const entries = [
    {
      provider: "gemini",
      model: "gemini-2.5-flash-lite",
      promptTokens: 100,
      completionTokens: 50,
      costTl: 1.5,
      operation: "chat",
    },
    {
      provider: "cline",
      model: "deepseek-chat",
      promptTokens: 200,
      completionTokens: 80,
      costUsd: 0.25,
      costTl: 8.625,
      operation: "cline-task-readonly",
    },
    {
      provider: "sauron",
      model: "high",
      promptTokens: 0,
      completionTokens: 0,
      costTl: 0,
      operation: "cost-optimizer-hint",
    },
  ];

  const byAgent = summarizeByAgent(entries, { finopsUsdToTl: 34.5 });
  assert.equal(byAgent.gemini.entryCount, 1);
  assert.equal(byAgent.gemini.promptTokens, 100);
  assert.equal(byAgent.deepseek.entryCount, 1);
  assert.equal(byAgent.deepseek.spentUsd, 0.25);
});

test("buildAgentWalletSummary computes remaining credit", () => {
  const settings = {
    finopsUsdToTl: 34.5,
    finopsAgentWallets: {
      gemini: { limitUsd: 7, topUpUsd: 1 },
      deepseek: { limitUsd: 0, topUpUsd: 0 },
      openai: { limitUsd: 0, topUpUsd: 0 },
      ollama: { limitUsd: 0, topUpUsd: 0 },
    },
  };
  const byAgent = {
    gemini: { spentUsd: 4.5, spentTl: 0, promptTokens: 0, completionTokens: 0, entryCount: 1 },
    deepseek: { spentUsd: 0, spentTl: 0, promptTokens: 0, completionTokens: 0, entryCount: 0 },
    openai: { spentUsd: 0, spentTl: 0, promptTokens: 0, completionTokens: 0, entryCount: 0 },
    ollama: { spentUsd: 0, spentTl: 0, promptTokens: 0, completionTokens: 0, entryCount: 0 },
  };

  const wallets = buildAgentWalletSummary(settings, byAgent);
  assert.equal(wallets.gemini.totalCreditUsd, 8);
  assert.equal(wallets.gemini.remainingUsd, 3.5);
  assert.equal(wallets.gemini.unlimited, false);
  assert.equal(wallets.deepseek.unlimited, true);
});

test("isAgentWalletAvailable respects unlimited and remaining balance", () => {
  assert.equal(isAgentWalletAvailable("deepseek", { deepseek: { unlimited: true } }), true);
  assert.equal(isAgentWalletAvailable("deepseek", { deepseek: { unlimited: false, remainingUsd: 0.5 } }), true);
  assert.equal(isAgentWalletAvailable("deepseek", { deepseek: { unlimited: false, remainingUsd: 0 } }), false);
});

test("buildExhaustedAgentAlerts lists depleted wallets", () => {
  const alerts = buildExhaustedAgentAlerts({
    deepseek: { unlimited: false, remainingUsd: 0 },
    gemini: { unlimited: false, remainingUsd: 2 },
  });
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].agentId, "deepseek");
  assert.equal(alerts[0].exhausted, true);
});

test("areAllCloudAgentsWalletExhausted detects when every cloud wallet is depleted", () => {
  const exhausted = {
    gemini: { unlimited: false, remainingUsd: 0 },
    deepseek: { unlimited: false, remainingUsd: 0 },
    openai: { unlimited: false, remainingUsd: 0 },
    ollama: { unlimited: true },
  };
  assert.equal(areAllCloudAgentsWalletExhausted(exhausted), true);
  assert.equal(areAllCloudAgentsWalletExhausted({
    ...exhausted,
    openai: { unlimited: false, remainingUsd: 1 },
  }), false);
});

test("summarizeByAgent reads workspace log entries", async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "agent-usage-"));
  const settings = { workspacePath: workspace, finopsUsdToTl: 10 };
  try {
    trackCall({
      provider: "openai",
      model: "gpt-4o-mini",
      promptTokens: 10,
      completionTokens: 5,
      costTl: 2,
      operation: "chat",
      timestamp: new Date().toISOString(),
    }, settings);
    await new Promise((resolve) => setImmediate(resolve));
    await flushWriteQueueForTests();

    const { readUsageEntries, resolveUsageLogPath } = require("../../src/sauron/finops/usage-tracker");
    const entries = await readUsageEntries(resolveUsageLogPath(settings));
    const byAgent = summarizeByAgent(entries, settings);
    assert.equal(byAgent.openai.entryCount, 1);
    assert.equal(byAgent.openai.spentUsd, 0.2);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
