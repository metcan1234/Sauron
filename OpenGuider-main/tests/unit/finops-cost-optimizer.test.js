const test = require("node:test");
const assert = require("node:assert/strict");

const {
  mergeCostOptimizerConfig,
  resolveCoreModelOverlay,
  computeComplexityHint,
  mapProviderIdToCore,
} = require("../../src/sauron/finops/cost-optimizer-config");

test("mergeCostOptimizerConfig applies store overrides", () => {
  const config = mergeCostOptimizerConfig({
    finopsCostOptimizerEnabled: false,
    finopsCostOptimizerMode: "performance",
    finopsCoreModelTier: "premium",
    finopsHandoffMaxChars: 3000,
    finopsHandoffIncludeTranscript: true,
    finopsDailyBudgetTl: 100,
  });

  assert.equal(config.enabled, false);
  assert.equal(config.mode, "performance");
  assert.equal(config.coreModelTier, "premium");
  assert.equal(config.routing.handoffMaxChars, 3000);
  assert.equal(config.routing.includeTranscript, true);
  assert.equal(config.budgetGovernor.dailyBudgetTl, 100);
});

test("resolveCoreModelOverlay maps openrouter economy tier to core settings", () => {
  const overlay = resolveCoreModelOverlay({
    finopsCostOptimizerEnabled: true,
    finopsCoreModelTier: "economy",
    finopsOptimizerModels: {
      economy: { providerId: "openrouter", modelId: "deepseek/deepseek-chat" },
    },
  });

  assert.ok(overlay);
  assert.equal(overlay.aiProvider, "openrouter");
  assert.equal(overlay.aiModel, "deepseek/deepseek-chat");
  assert.equal(overlay.coreModelTier, "economy");
});

test("resolveCoreModelOverlay returns null when optimizer disabled", () => {
  const overlay = resolveCoreModelOverlay({ finopsCostOptimizerEnabled: false });
  assert.equal(overlay, null);
});

test("mapProviderIdToCore normalizes provider aliases", () => {
  assert.equal(mapProviderIdToCore("openrouter"), "openrouter");
  assert.equal(mapProviderIdToCore("ollama"), "ollama");
  assert.equal(mapProviderIdToCore("deepseek"), "deepseek");
});

test("computeComplexityHint escalates for architecture keywords", () => {
  assert.equal(computeComplexityHint("please refactor the architecture"), "high");
  assert.equal(computeComplexityHint("fix typo"), "low");
});
