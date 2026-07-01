const test = require("node:test");
const assert = require("node:assert/strict");
const { applyPluginProfileOverlay } = require("../../src/routing/effective-settings");

test("applyPluginProfileOverlay suppresses game features on web profile", () => {
  const base = {
    smartPluginProfileEnabled: true,
    webStudioEnabled: true,
    selfBuildEnabled: true,
    gamedevBridgeMonitorEnabled: true,
    gamedevPlayLoopEnabled: true,
  };
  const result = applyPluginProfileOverlay(base, "web");
  assert.equal(result.settings.webStudioEnabled, true);
  assert.equal(result.settings.gamedevBridgeMonitorEnabled, false);
  assert.equal(result.settings.gamedevPlayLoopEnabled, false);
  assert.equal(base.gamedevBridgeMonitorEnabled, true);
});

test("applyPluginProfileOverlay does not force enable user-disabled web studio", () => {
  const base = {
    smartPluginProfileEnabled: true,
    webStudioEnabled: false,
    gamedevBridgeMonitorEnabled: true,
  };
  const result = applyPluginProfileOverlay(base, "web");
  assert.equal(result.settings.webStudioEnabled, false);
});

test("applyPluginProfileOverlay bypasses when smart profile disabled", () => {
  const base = {
    smartPluginProfileEnabled: false,
    webStudioEnabled: true,
    gamedevBridgeMonitorEnabled: true,
  };
  const result = applyPluginProfileOverlay(base, "game");
  assert.equal(result.settings.gamedevBridgeMonitorEnabled, true);
  assert.equal(result.profile, "general");
});

test("game profile enables scene view overlay", () => {
  const base = { smartPluginProfileEnabled: true, gamedevEnabled: true };
  const result = applyPluginProfileOverlay(base, "game");
  assert.equal(result.settings.gamedevSceneViewEnabled, true);
  assert.equal(result.settings.webStudioEnabled, false);
});
