const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getGooseModeProfile,
  applyModeProfileToProviderConfig,
} = require("../../../src/sauron/goose-mode-profiles");

test("getGooseModeProfile returns economy compaction env", () => {
  const profile = getGooseModeProfile("economy");
  assert.equal(profile.envOverrides.GOOSE_CLI_MIN_PRIORITY, "0.5");
  assert.equal(profile.envOverrides.GOOSE_AUTO_COMPACT_THRESHOLD, "0.55");
  assert.equal(profile.envOverrides.GOOSE_CONTEXT_STRATEGY, "summarize");
  assert.equal(profile.maxTurns, 40);
  assert.equal(profile.systemCharLimit, 2000);
});

test("getGooseModeProfile falls back to balanced for unknown mode", () => {
  const profile = getGooseModeProfile("unknown");
  assert.equal(profile.mode, "balanced");
  assert.equal(profile.maxTurns, 60);
});

test("applyModeProfileToProviderConfig merges env and sets GOOSE_MAX_TURNS", () => {
  const result = applyModeProfileToProviderConfig("premium", {
    provider: "openai",
    model: "gpt-4o-mini",
    envOverrides: { OPENAI_API_KEY: "sk-test" },
  });
  assert.equal(result.envOverrides.OPENAI_API_KEY, "sk-test");
  assert.equal(result.envOverrides.GOOSE_MAX_TURNS, "100");
  assert.equal(result.envOverrides.GOOSE_AUTO_COMPACT_THRESHOLD, "0.75");
  assert.equal(result.modeProfile.systemCharLimit, 8000);
});
