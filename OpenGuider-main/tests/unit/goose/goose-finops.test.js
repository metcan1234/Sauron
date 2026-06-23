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

test("goose operation prefix is stable for usage logs", () => {
  assert.equal(GOOSE_OPERATION_PREFIX, "goose-session-");
});
