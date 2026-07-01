const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

const { resolveWireRecipePointer, loadWireRecipe, listWireRecipeFiles } = require("../../src/sauron/gamedev-wire-recipes");
const { ensureFunplayAutostartConfig, ensureUnityAutostartConfig } = require("../../src/sauron/gamedev-mcp-autostart");
const { captureUnrealProjectSnapshot } = require("../../src/sauron/gamedev-unreal-scene-cache");
const { buildProgressFromBootstrap } = require("../../src/sauron/gamedev-setup-orchestrator");
const { summarizeGamedevLedger, appendGamedevLedgerEvent } = require("../../src/sauron/gamedev-finops-ledger");

test("resolveWireRecipePointer finds unreal empty phase1", () => {
  const id = resolveWireRecipePointer("empty", 1, "unreal");
  assert.equal(id, "empty-phase1");
  const recipe = loadWireRecipe(id, "unreal");
  assert.equal(recipe.engine, "unreal");
});

test("listWireRecipeFiles includes unity and unreal recipes", () => {
  const count = listWireRecipeFiles().length;
  assert.ok(count >= 27);
});

test("autostart config writers create marker files", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-autostart-"));
  fs.mkdirSync(path.join(tmp, "Assets"));
  fs.mkdirSync(path.join(tmp, "Saved"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "Game.uproject"), "{}", "utf8");

  const unityMarker = ensureUnityAutostartConfig(tmp);
  assert.equal(fs.existsSync(unityMarker), true);

  const funplay = ensureFunplayAutostartConfig(tmp);
  assert.equal(fs.existsSync(funplay.settingsPath), true);
  assert.equal(fs.existsSync(funplay.sauronMarker), true);
});

test("captureUnrealProjectSnapshot writes cache", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-ue-snap-"));
  fs.writeFileSync(path.join(tmp, "Demo.uproject"), "{}", "utf8");
  const result = captureUnrealProjectSnapshot(tmp);
  assert.equal(result.ok, true);
  assert.equal(fs.existsSync(path.join(tmp, ".sauron", "gamedev-unreal-scene-cache.json")), true);
});

test("buildProgressFromBootstrap exposes ui percent", () => {
  const ui = buildProgressFromBootstrap({
    ok: true,
    engine: "unreal",
    bridge: { ok: false },
    steps: [{ id: "engine-compat", ok: true, message: "ok" }],
  });
  assert.equal(ui.engine, "unreal");
  assert.ok(typeof ui.percent === "number");
});

test("summarizeGamedevLedger groups sessions by engine", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-ledger-"));
  appendGamedevLedgerEvent(tmp, { type: "session-start", engine: "unity", handoffId: "a" });
  appendGamedevLedgerEvent(tmp, { type: "session-start", engine: "unreal", handoffId: "b" });
  const summary = summarizeGamedevLedger(tmp);
  assert.equal(summary.byEngine.unity, 1);
  assert.equal(summary.byEngine.unreal, 1);
});
