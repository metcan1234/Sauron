const test = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveAgentForCore,
  resolveAgentForCline,
  syncAgentMatrixFromSettings,
  buildAgentMatrixForWorkspace,
  hasAgentCredential,
} = require("../../src/sauron/finops/agent-matrix");

const baseSettings = {
  finopsCostOptimizerEnabled: true,
  geminiApiKey: "gemini-key",
  deepseekApiKey: "deepseek-key",
  openaiApiKey: "openai-key",
  ollamaUrl: "http://localhost:11434",
};

const deepseekExhaustedWallets = {
  deepseek: { unlimited: false, remainingUsd: 0, totalCreditUsd: 5 },
  gemini: { unlimited: false, remainingUsd: 3, totalCreditUsd: 5 },
  openai: { unlimited: true, remainingUsd: null, totalCreditUsd: 0 },
  ollama: { unlimited: true, remainingUsd: null, totalCreditUsd: 0 },
};

test("resolveAgentForCore picks gemini for low complexity", () => {
  const overlay = resolveAgentForCore("chat", "low", baseSettings);
  assert.ok(overlay);
  assert.equal(overlay.aiProvider, "gemini");
  assert.equal(overlay.aiModel, "gemini-2.5-flash-lite");
  assert.equal(overlay.agentId, "gemini");
});

test("resolveAgentForCore picks deepseek for high complexity", () => {
  const overlay = resolveAgentForCore("plan", "high", baseSettings);
  assert.ok(overlay);
  assert.equal(overlay.aiProvider, "deepseek");
  assert.equal(overlay.aiModel, "deepseek-chat");
});

test("resolveAgentForCline maps complexity to agents", () => {
  const low = resolveAgentForCline("low", baseSettings);
  assert.equal(low.providerId, "gemini");
  assert.equal(low.modelId, "gemini-2.5-flash");

  const medium = resolveAgentForCline("medium", baseSettings);
  assert.equal(medium.providerId, "deepseek");
  assert.equal(medium.modelId, "deepseek-chat");

  const high = resolveAgentForCline("high", baseSettings);
  assert.equal(high.providerId, "openai");
  assert.equal(high.modelId, "gpt-4o-mini");
});

test("resolveAgentForCline governor routes high to deepseek", () => {
  const selection = resolveAgentForCline("high", baseSettings, { budgetGovernorActive: true });
  assert.equal(selection.providerId, "deepseek");
  assert.equal(selection.reason, "governor-soft-high-to-deepseek");
});

test("resolveAgentForCline falls back to deepseek without openai key", () => {
  const settings = { ...baseSettings, openaiApiKey: "" };
  const selection = resolveAgentForCline("high", settings);
  assert.equal(selection.providerId, "deepseek");
  assert.equal(selection.reason, "complexity-high-fallback-deepseek");
});

test("resolveAgentForCline skips exhausted deepseek wallet", () => {
  const selection = resolveAgentForCline("medium", baseSettings, {
    agentWallets: deepseekExhaustedWallets,
  });
  assert.equal(selection.providerId, "gemini");
  assert.equal(selection.reason, "wallet-exhausted-fallback-deepseek");
  assert.equal(selection.walletFallbackFrom, "deepseek");
});

test("resolveAgentForCore skips exhausted gemini wallet", () => {
  const agentWallets = {
    gemini: { unlimited: false, remainingUsd: 0, totalCreditUsd: 5 },
    deepseek: { unlimited: false, remainingUsd: 4, totalCreditUsd: 5 },
    openai: { unlimited: true, remainingUsd: null, totalCreditUsd: 0 },
    ollama: { unlimited: true, remainingUsd: null, totalCreditUsd: 0 },
  };
  const overlay = resolveAgentForCore("chat", "low", baseSettings, { agentWallets });
  assert.equal(overlay.agentId, "deepseek");
  assert.equal(overlay.reason, "wallet-exhausted-fallback-gemini");
});

test("buildAgentMatrixForWorkspace marks walletAvailable from summary", () => {
  const matrix = buildAgentMatrixForWorkspace(baseSettings, deepseekExhaustedWallets);
  assert.equal(matrix.agents.find((entry) => entry.id === "deepseek")?.walletAvailable, false);
  assert.equal(matrix.agents.find((entry) => entry.id === "gemini")?.walletAvailable, true);
});

test("syncAgentMatrixFromSettings writes matrix defaults", () => {
  const patch = syncAgentMatrixFromSettings(baseSettings);
  assert.equal(patch.aiProvider, "gemini");
  assert.equal(patch.finopsCostOptimizerEnabled, true);
  assert.equal(patch.finopsOptimizerModels.standard.modelId, "deepseek-chat");
});

test("buildAgentMatrixForWorkspace marks configured agents", () => {
  const matrix = buildAgentMatrixForWorkspace(baseSettings);
  assert.equal(matrix.agents.length, 4);
  assert.equal(matrix.agents.find((a) => a.id === "gemini")?.configured, true);
  assert.equal(hasAgentCredential({ ollamaUrl: "http://localhost:11434", ollamaModelCustom: "qwen2.5-coder:7b" }, "ollama"), true);
  assert.equal(hasAgentCredential({ ollamaUrl: "http://localhost:11434" }, "ollama"), false);
  assert.equal(matrix.routing.cline.low, "gemini");
  assert.equal(matrix.routing.cline.medium, "deepseek");
});
