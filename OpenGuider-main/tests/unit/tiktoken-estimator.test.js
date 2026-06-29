const { test } = require("node:test");
const assert = require("node:assert/strict");
const { estimateTokensLite, inferChannel } = require("../../src/sauron/finops/tiktoken-estimator");

test("estimateTokensLite returns positive count for text", () => {
  const count = estimateTokensLite("hello world from sauron token estimator", "gpt-4o");
  assert.ok(count > 0);
});

test("inferChannel defaults unknown operations to core", () => {
  assert.equal(inferChannel({ operation: "handoff-summary" }), "core");
});

test("inferChannel respects explicit channel tag", () => {
  assert.equal(inferChannel({ operation: "external", channel: "gamedev" }), "gamedev");
});
