const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { ECONOMY_VISION_OPERATIONS } = require("../../src/sauron/finops/agent-matrix");

test("ECONOMY_VISION_OPERATIONS includes handoff-task-clarify", () => {
  assert.ok(ECONOMY_VISION_OPERATIONS.has("handoff-task-clarify"));
});

test("executor-chain locator prompt includes few-shot example", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../../src/agent/executor-chain.js"),
    "utf8",
  );
  assert.match(source, /Example \(visible Save button/);
  assert.match(source, /\[POINT:820,45:Save\]/);
});
