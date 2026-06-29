const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { planPipeline, listPipelines } = require("../../src/sauron/build-pipeline");
const {
  startBuildPipeline,
  advancePipelineAfterComplete,
} = require("../../src/sauron/build-pipeline/pipeline-runner");
const { writePipelineState } = require("../../src/sauron/build-pipeline/pipeline-state");

test("listPipelines includes self-improve and corporate web", () => {
  const pipelines = listPipelines();
  const ids = pipelines.map((p) => p.id);
  assert.ok(ids.includes("self-improve-feature-v1"));
  assert.ok(ids.includes("corporate-web-v1"));
});

test("planPipeline estimates cost per phase", () => {
  const result = planPipeline("bridge-agent-v1", { taskDescription: "Add credential sync test" });
  assert.equal(result.ok, true);
  assert.equal(result.pipeline.totalPhases, 2);
  assert.ok(result.pipeline.totalEstimatedCostTl >= 0);
});

test("advancePipelineAfterComplete writes next phase handoff", async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "pipeline-"));
  const planned = planPipeline("self-improve-feature-v1");
  writePipelineState(workspace, planned.pipeline);

  const sauronDir = path.join(workspace, ".sauron");
  fs.mkdirSync(sauronDir, { recursive: true });
  fs.writeFileSync(
    path.join(sauronDir, "cline-task-complete.json"),
    JSON.stringify({
      version: 1,
      pipelineId: planned.pipeline.id,
      pipelinePhase: 1,
      completedAt: new Date().toISOString(),
      summary: "phase 1 done",
    }),
  );

  const advanced = await advancePipelineAfterComplete(workspace, { pipelineAutoChain: true });
  assert.equal(advanced.ok, true);
  assert.equal(advanced.action, "next-phase");
  assert.equal(advanced.pipeline.currentPhase, 2);

  const handoffs = fs.readdirSync(sauronDir).filter((f) => f.startsWith("handoff-"));
  assert.ok(handoffs.length >= 1);
  fs.rmSync(workspace, { recursive: true, force: true });
});

test("startBuildPipeline writes state and handoff", async () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "pipeline-start-"));
  const result = await startBuildPipeline({
    pipelineId: "self-improve-feature-v1",
    workspacePath: workspace,
    settings: { pipelineAutoChain: true },
    options: { taskDescription: "Fix badge CSS" },
  });
  assert.equal(result.ok, true);
  assert.equal(result.pipeline.currentPhase, 1);
  assert.ok(fs.existsSync(path.join(workspace, ".sauron", "build-pipeline.json")));
  fs.rmSync(workspace, { recursive: true, force: true });
});
