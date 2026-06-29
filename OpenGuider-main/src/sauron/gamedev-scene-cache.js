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
  if (cache.narrative) {
    parts.push(`Summary: ${String(cache.narrative).slice(0, 160)}`);
  }
  if (cache.hierarchy?.rootCount) {
    parts.push(`Hierarchy roots: ${cache.hierarchy.rootCount}`);
  }
  if (Array.isArray(cache.hierarchy?.lastPaths) && cache.hierarchy.lastPaths.length > 0) {
    parts.push(`Paths: ${cache.hierarchy.lastPaths.slice(0, 5).join(", ")}`);
  }
  return parts.join(" | ");
}

async function tryCaptureHierarchySnapshot(workspacePath) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return { ok: false };
  }
  try {
    const { dispatchUnityCommand } = require("./gamedev-mcp-proxy");
    const result = await dispatchUnityCommand("get_hierarchy", { rootPath: "", depth: 3 }, { timeoutMs: 4000 });
    if (!result.ok) {
      return { ok: false, skipped: true };
    }
    const hierarchy = result.result && typeof result.result === "object" ? result.result : result;
    const nodes = hierarchy?.nodes || hierarchy?.children || hierarchy?.roots || [];
    const paths = [];
    const walk = (items, prefix = "") => {
      for (const item of items || []) {
        const name = item?.name || item?.path || "";
        const full = prefix ? `${prefix}/${name}` : name;
        if (full) {
          paths.push(full.slice(0, 80));
        }
        if (paths.length >= 12) {
          return;
        }
        if (item?.children) {
          walk(item.children, full);
        }
      }
    };
    walk(Array.isArray(nodes) ? nodes : []);
    const existing = readGamedevSceneCache(resolved) || {};
    writeGamedevSceneCache(resolved, {
      ...existing,
      hierarchy: {
        rootCount: Array.isArray(nodes) ? nodes.length : 0,
        lastPaths: paths.slice(0, 12),
        capturedAt: new Date().toISOString(),
      },
    });
    return { ok: true, pathCount: paths.length };
  } catch {
    return { ok: false, skipped: true };
  }
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
  tryCaptureHierarchySnapshot,
};
