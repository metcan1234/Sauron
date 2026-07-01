const test = require("node:test");
const assert = require("node:assert/strict");
const { buildPluginProfileState } = require("../../src/routing/effective-settings");
const { buildProfileNotification } = require("../../src/routing/plugin-profiles");

test("buildPluginProfileState returns effective settings and metadata", () => {
  const state = buildPluginProfileState({
    smartPluginProfileEnabled: true,
    activePluginProfile: "web",
    pluginProfileMode: "auto",
    pluginProfileNotifyEnabled: true,
    webStudioEnabled: true,
    gamedevBridgeMonitorEnabled: true,
  });
  assert.equal(state.profile, "web");
  assert.equal(state.label, "Web");
  assert.equal(state.effectiveSettings.gamedevBridgeMonitorEnabled, false);
  assert.equal(state.effectiveSettings.webStudioEnabled, true);
});

test("buildProfileNotification includes profile label", () => {
  const message = buildProfileNotification("game");
  assert.match(message, /Oyun profili aktif/);
});
