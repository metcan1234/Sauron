const test = require("node:test");
const assert = require("node:assert/strict");

const { estimateTokens, resolveTokenCounts } = require("../../src/sauron/finops/token-counter");

test("estimateTokens uses word count times 1.3", () => {
  assert.equal(estimateTokens("one two three four"), Math.ceil(4 * 1.3));
  assert.equal(estimateTokens(""), 0);
});

test("resolveTokenCounts prefers provider usage metadata", () => {
  const counts = resolveTokenCounts({
    promptText: "hello world",
    completionText: "response text here",
    providerUsage: { prompt_tokens: 100, completion_tokens: 25 },
  });
  assert.deepEqual(counts, { promptTokens: 100, completionTokens: 25 });
});

test("resolveTokenCounts falls back to estimation", () => {
  const counts = resolveTokenCounts({
    promptText: "one two",
    completionText: "three four five",
  });
  assert.equal(counts.promptTokens, Math.ceil(2 * 1.3));
  assert.equal(counts.completionTokens, Math.ceil(3 * 1.3));
});
