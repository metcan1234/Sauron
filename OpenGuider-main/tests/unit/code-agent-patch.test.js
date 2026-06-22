const test = require("node:test");
const assert = require("node:assert/strict");
const { applySearchReplace, buildUnifiedDiff, countChangedLines } = require("../../src/code-agent/patch-engine");

test("applySearchReplace replaces first occurrence", () => {
  const result = applySearchReplace("hello world", "world", "Sauron");
  assert.equal(result, "hello Sauron");
});

test("applySearchReplace throws when search not found", () => {
  assert.throws(() => applySearchReplace("abc", "xyz", "q"), /not found/i);
});

test("buildUnifiedDiff includes file path", () => {
  const diff = buildUnifiedDiff("foo.js", "a", "b");
  assert.match(diff, /foo\.js/);
  assert.match(diff, /\+b/);
});

test("countChangedLines counts differences", () => {
  assert.equal(countChangedLines("a\nb", "a\nc"), 1);
});
