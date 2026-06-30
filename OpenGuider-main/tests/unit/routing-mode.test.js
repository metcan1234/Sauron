const test = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveAgentControlMode,
  shouldAutoRouteCore,
  shouldAutoRouteCline,
  shouldAutoRouteGoose,
  resolveManualCoreAgent,
  resolveManualClineAgent,
  resolveManualGooseMode,
  applyPanelProviderOverride,
  buildAgentControlPayload,
} = require("../../src/sauron/finops/routing-mode");

const baseSettings = {
  finopsCostOptimizerEnabled: true,
  geminiApiKey: "gemini-key",
  deepseekApiKey: "deepseek-key",
  openaiApiKey: "openai-key",
  ollamaUrl: "http://localhost:11434",
  ollamaModelCustom: "qwen2.5-coder:7b",
};

test("resolveAgentControlMode prefers explicit agentControlMode", () => {
  assert.equal(resolveAgentControlMode({ agentControlMode: "mixed" }), "mixed");
});

test("shouldAutoRouteCore is true in auto mode", () => {
  assert.equal(shouldAutoRouteCore({ ...baseSettings, agentControlMode: "auto" }), true);
});

test("shouldAutoRouteCore is false in manual mode", () => {
  assert.equal(shouldAutoRouteCore({ ...baseSettings, agentControlMode: "manual" }), false);
});

test("mixed mode respects per-channel routing", () => {
  const mixed = {
    ...baseSettings,
    agentControlMode: "mixed",
    coreRoutingMode: "manual",
    clineRoutingMode: "auto",
    gooseRoutingMode: "auto",
  };
  assert.equal(shouldAutoRouteCore(mixed), false);
  assert.equal(shouldAutoRouteCline(mixed), true);
  assert.equal(shouldAutoRouteGoose(mixed), true);
});

test("resolveManualCoreAgent returns ollama overlay", () => {
  const overlay = resolveManualCoreAgent({
    ...baseSettings,
    agentControlMode: "manual",
    coreManualAgent: "ollama",
  });
  assert.equal(overlay.aiProvider, "ollama");
  assert.equal(overlay.reason, "manual-core");
});

test("resolveManualClineAgent returns deepseek by default", () => {
  const selection = resolveManualClineAgent({
    ...baseSettings,
    agentControlMode: "manual",
    clineManualAgent: "deepseek",
  });
  assert.equal(selection.providerId, "deepseek");
  assert.equal(selection.reason, "manual-cline");
});

test("resolveManualGooseMode returns economy for ollama path", () => {
  const goose = resolveManualGooseMode({
    ...baseSettings,
    gooseManualMode: "economy",
  });
  assert.equal(goose.mode, "economy");
  assert.equal(goose.reason, "manual-goose");
});

test("applyPanelProviderOverride switches auto to mixed manual core", () => {
  const next = applyPanelProviderOverride(
    { ...baseSettings, agentControlMode: "auto" },
    "ollama",
  );
  assert.equal(next.agentControlMode, "mixed");
  assert.equal(next.coreRoutingMode, "manual");
  assert.equal(next.coreManualAgent, "ollama");
  assert.equal(next.aiProvider, "ollama");
});

test("buildAgentControlPayload exposes manual agents", () => {
  const payload = buildAgentControlPayload({
    ...baseSettings,
    agentControlMode: "manual",
    coreManualAgent: "gemini",
    clineManualAgent: "ollama",
    gooseManualMode: "economy",
  });
  assert.equal(payload.agentControlMode, "manual");
  assert.equal(payload.manualAgents.cline, "ollama");
  assert.equal(payload.shouldAutoRoute.core, false);
});
