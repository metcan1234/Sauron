const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SCENE_CACHE_FILE = "gamedev-scene-cache.json";

function readSceneCache(workspacePath = "") {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return null;
  }
  const cachePath = path.join(resolved, ".sauron", SCENE_CACHE_FILE);
  try {
    return JSON.parse(fs.readFileSync(cachePath, "utf8"));
  } catch {
    return null;
  }
}

function hashScenePayload(payload = {}) {
  const text = JSON.stringify(payload?.nodes || payload?.scene || payload || {});
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function buildSceneDeltaHint(workspacePath = "", settings = {}) {
  if (settings.tokenUltraUseSceneCache === false) {
    return { hint: "", deltaMode: false };
  }
  const cache = readSceneCache(workspacePath);
  if (!cache) {
    return {
      hint: `Scene cache pointer: .sauron/${SCENE_CACHE_FILE}`,
      deltaMode: false,
    };
  }
  const metricsPath = path.join(String(workspacePath || "").trim(), ".sauron", "gamedev-scene-metrics.json");
  let previousHash = "";
  try {
    const metrics = JSON.parse(fs.readFileSync(metricsPath, "utf8"));
    previousHash = String(metrics.lastSceneHash || "").trim();
  } catch {
    // no previous hash
  }
  const currentHash = hashScenePayload(cache);
  try {
    fs.mkdirSync(path.dirname(metricsPath), { recursive: true });
    fs.writeFileSync(
      metricsPath,
      `${JSON.stringify({ lastSceneHash: currentHash, updatedAt: new Date().toISOString() }, null, 2)}\n`,
      "utf8",
    );
  } catch {
    // non-fatal
  }
  if (!previousHash || previousHash === currentHash) {
    return {
      hint: `Scene cache pointer: .sauron/${SCENE_CACHE_FILE}`,
      deltaMode: false,
    };
  }
  const changedNodes = Array.isArray(cache.changedNodes)
    ? cache.changedNodes
    : (Array.isArray(cache.nodes) ? cache.nodes.slice(0, 12).map((n) => n?.name || n?.id || String(n)) : []);
  if (!changedNodes.length) {
    return {
      hint: `Scene delta: hash changed (${previousHash} → ${currentHash})`,
      deltaMode: true,
    };
  }
  return {
    hint: [
      "Scene delta (changed nodes):",
      ...changedNodes.slice(0, 12).map((line) => `- ${String(line).trim()}`),
    ].join("\n"),
    deltaMode: true,
  };
}

module.exports = {
  SCENE_CACHE_FILE,
  readSceneCache,
  hashScenePayload,
  buildSceneDeltaHint,
};
