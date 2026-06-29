const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveGamedevGenre, resolveAutoGenre } = require("../../src/sauron/gamedev-genre-router");

test("resolveGamedevGenre strong signal still matches co-op climb", () => {
  const result = resolveAutoGenre("PEAK gibi co-op climb oyunu yap");
  assert.equal(result.genre, "co-op-climb");
  assert.equal(result.reason, "strong-preset-signal");
});

test("resolveGamedevGenre strong signal matches feign", () => {
  const result = resolveAutoGenre("feign tarzı impostor oyunu");
  assert.equal(result.genre, "social-deduction");
});

test("resolveGamedevGenre uses configured preset template", () => {
  const result = resolveGamedevGenre("anything", { gamedevDefaultTemplate: "horror-coop" });
  assert.equal(result.genre, "horror-coop");
  assert.equal(result.reason, "configured-preset");
});

test("resolveGamedevGenre custom template for any game idea", () => {
  const result = resolveGamedevGenre("GTA tarzı açık dünya araba oyunu", { gamedevDefaultTemplate: "custom" });
  assert.equal(result.genre, "empty");
  assert.equal(result.pipelineId, "unity-empty-v1");
  assert.equal(result.adaptive, true);
});

test("resolveAutoGenre routes GTA open world to universal pipeline", () => {
  const result = resolveAutoGenre("GTA 5 tarzı açık dünya sandbox şehir oyunu");
  assert.equal(result.genre, "empty");
  assert.equal(result.adaptive, true);
  assert.ok(["multi-archetype-brief", "rich-universal-brief", "low-preset-confidence"].includes(result.reason));
});

test("resolveAutoGenre routes mobile math game to universal pipeline", () => {
  const result = resolveAutoGenre("mobil matematik soru çözme eğitim oyunu android");
  assert.equal(result.genre, "empty");
  assert.equal(result.adaptive, true);
});

test("resolveAutoGenre ambiguous keywords prefer custom", () => {
  const result = resolveAutoGenre("horror climb vote multiplayer");
  assert.equal(result.genre, "empty");
  assert.equal(result.adaptive, true);
});

test("resolveAutoGenre defaults unknown text to empty", () => {
  const result = resolveAutoGenre("hello world");
  assert.equal(result.pipelineId, "unity-empty-v1");
  assert.equal(result.adaptive, true);
});

test("resolveGamedevGenre auto mode keeps weak climb mention on custom path", () => {
  const result = resolveGamedevGenre("dağda yürüyüş simülasyonu", { gamedevDefaultTemplate: "auto" });
  assert.equal(result.genre, "empty");
});

test("resolveGamedevGenre routes unreal engine to unreal-empty pipeline", () => {
  const result = resolveGamedevGenre("açık dünya araba oyunu", {
    gamedevActiveEngine: "unreal",
    gamedevDefaultTemplate: "custom",
  });
  assert.equal(result.engine, "unreal");
  assert.equal(result.pipelineId, "unreal-empty-v1");
  assert.equal(result.adaptive, true);
});

test("resolveAutoGenre unreal engine always uses unreal pipeline", () => {
  const result = resolveAutoGenre("PEAK gibi climb", "unreal");
  assert.equal(result.pipelineId, "unreal-empty-v1");
  assert.equal(result.engine, "unreal");
});
