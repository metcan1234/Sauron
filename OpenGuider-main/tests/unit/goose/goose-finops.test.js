const test = require("node:test");
const assert = require("node:assert/strict");

const {
  estimateGooseSessionCostTl,
  GOOSE_OPERATION_PREFIX,
} = require("../../../src/sauron/goose-finops");

test("estimateGooseSessionCostTl returns mode-specific estimates", () => {
  assert.equal(estimateGooseSessionCostTl("economy"), 0);
  assert.equal(estimateGooseSessionCostTl("balanced"), 0.12);
  assert.equal(estimateGooseSessionCostTl("premium"), 0.25);
});

test("estimateGooseSessionCostTl scales with word count for cloud modes", () => {
  const short = estimateGooseSessionCostTl("balanced", { wordCount: 10 });
  const long = estimateGooseSessionCostTl("balanced", { wordCount: 120 });
  assert.ok(long > short);
  assert.equal(short, 0.12);
});

test("goose operation prefix is stable for usage logs", () => {
  assert.equal(GOOSE_OPERATION_PREFIX, "goose-session-");
});
