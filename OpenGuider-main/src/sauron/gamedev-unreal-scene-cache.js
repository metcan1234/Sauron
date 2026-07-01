const fs = require("fs");
const path = require("path");

const CACHE_FILENAME = "gamedev-unreal-scene-cache.json";

function getCachePath(workspacePath) {
  return path.join(String(workspacePath || "").trim(), ".sauron", CACHE_FILENAME);
}

function readUnrealSceneCache(workspacePath) {
  try {
    const cachePath = getCachePath(workspacePath);
    if (!fs.existsSync(cachePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(cachePath, "utf8"));
  } catch {
    return null;
  }
}

function writeUnrealSceneCache(workspacePath, data = {}) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return false;
  }
  const cachePath = getCachePath(resolved);
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, `${JSON.stringify({
    ...data,
    engine: "unreal",
    updatedAt: new Date().toISOString(),
  }, null, 2)}\n`, "utf8");
  return true;
}

function captureUnrealProjectSnapshot(workspacePath) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved || !fs.existsSync(resolved)) {
    return { ok: false, error: "missing-workspace" };
  }

  const uproject = fs.readdirSync(resolved, { withFileTypes: true })
    .find((entry) => entry.isFile() && entry.name.endsWith(".uproject"));
  const contentDir = path.join(resolved, "Content");
  const savedDir = path.join(resolved, "Saved");
  const configDir = path.join(resolved, "Config");

  const maps = [];
  if (fs.existsSync(contentDir)) {
    const walk = (dir, depth = 0) => {
      if (depth > 4 || maps.length >= 12) {
        return;
      }
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full, depth + 1);
        } else if (entry.name.endsWith(".umap")) {
          maps.push(path.relative(resolved, full).replace(/\\/g, "/"));
        }
      }
    };
    walk(contentDir);
  }

  const snapshot = {
    projectName: uproject?.name || null,
    hasSaved: fs.existsSync(savedDir),
    hasConfig: fs.existsSync(configDir),
    mapCount: maps.length,
    maps: maps.slice(0, 8),
    funplaySettings: fs.existsSync(path.join(savedDir, "FunplayMCP", "funplay_mcp_settings.json")),
  };

  writeUnrealSceneCache(resolved, snapshot);
  return { ok: true, snapshot };
}

function buildUnrealSceneCacheHint(workspacePath) {
  const cache = readUnrealSceneCache(workspacePath);
  if (!cache) {
    return "";
  }
  const parts = [
    `Unreal scene cache: .sauron/${CACHE_FILENAME}`,
    cache.projectName ? `Project: ${cache.projectName}` : null,
    cache.mapCount ? `Maps: ${cache.mapCount}` : null,
    cache.maps?.length ? `Sample: ${cache.maps.slice(0, 3).join(", ")}` : null,
  ].filter(Boolean);
  return parts.join(" | ");
}

async function tryCaptureUnrealSceneSnapshot(workspacePath) {
  return captureUnrealProjectSnapshot(workspacePath);
}

module.exports = {
  CACHE_FILENAME,
  readUnrealSceneCache,
  writeUnrealSceneCache,
  captureUnrealProjectSnapshot,
  buildUnrealSceneCacheHint,
  tryCaptureUnrealSceneSnapshot,
};
