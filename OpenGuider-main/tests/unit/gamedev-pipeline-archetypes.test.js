const { test } = require("node:test");
const assert = require("node:assert/strict");
const { getGamePipeline } = require("../../src/sauron/game-pipeline/game-pipeline-registry");
const { resolveAutoGenre } = require("../../src/sauron/gamedev-genre-router");

test("physics-extraction pipeline exists with steam phase", () => {
  const pipeline = getGamePipeline("unity-physics-extraction-v1");
  assert.ok(pipeline);
  assert.equal(pipeline.templateId, "physics-extraction");
  const last = pipeline.phases[pipeline.phases.length - 1];
  assert.match(String(last.goal), /Steam-ready/i);
});

test("arena-pvp pipeline exists", () => {
  const pipeline = getGamePipeline("unity-arena-pvp-v1");
  assert.ok(pipeline);
  assert.equal(pipeline.genre, "arena-pvp");
});

test("genre router resolves physics-extraction keywords", () => {
  const result = resolveAutoGenre("co-op physics extraction loot haul game", "unity");
  assert.equal(result.genre, "physics-extraction");
});

test("unreal horror coop pipeline parity", () => {
  const pipeline = getGamePipeline("unreal-horror-coop-v1");
  assert.ok(pipeline);
  assert.equal(pipeline.engine, "unreal");
});
