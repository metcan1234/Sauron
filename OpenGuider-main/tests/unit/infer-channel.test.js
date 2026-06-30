const test = require("node:test");
const assert = require("node:assert/strict");
const { inferChannel } = require("../../src/sauron/finops/tiktoken-estimator");

test("inferChannel maps workspace handoff operations", () => {
  assert.equal(inferChannel({ operation: "workspace-handoff" }), "workspace");
  assert.equal(inferChannel({ operation: "scaffold-web-project" }), "workspace");
  assert.equal(inferChannel({ operation: "build-pipeline-start" }), "workspace");
});

test("inferChannel respects explicit channel tag", () => {
  assert.equal(inferChannel({ channel: "goose", operation: "chat" }), "goose");
});
