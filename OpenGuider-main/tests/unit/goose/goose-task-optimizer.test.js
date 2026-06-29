const test = require("node:test");
const assert = require("node:assert/strict");

const {
  optimizeGooseTaskText,
  buildModeSystemInstructions,
  getWorkspaceHintLine,
} = require("../../../src/sauron/goose-task-optimizer");

test("optimizeGooseTaskText trims whitespace and preserves short tasks", () => {
  const result = optimizeGooseTaskText("  dosyayı   aç  ");
  assert.equal(result.text, "dosyayı aç");
  assert.equal(result.truncated, false);
  assert.equal(result.wordCount, 2);
});

test("optimizeGooseTaskText truncates long tasks at word boundary", () => {
  const longTask = `${"word ".repeat(200)}end`;
  const result = optimizeGooseTaskText(longTask, { maxChars: 50 });
  assert.ok(result.text.length <= 50);
  assert.equal(result.truncated, true);
});

test("getWorkspaceHintLine uses leaf folder name", () => {
  const hint = getWorkspaceHintLine("C:\\Users\\Can\\Projects\\OpenGuider-main");
  assert.match(hint, /OpenGuider-main/);
});

test("buildModeSystemInstructions appends mode suffix and respects char limit", () => {
  const base = "# Base rules\n- keep short";
  const built = buildModeSystemInstructions(base, "economy", "C:\\proj\\demo");
  assert.match(built, /Economy Modu/);
  assert.match(built, /demo/);
  assert.ok(built.length <= 2000);
});
