const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveGamedevGenre } = require("../../src/sauron/gamedev-genre-router");

test("resolveGamedevGenre matches co-op climb keywords", () => {
  const result = resolveGamedevGenre("PEAK gibi tırmanma oyunu yap");
  assert.equal(result.genre, "co-op-climb");
  assert.equal(result.pipelineId, "unity-co-op-climb-v1");
});

test("resolveGamedevGenre matches horror keywords", () => {
  const result = resolveGamedevGenre("zort gibi korku co-op");
  assert.equal(result.genre, "horror-coop");
});

test("resolveGamedevGenre matches social deduction keywords", () => {
  const result = resolveGamedevGenre("feign tarzı impostor oyunu");
  assert.equal(result.genre, "social-deduction");
});

test("resolveGamedevGenre uses configured template", () => {
  const result = resolveGamedevGenre("anything", { gamedevDefaultTemplate: "horror-coop" });
  assert.equal(result.genre, "horror-coop");
  assert.equal(result.reason, "configured-template");
});

test("resolveGamedevGenre defaults to empty pipeline", () => {
  const result = resolveGamedevGenre("hello world");
  assert.equal(result.pipelineId, "unity-empty-v1");
});
