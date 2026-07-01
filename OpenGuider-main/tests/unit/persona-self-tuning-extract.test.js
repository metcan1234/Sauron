const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  parseSelfTuningExtraction,
  hasSelfTuningContent,
} = require("../../src/session/persona-self-tuning-extract");

describe("persona-self-tuning-extract", () => {
  it("parses luna JSON extraction", () => {
    const parsed = parseSelfTuningExtraction(
      '{"personalitySliders":{"warmth":75},"activeScenarioId":"gece-sohbeti","planNote":"Gece tonu","reason":"yorgun"}',
      "luna",
    );
    assert.equal(parsed.personalitySliders.warmth, 75);
    assert.equal(parsed.activeScenarioId, "gece-sohbeti");
    assert.equal(parsed.planNote, "Gece tonu");
  });

  it("rejects invalid scenario ids", () => {
    const parsed = parseSelfTuningExtraction(
      '{"activeScenarioId":"invalid-scenario"}',
      "luna",
    );
    assert.equal(parsed.activeScenarioId, undefined);
  });

  it("detects self tuning content", () => {
    assert.equal(hasSelfTuningContent({ planNote: "test" }), true);
    assert.equal(hasSelfTuningContent({}), false);
  });
});
