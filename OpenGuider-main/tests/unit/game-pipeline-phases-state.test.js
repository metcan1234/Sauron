const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { planGamePipeline, getPhasesFromPipelineState } = require("../../src/sauron/game-pipeline/game-pipeline-planner");
const {
  startGamePipeline,
  getCurrentPhaseGoal,
} = require("../../src/sauron/game-pipeline/game-pipeline-runner");

test("pipelineState.phases overrides registry goals at runtime", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-phase-state-"));
  const customGoal = "CUSTOM_PHASE_GOAL_FROM_BRIEF_COMPILER";
  const planned = await planGamePipeline("unity-empty-v1", {
    taskDescription: "red cube jump",
    masterPrompt: "red cube jump mechanic prototype",
    workspacePath: tmp,
    settings: {},
  });
  assert.equal(planned.ok, true);
  planned.pipeline.phases[2].goal = customGoal;
  planned.pipeline.currentPhase = 3;
  fs.mkdirSync(path.join(tmp, ".sauron"), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, ".sauron", "game-pipeline.json"),
    JSON.stringify(planned.pipeline, null, 2),
    "utf8",
  );

  const statePhases = getPhasesFromPipelineState(planned.pipeline);
  assert.equal(statePhases[2].goal, customGoal);

  const phase = getCurrentPhaseGoal(tmp);
  assert.equal(phase.phase, 3);
  assert.equal(phase.goal, customGoal);
});

test("startGamePipeline stores customized phases from compiler", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-start-phases-"));
  const started = await startGamePipeline({
    pipelineId: "unity-social-deduction-v1",
    workspacePath: tmp,
    taskDescription: "vote UI impostor",
    masterPrompt: "8 player social deduction vote impostor lobby",
    settings: {},
  });
  assert.equal(started.ok, true);
  assert.ok(Array.isArray(started.pipeline.phases));
  assert.equal(started.pipeline.phases.length, 6);
  const phase = getCurrentPhaseGoal(tmp);
  assert.ok(phase.goal.length > 0);
  assert.ok(phase.briefMeta || fs.existsSync(path.join(tmp, ".sauron", "game-design-brief.json")));
});
