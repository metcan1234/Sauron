const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { buildGamedevHandoffSummary } = require("../../src/sauron/gamedev-task-optimizer");
const { startGamePipeline, getCurrentPhaseGoal } = require("../../src/sauron/game-pipeline");

test("gamedev pipeline phase goal produces bounded handoff with mcpTools full", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-gamedev-handoff-"));
  startGamePipeline({
    pipelineId: "unity-co-op-climb-v1",
    workspacePath: tmp,
    taskDescription: "peak style climb",
  });
  const phase = getCurrentPhaseGoal(tmp);
  const handoff = buildGamedevHandoffSummary({
    taskText: phase.goal,
    engine: "unity",
    workspacePath: tmp,
    settings: {},
    mcpEntryPath: "/fake/index.js",
    notices: [`Pipeline: Co-op Climb — Faz ${phase.phase}/${phase.totalPhases}`],
  });

  assert.equal(handoff.tokenPolicy.mcpTools, "full");
  assert.equal(handoff.tokenPolicy.includeTranscript, false);
  assert.ok(handoff.summary.length <= 4000);
  assert.doesNotMatch(handoff.summary, /node_modules/);
});
