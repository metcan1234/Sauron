const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  hashScenePayload,
  buildSceneDeltaHint,
  SCENE_CACHE_FILE,
} = require("../../src/sauron/token-ultra/scene-delta");

test("buildSceneDeltaHint returns pointer when no cache", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "scene-delta-"));
  try {
    const result = buildSceneDeltaHint(workspace, { tokenUltraUseSceneCache: true });
    assert.equal(result.deltaMode, false);
    assert.ok(result.hint.includes(SCENE_CACHE_FILE));
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("buildSceneDeltaHint reports changed nodes on hash change", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "scene-delta-hash-"));
  try {
    const cachePath = path.join(workspace, ".sauron", SCENE_CACHE_FILE);
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify({
      nodes: [{ name: "Player" }],
      changedNodes: ["Player", "Enemy"],
    }), "utf8");
    const metricsPath = path.join(workspace, ".sauron", "gamedev-scene-metrics.json");
    fs.writeFileSync(metricsPath, JSON.stringify({
      lastSceneHash: "old-hash-value",
    }), "utf8");
    const result = buildSceneDeltaHint(workspace, { tokenUltraUseSceneCache: true });
    assert.equal(result.deltaMode, true);
    assert.ok(result.hint.includes("Scene delta"));
    assert.ok(result.hint.includes("Player"));
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("hashScenePayload is stable for same payload", () => {
  const payload = { nodes: [{ id: 1, name: "Root" }] };
  assert.equal(hashScenePayload(payload), hashScenePayload(payload));
});
