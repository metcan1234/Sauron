const test = require("node:test");
const assert = require("node:assert/strict");
const {
  analyzeGameBrief,
  buildUniversalPhaseGoal,
  detectArchetypes,
} = require("../../src/sauron/gamedev-brief-analyzer");
const { compilePhaseGoalsHeuristic } = require("../../src/sauron/gamedev-prompt-compiler");
const { getGamePipeline } = require("../../src/sauron/game-pipeline/game-pipeline-registry");

test("analyzeGameBrief detects open-world and mobile archetypes", () => {
  const analysis = analyzeGameBrief("GTA tarzı açık dünya mobil sandbox");
  assert.ok(analysis.archetypes.includes("open-world"));
  assert.ok(analysis.archetypes.includes("mobile"));
});

test("analyzeGameBrief detects educational archetype", () => {
  const analysis = analyzeGameBrief("çocuklar için matematik quiz mobil oyun");
  assert.ok(analysis.archetypes.includes("educational"));
});

test("buildUniversalPhaseGoal injects brief into each phase", () => {
  const analysis = analyzeGameBrief("puzzle match-3 candy style mobile game");
  const goal = buildUniversalPhaseGoal(3, 4, analysis);
  assert.match(goal, /puzzle|match|brief|mechanic/i);
});

test("compilePhaseGoalsHeuristic universal mode for empty pipeline", () => {
  const template = getGamePipeline("unity-empty-v1");
  const phases = compilePhaseGoalsHeuristic({
    masterPrompt: "GTA tarzı açık dünya araba çalma ve polis kovalamaca",
    templatePhases: template.phases,
    genre: "empty",
    adaptive: true,
  });
  assert.equal(phases.length, 4);
  assert.equal(phases[0].compiledMode, "universal");
  assert.match(phases[2].goal, /açık dünya|GTA|mechanic/i);
});
