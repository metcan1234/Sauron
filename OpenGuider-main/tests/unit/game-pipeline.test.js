const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { listGamePipelines, getGamePipeline } = require("../../src/sauron/game-pipeline/game-pipeline-registry");
const { planGamePipeline } = require("../../src/sauron/game-pipeline/game-pipeline-planner");
const {
  startGamePipeline,
  getCurrentPhaseGoal,
  advanceGamePipeline,
} = require("../../src/sauron/game-pipeline/game-pipeline-runner");

test("listGamePipelines includes unity genre pipelines", () => {
  const pipelines = listGamePipelines();
  const ids = pipelines.map((p) => p.id);
  assert.ok(ids.includes("unity-co-op-climb-v1"));
  assert.ok(ids.includes("unity-horror-coop-v1"));
  assert.ok(ids.includes("unity-social-deduction-v1"));
});

test("planGamePipeline creates active state", async () => {
  const planned = await planGamePipeline("unity-empty-v1", { taskDescription: "red cube" });
  assert.equal(planned.ok, true);
  assert.equal(planned.pipeline.status, "active");
  assert.equal(planned.pipeline.totalPhases, 4);
});

test("startGamePipeline resumes active pipeline", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-game-pipeline-"));
  const first = await startGamePipeline({
    pipelineId: "unity-co-op-climb-v1",
    workspacePath: tmp,
    taskDescription: "climb mountain",
  });
  assert.equal(first.ok, true);
  const second = await startGamePipeline({
    pipelineId: "unity-horror-coop-v1",
    workspacePath: tmp,
  });
  assert.equal(second.resumed, true);
  assert.equal(second.pipeline.templateId, "unity-co-op-climb-v1");
  const phase = getCurrentPhaseGoal(tmp);
  assert.equal(phase.phase, 1);
  assert.match(phase.goal, /playable|Verify|scaffold/i);
});

test("advanceGamePipeline moves to next phase after task complete artifact", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-game-pipeline-adv-"));
  const started = await startGamePipeline({
    pipelineId: "unity-empty-v1",
    workspacePath: tmp,
  });
  assert.equal(started.ok, true);
  const pipeline = started.pipeline;
  const artifactPath = path.join(tmp, ".sauron", "cline-task-complete.json");
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(artifactPath, JSON.stringify({ pipelineId: pipeline.id, handoffId: "h1" }), "utf8");
  const advanced = advanceGamePipeline(tmp, { gamedevPipelineAutoChain: true });
  assert.equal(advanced.ok, true);
  assert.equal(advanced.action, "next-phase");
  const phase = getCurrentPhaseGoal(tmp);
  assert.equal(phase.phase, 2);
});

test("getGamePipeline returns phase definitions", () => {
  const pipeline = getGamePipeline("unity-social-deduction-v1");
  assert.equal(pipeline.phases.length, 6);
  assert.equal(pipeline.templateId, "social-deduction");
});
