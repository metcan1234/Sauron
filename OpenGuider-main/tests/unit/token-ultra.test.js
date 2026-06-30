const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  isFinOpsTrackingOnly,
  shouldRestrictModels,
  shouldApplyCostOptimizerRouting,
} = require("../../src/sauron/finops/tracking-mode");
const { applyTokenUltraToHandoff } = require("../../src/sauron/token-ultra");
const { compressHandoffSummary } = require("../../src/sauron/token-ultra/compress-brief");
const { buildSceneDeltaHint } = require("../../src/sauron/gamedev-scene-delta");
const { resolvePreferredEngine } = require("../../src/sauron/gamedev-engine-probe");
const { applyRecipeToTask } = require("../../src/sauron/goose-recipes");
const { getBundledGoosePaths } = require("../../src/sauron/goose-config");

test("tracking-only disables model restrictions when routing is manual", () => {
  assert.equal(isFinOpsTrackingOnly({}), false);
  assert.equal(isFinOpsTrackingOnly({ finopsTrackingOnly: true }), true);
  assert.equal(shouldRestrictModels({}), false);
  assert.equal(shouldApplyCostOptimizerRouting({ finopsTrackingOnly: true }), false);
  assert.equal(shouldApplyCostOptimizerRouting({ agentControlMode: "auto" }), true);
});

test("applyTokenUltraToHandoff adds tokenUltra block", () => {
  const result = applyTokenUltraToHandoff({
    version: 2,
    id: "test-id",
    goal: "Fix login bug",
    taskSummary: "Goal: Fix login bug\n\nPlan steps:\n- inspect auth",
    workspacePath: "",
  }, { tokenUltraEnabled: true });
  assert.equal(result.payload.version, 3);
  assert.ok(result.payload.tokenUltra);
});

test("compressHandoffSummary strips long transcript", () => {
  const input = `Goal: test\nRecent conversation:\n${"x".repeat(2000)}`;
  const out = compressHandoffSummary(input, 500);
  assert.ok(out.savedChars > 0);
  assert.ok(!out.text.includes("Recent conversation:"));
});

test("buildSceneDeltaHint reports unchanged scene", () => {
  const tmp = require("fs").mkdtempSync(require("path").join(require("os").tmpdir(), "sauron-scene-"));
  const snapshot = {
    engine: "unity",
    hierarchy: { rootCount: 2, lastPaths: ["Player", "Camera"] },
    lastGoal: "Add player movement",
  };
  const { persistSceneSnapshot } = require("../../src/sauron/gamedev-scene-delta");
  persistSceneSnapshot(tmp, snapshot);
  const delta = buildSceneDeltaHint(tmp, snapshot, "unity");
  assert.equal(delta.deltaMode, true);
});

test("goose recipes prefix task text", () => {
  const applied = applyRecipeToTask("Fix failing test", "bugfix");
  assert.ok(applied.text.includes("minimal diff"));
  assert.equal(applied.recipe.id, "bugfix");
});

test("bundled goose paths include monorepo locations", () => {
  const paths = getBundledGoosePaths();
  assert.ok(Array.isArray(paths));
  assert.ok(paths.some((entry) => String(entry).includes("goose.exe")));
});

test("resolvePreferredEngine falls back to settings", () => {
  const resolved = resolvePreferredEngine({ gamedevActiveEngine: "unreal" });
  assert.equal(resolved.engine, "unreal");
  assert.equal(resolved.source, "settings");
});
