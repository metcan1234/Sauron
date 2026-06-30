const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  compileGamedevBrief,
  readGameDesignBrief,
  buildBriefHandoffHint,
  compilePhaseGoalsHeuristic,
  BRIEF_POINTER,
} = require("../../src/sauron/gamedev-prompt-compiler");
const { getGamePipeline } = require("../../src/sauron/game-pipeline/game-pipeline-registry");

test("writeGameDesignBrief via compileGamedevBrief creates brief file", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-brief-"));
  const template = getGamePipeline("unity-co-op-climb-v1");
  const result = await compileGamedevBrief({
    workspacePath: tmp,
    masterPrompt: "4 player co-op climb with stamina and rope mechanics",
    taskText: "start climb prototype",
    genre: template.genre,
    pipelineId: template.id,
    templatePhases: template.phases,
    settings: { gamedevUseLlmPlan: false },
  });
  assert.equal(result.ok, true);
  assert.equal(result.briefPointer, BRIEF_POINTER);
  const brief = readGameDesignBrief(tmp);
  assert.ok(brief);
  assert.match(brief.masterPrompt, /co-op climb/i);
  assert.equal(brief.compiledBy, "heuristic");
  assert.equal(result.phases.length, template.phases.length);
});

test("compilePhaseGoalsHeuristic customizes genre phases from prompt", () => {
  const template = getGamePipeline("unity-horror-coop-v1");
  const phases = compilePhaseGoalsHeuristic({
    masterPrompt: "horror flashlight survival multiplayer",
    templatePhases: template.phases,
    genre: "horror-coop",
  });
  assert.equal(phases.length, 6);
  assert.match(phases[1].goal, /brief:|horror|flashlight/i);
});

test("buildBriefHandoffHint stays bounded", () => {
  const hint = buildBriefHandoffHint("a".repeat(200));
  assert.ok(hint.includes(BRIEF_POINTER));
  assert.ok(hint.length < 200);
});
