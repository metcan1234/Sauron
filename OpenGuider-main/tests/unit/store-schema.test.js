const test = require("node:test");
const assert = require("node:assert/strict");

const { schema } = require("../../src/store");

test("store schema defaults aware assistance to disabled", () => {
  assert.ok(schema.awareAssistanceEnabled);
  assert.equal(schema.awareAssistanceEnabled.type, "boolean");
  assert.equal(schema.awareAssistanceEnabled.default, false);
});

test("store schema includes finops budget defaults", () => {
  assert.equal(schema.finopsTotalBudgetTl.default, 0);
  assert.equal(schema.finopsUsdToTl.default, 34.5);
  assert.equal(schema.finopsDefaultPricePerMillionTl.default, 50);
  assert.equal(schema.finopsLastAlertDate.default, "");
  assert.deepEqual(schema.finopsModelPriceOverrides.default, {});
  assert.deepEqual(schema.finopsProviderPriceOverrides.default, {});
  assert.deepEqual(schema.finopsDiscoveredModels.default, {});
});

test("store schema includes cost optimizer defaults", () => {
  assert.equal(schema.finopsCostOptimizerEnabled.default, true);
  assert.equal(schema.finopsCostOptimizerMode.default, "balanced");
  assert.equal(schema.finopsCoreModelTier.default, "economy");
  assert.equal(schema.finopsHandoffMaxChars.default, 4000);
  assert.equal(schema.finopsHandoffIncludeTranscript.default, false);
  assert.equal(schema.finopsDailyBudgetTl.default, 0);
  assert.deepEqual(schema.finopsOptimizerModels.default, {});
});

test("store schema includes finops ultra defaults", () => {
  assert.equal(schema.finopsDeltaHandoffEnabled.default, true);
  assert.equal(schema.finopsClarifySkipEnabled.default, true);
  assert.equal(schema.finopsClineOllamaForLow.default, false);
  assert.equal(schema.finopsPanelContextMessages.default, 20);
  assert.equal(schema.finopsMemoryCompressThreshold.default, 40);
  assert.equal(schema.finopsMemoryCompressBatch.default, 20);
  assert.deepEqual(schema.finopsPresetBackup.default, {});
});

test("store schema includes goose defaults", () => {
  assert.equal(schema.gooseEnabled.default, true);
  assert.equal(schema.gooseBinaryPath.default, "");
  assert.equal(schema.gooseDefaultMode.default, "balanced");
  assert.equal(schema.gooseDailyBudgetTl.default, 0);
  assert.equal(schema.gooseAutoMode.default, true);
  assert.equal(schema.gooseBudgetAutoDowngrade.default, false);
  assert.equal(schema.gooseBudgetWarnAt.default, 0.8);
  assert.equal(schema.gooseFinopsShareGlobalBudget.default, true);
  assert.equal(schema.gooseShowModeHint.default, true);
});
