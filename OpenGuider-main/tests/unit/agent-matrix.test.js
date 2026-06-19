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
  assert.equal(low.providerId, "deepseek");
  assert.equal(low.modelId, "deepseek-chat");

  const medium = resolveAgentForCline("medium", baseSettings);
  assert.equal(medium.providerId, "gemini");
  assert.equal(medium.modelId, "gemini-2.5-flash");

  const high = resolveAgentForCline("high", baseSettings);
  assert.equal(high.providerId, "openai");
  assert.equal(high.modelId, "gpt-4o-mini");
});

test("resolveAgentForCline downgrades one tier when requested", () => {
  const selection = resolveAgentForCline("high", baseSettings, { downgradeOneTier: true });
  assert.equal(selection.providerId, "gemini");
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
});
