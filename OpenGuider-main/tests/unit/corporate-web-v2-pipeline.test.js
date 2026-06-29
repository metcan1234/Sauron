const test = require("node:test");
const assert = require("node:assert/strict");

const { getPipeline, PIPELINE_REGISTRY } = require("../../src/sauron/build-pipeline/pipeline-registry");

test("corporate-web-v2 pipeline exists with five phases", () => {
  const pipeline = getPipeline("corporate-web-v2");
  assert.ok(pipeline);
  assert.equal(pipeline.id, "corporate-web-v2");
  assert.equal(pipeline.phases.length, 5);
  assert.equal(pipeline.projectType, "corporate-web");
});

test("corporate-web-v1 pipeline is preserved", () => {
  assert.ok(PIPELINE_REGISTRY["corporate-web-v1"]);
  assert.equal(PIPELINE_REGISTRY["corporate-web-v1"].phases.length, 4);
});
