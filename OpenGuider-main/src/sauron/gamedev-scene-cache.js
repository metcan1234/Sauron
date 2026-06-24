const fs = require("fs");
const path = require("path");

const CACHE_FILENAME = "gamedev-scene-cache.json";

function getCachePath(workspacePath) {
  return path.join(String(workspacePath || "").trim(), ".sauron", CACHE_FILENAME);
}

function readGamedevSceneCache(workspacePath) {
  const cachePath = getCachePath(workspacePath);
  try {
    if (!fs.existsSync(cachePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(cachePath, "utf8"));
  } catch {
    return null;
  }
}

function writeGamedevSceneCache(workspacePath, data) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return false;
  }
  const cachePath = getCachePath(resolved);
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify({
    ...data,
    updatedAt: new Date().toISOString(),
  }, null, 2), "utf8");
  return true;
}

function buildSceneCacheHandoffHint(workspacePath, engine) {
  const cache = readGamedevSceneCache(workspacePath);
  if (!cache) {
    return "";
  }
  const parts = [
    `Scene cache: .sauron/${CACHE_FILENAME}`,
    `Engine: ${cache.engine || engine || "unity"}`,
  ];
  if (cache.lastGoal) {
    parts.push(`Last goal: ${String(cache.lastGoal).slice(0, 120)}`);
  }
  if (cache.connectorConnected === true) {
    parts.push("Bridge: connected at last session");
  }
  return parts.join(" | ");
}

function updateGamedevSceneCache(workspacePath, { engine, goal, connectorConnected, status } = {}) {
  const existing = readGamedevSceneCache(workspacePath) || {};
  return writeGamedevSceneCache(workspacePath, {
    ...existing,
    engine: engine || existing.engine,
    lastGoal: goal || existing.lastGoal,
    connectorConnected: connectorConnected ?? existing.connectorConnected,
    lastStatus: status ? {
      dashboardRunning: status.dashboardRunning,
      mcpEntryOk: status.mcpEntryOk,
    } : existing.lastStatus,
  });
}

module.exports = {
  CACHE_FILENAME,
  readGamedevSceneCache,
  writeGamedevSceneCache,
  buildSceneCacheHandoffHint,
  updateGamedevSceneCache,
};
