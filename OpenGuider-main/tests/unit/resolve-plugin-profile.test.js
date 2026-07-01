const test = require("node:test");
const assert = require("node:assert/strict");
const {
  resolvePluginProfile,
  scoreWebIntent,
  scoreGameIntent,
} = require("../../src/routing/resolve-plugin-profile");

test("scoreWebIntent detects build profile", () => {
  const result = scoreWebIntent("kurumsal web sitesi yapacağım");
  assert.equal(result.profile, "web");
  assert.ok(result.score > 0.5);
});

test("scoreGameIntent detects game profile", () => {
  const result = scoreGameIntent("unity ile multiplayer oyun yap");
  assert.equal(result.profile, "game");
  assert.ok(result.score > 0.5);
});

test("resolvePluginProfile switches to web from message", () => {
  const result = resolvePluginProfile({
    text: "react ile web sitesi yapacağım",
    currentProfile: "general",
    pluginProfileMode: "auto",
  });
  assert.equal(result.profile, "web");
  assert.equal(result.switched, true);
});

test("resolvePluginProfile respects manual mode for messages", () => {
  const result = resolvePluginProfile({
    text: "unity oyun yap",
    currentProfile: "web",
    pluginProfileMode: "manual",
    source: "message",
  });
  assert.equal(result.profile, "web");
  assert.equal(result.switched, false);
  assert.equal(result.reason, "manual_mode");
});

test("resolvePluginProfile honors forced channel profile", () => {
  const result = resolvePluginProfile({
    source: "channel",
    channel: "gamedev",
    currentProfile: "web",
    pluginProfileMode: "manual",
  });
  assert.equal(result.profile, "game");
  assert.equal(result.switched, true);
});

test("resolvePluginProfile applies cooldown for weak switches", () => {
  const result = resolvePluginProfile({
    text: "kod",
    currentProfile: "web",
    pluginProfileMode: "auto",
    lastSwitchAt: new Date().toISOString(),
  });
  assert.equal(result.switched, false);
});
