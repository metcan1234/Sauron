const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  startGamePipeline,
  advanceGamePipelineAfterComplete,
} = require("../../src/sauron/game-pipeline");

test("game pipeline auto-chain integration produces phase 2 handoff", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-gamedev-chain-"));
  const started = startGamePipeline({
    pipelineId: "unity-social-deduction-v1",
    workspacePath: tmp,
    taskDescription: "feign style social game",
  });
  assert.equal(started.ok, true);

  const artifactPath = path.join(tmp, ".sauron", "cline-task-complete.json");
  fs.writeFileSync(artifactPath, JSON.stringify({
    pipelineId: started.pipeline.id,
    handoffId: "integration-h1",
  }), "utf8");

  const advanced = await advanceGamePipelineAfterComplete(tmp, {
    gamedevPipelineAutoChain: true,
    gamedevEnabled: true,
  }, { launchVSCode: false });

  assert.equal(advanced.ok, true);
  assert.equal(advanced.action, "next-phase");
  assert.equal(advanced.pipeline.currentPhase, 2);

  const handoffPath = advanced.handoffPath || path.join(tmp, ".sauron", advanced.handoffFileName);
  const handoff = JSON.parse(fs.readFileSync(handoffPath, "utf8"));
  assert.equal(handoff.channel, "gamedev");
  assert.equal(handoff.gamedev.mcpTools, "full");
  assert.equal(handoff.pipelinePhase, 2);
  assert.ok(handoff.taskSummary.length <= 4000);
});
