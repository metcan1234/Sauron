const test = require("node:test");
const assert = require("node:assert/strict");
const {
  resolveChannelMaxChars,
  resolveGamedevTaskMaxChars,
  resolveWorkspaceHandoffMaxChars,
  buildChannelLimitsPayload,
} = require("../../src/sauron/token-ultra/channel-limit-resolver");

test("resolveChannelMaxChars uses channel defaults", () => {
  assert.equal(resolveChannelMaxChars({}, "workspace"), 4500);
  assert.equal(resolveChannelMaxChars({}, "goose"), 4000);
  assert.equal(resolveChannelMaxChars({}, "gamedev"), 4500);
});

test("resolveChannelMaxChars falls back to global max", () => {
  assert.equal(resolveChannelMaxChars({ tokenUltraMaxHandoffChars: 7000 }, "workspace"), 4500);
  assert.equal(resolveChannelMaxChars({ tokenUltraMaxHandoffChars: 7000 }, "unknown"), 7000);
});

test("resolveChannelMaxChars respects explicit settings", () => {
  assert.equal(resolveChannelMaxChars({ tokenUltraGooseMaxChars: 2500 }, "goose"), 2500);
});

test("resolveGamedevTaskMaxChars defaults to 600", () => {
  assert.equal(resolveGamedevTaskMaxChars({}), 600);
  assert.equal(resolveGamedevTaskMaxChars({ tokenUltraGamedevTaskMaxChars: 500 }), 500);
});

test("resolveWorkspaceHandoffMaxChars uses min of finops and workspace limits", () => {
  assert.equal(
    resolveWorkspaceHandoffMaxChars({
      finopsHandoffMaxChars: 4000,
      tokenUltraWorkspaceMaxChars: 4500,
    }),
    4000,
  );
  assert.equal(
    resolveWorkspaceHandoffMaxChars({
      finopsHandoffMaxChars: 6000,
      tokenUltraWorkspaceMaxChars: 3500,
    }),
    3500,
  );
});

test("buildChannelLimitsPayload includes all channels", () => {
  const payload = buildChannelLimitsPayload({
    tokenUltraWorkspaceMaxChars: 3000,
    tokenUltraGooseMaxChars: 2800,
    tokenUltraGamedevMaxChars: 3200,
    tokenUltraGamedevTaskMaxChars: 500,
    gamedevBriefMaxChars: 6000,
    tokenUltraMaxHandoffChars: 5500,
  });
  assert.equal(payload.workspace, 3000);
  assert.equal(payload.goose, 2800);
  assert.equal(payload.gamedev, 3200);
  assert.equal(payload.gamedevTask, 500);
  assert.equal(payload.gamedevBrief, 6000);
  assert.equal(payload.global, 5500);
});
