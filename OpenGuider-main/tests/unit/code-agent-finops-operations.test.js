const test = require("node:test");
const assert = require("node:assert/strict");
const { ECONOMY_VISION_OPERATIONS } = require("../../src/sauron/finops/agent-matrix");

const CODE_ECONOMY_OPS = [
  "code-grep-context",
  "code-read-summarize",
  "code-agent-summarize",
  "code-agent-plan",
];

test("code agent economy operations are registered in ECONOMY_VISION_OPERATIONS", () => {
  for (const op of CODE_ECONOMY_OPS) {
    assert.equal(ECONOMY_VISION_OPERATIONS.has(op), true, `missing ${op}`);
  }
});

test("code-agent-act is not in economy set (complexity routing applies)", () => {
  assert.equal(ECONOMY_VISION_OPERATIONS.has("code-agent-act"), false);
});
