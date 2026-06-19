const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  buildFinOpsConfigFromSettings,
  syncFinOpsConfigToWorkspace,
  readFinOpsWorkspaceConfig,
} = require("../../src/sauron/finops/workspace-config");

test("buildFinOpsConfigFromSettings uses store finopsUsdToTl", () => {
  const config = buildFinOpsConfigFromSettings({ finopsUsdToTl: 42.5 });
  assert.equal(config.finopsUsdToTl, 42.5);
  assert.equal(config.enabled, true);
});

test("buildFinOpsConfigFromSettings includes costOptimizer block", () => {
  const config = buildFinOpsConfigFromSettings({
    finopsCostOptimizerEnabled: true,
    finopsCoreModelTier: "standard",
    finopsHandoffMaxChars: 2500,
    finopsOptimizerModels: {
      economy: { providerId: "openrouter", modelId: "google/gemini-2.0-flash-lite" },
    },
  });

  assert.ok(config.costOptimizer);
  assert.equal(config.costOptimizer.enabled, true);
  assert.equal(config.costOptimizer.coreModelTier, "standard");
  assert.equal(config.costOptimizer.routing.handoffMaxChars, 2500);
  assert.equal(config.costOptimizer.models.economy.modelId, "google/gemini-2.0-flash-lite");
});

test("syncFinOpsConfigToWorkspace writes finops-config.json", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "finops-config-"));
  const settings = {
    workspacePath: tempRoot,
    finopsUsdToTl: 36,
    finopsCostOptimizerEnabled: true,
  };

  const result = await syncFinOpsConfigToWorkspace(settings);
  assert.equal(result.ok, true);

  const saved = await readFinOpsWorkspaceConfig(tempRoot);
  assert.equal(saved.finopsUsdToTl, 36);
  assert.equal(saved.enabled, true);
  assert.equal(saved.costOptimizer.enabled, true);

  fs.rmSync(tempRoot, { recursive: true, force: true });
});
