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

test("buildFinOpsConfigFromSettings uses store finopsUsdToTl", async () => {
  const config = await buildFinOpsConfigFromSettings({ finopsUsdToTl: 42.5 });
  assert.equal(config.finopsUsdToTl, 42.5);
  assert.equal(config.enabled, true);
});

test("buildFinOpsConfigFromSettings includes costOptimizer block", async () => {
  const config = await buildFinOpsConfigFromSettings({
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

test("buildFinOpsConfigFromSettings marks walletAvailable on agents", async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "finops-wallet-config-"));
  const settings = {
    workspacePath: workspace,
    finopsAgentWallets: {
      gemini: { limitUsd: 5, topUpUsd: 0 },
      deepseek: { limitUsd: 0, topUpUsd: 0 },
      openai: { limitUsd: 0, topUpUsd: 0 },
      ollama: { limitUsd: 0, topUpUsd: 0 },
    },
  };

  try {
    const config = await buildFinOpsConfigFromSettings(settings);
    const gemini = config.costOptimizer.agentMatrix.agents.find((entry) => entry.id === "gemini");
    assert.equal(gemini.walletAvailable, true);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
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
