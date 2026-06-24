const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  updateGamedevSceneCache,
  buildSceneCacheHandoffHint,
  readGamedevSceneCache,
} = require("../../src/sauron/gamedev-scene-cache");

test("scene cache writes and produces handoff hint", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-scene-"));
  updateGamedevSceneCache(tmp, {
    engine: "unity",
    goal: "Add climb controller",
    connectorConnected: true,
  });
  const cache = readGamedevSceneCache(tmp);
  assert.equal(cache.engine, "unity");
  const hint = buildSceneCacheHandoffHint(tmp, "unity");
  assert.match(hint, /gamedev-scene-cache\.json/);
  assert.match(hint, /Bridge: connected/);
});
