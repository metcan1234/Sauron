const test = require("node:test");
const assert = require("node:assert/strict");

const { getPipeline, PIPELINE_REGISTRY } = require("../../src/sauron/build-pipeline/pipeline-registry");

test("corporate-web-v3 pipeline exists with six phases", () => {
  const pipeline = getPipeline("corporate-web-v3");
  assert.ok(pipeline);
  assert.equal(pipeline.id, "corporate-web-v3");
  assert.equal(pipeline.phases.length, 6);
  assert.equal(pipeline.phases[2].verification.command, "node scripts/verify-corporate-visual.js");
});

test("corporate-web-v2 pipeline is preserved", () => {
  assert.ok(PIPELINE_REGISTRY["corporate-web-v2"]);
  assert.equal(PIPELINE_REGISTRY["corporate-web-v2"].phases.length, 5);
});
