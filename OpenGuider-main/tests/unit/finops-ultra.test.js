const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  tokenOverlapRatio,
  shouldUseDeltaHandoff,
  updateHandoffContextCache,
  readHandoffContextCache,
} = require("../../src/sauron/handoff-context-cache");
const { shouldSkipClarify } = require("../../src/sauron/handoff-task-clarify");
const { resolveAgentForCline } = require("../../src/sauron/finops/agent-matrix");
const {
  resolveGovernorTier,
  shouldActivateBudgetGovernor,
} = require("../../src/sauron/finops/daily-budget-governor");
const {
  getCachedLlmResponse,
  setCachedLlmResponse,
  clearLlmResponseCache,
} = require("../../src/sauron/finops/llm-response-cache");
const {
  estimateHandoffPayloadChars,
  compareHandoffPayloadSize,
} = require("../../src/sauron/finops/finops-metrics");
const { flushWriteQueueForTests, trackCall } = require("../../src/sauron/finops/usage-tracker");

const baseSettings = {
  finopsCostOptimizerEnabled: true,
  geminiApiKey: "gemini-key",
  deepseekApiKey: "deepseek-key",
  openaiApiKey: "openai-key",
};

test("tokenOverlapRatio detects similar goals", () => {
  const ratio = tokenOverlapRatio("fix login button bug", "fix login button issue");
  assert.ok(ratio >= 0.7);
});

test("shouldUseDeltaHandoff requires prior cache and similar goal", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "finops-ultra-"));
  try {
    updateHandoffContextCache(workspace, {
      goal: "fix login button",
      treeHint: "Workspace snapshot:\nsrc/",
    });
    assert.equal(
      shouldUseDeltaHandoff(baseSettings, workspace, "fix login button bug"),
      true,
    );
    assert.equal(
      shouldUseDeltaHandoff(baseSettings, workspace, "migrate database schema"),
      false,
    );
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("shouldUseDeltaHandoff disabled when finopsDeltaHandoffEnabled is false", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "finops-ultra-off-"));
  try {
    updateHandoffContextCache(workspace, {
      goal: "fix login",
      treeHint: "Workspace snapshot:\nsrc/",
    });
    assert.equal(
      shouldUseDeltaHandoff({
        ...baseSettings,
        finopsDeltaHandoffEnabled: false,
        tokenUltraUseDeltaHandoff: false,
      }, workspace, "fix login bug"),
      false,
    );
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("shouldSkipClarify skips short action messages", () => {
  assert.equal(shouldSkipClarify("fix typo in header", baseSettings), true);
  assert.equal(shouldSkipClarify("please review architecture migration plan for auth", baseSettings), false);
});

test("resolveAgentForCline economy mode routes high to deepseek", () => {
  const selection = resolveAgentForCline("high", {
    ...baseSettings,
    finopsCostOptimizerMode: "economy",
  });
  assert.equal(selection.providerId, "deepseek");
  assert.equal(selection.reason, "economy-mode-high-to-deepseek");
});

test("resolveAgentForCline ollama for low when enabled", () => {
  const selection = resolveAgentForCline("low", {
    ...baseSettings,
    finopsClineOllamaForLow: true,
    ollamaUrl: "http://localhost:11434",
    ollamaModelCustom: "qwen2.5-coder:7b",
  });
  assert.equal(selection.providerId, "ollama");
  assert.equal(selection.reason, "cline-ollama-low");
});

test("resolveGovernorTier returns hard when spend exceeds budget", async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "governor-tier-"));
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
      costTl: 12,
      operation: "chat",
      timestamp: new Date().toISOString(),
    }, settings);
    await new Promise((resolve) => setImmediate(resolve));
    await flushWriteQueueForTests();

    const tier = await resolveGovernorTier(settings);
    assert.equal(tier.level, "hard");
    assert.ok(tier.spendRatio >= 1);
    const active = await shouldActivateBudgetGovernor(settings);
    assert.equal(active, true);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("llm response cache stores and returns clarify responses", () => {
  clearLlmResponseCache();
  setCachedLlmResponse("handoff-task-clarify", "prompt", "summary");
  assert.equal(getCachedLlmResponse("handoff-task-clarify", "prompt"), "summary");
  assert.equal(getCachedLlmResponse("chat", "prompt"), null);
});

test("compareHandoffPayloadSize reports savings", () => {
  const before = { taskSummary: "x".repeat(1000), goal: "goal" };
  const after = { taskSummary: "x".repeat(400), goal: "goal" };
  const result = compareHandoffPayloadSize(before, after);
  assert.equal(result.before, estimateHandoffPayloadChars(before));
  assert.ok(result.saved >= 600);
  assert.ok(result.savingsRatio > 0.5);
});

test("readHandoffContextCache returns null for missing workspace", () => {
  assert.equal(readHandoffContextCache(""), null);
});
