const fs = require("fs");
const os = require("os");
const path = require("path");
const { createLogger } = require("../../logger");
const { trackCall } = require("./usage-tracker");
const { convertUsdToTl } = require("./finops-pricing");

const logger = createLogger("cline-usage-reader");

const CLINE_EXTENSION_IDS = [
  "saoudrizwan.claude-dev",
  "saoudrizwan.cline-nightly",
];

const SYNC_STATE_FILENAME = "cline-readonly-sync.json";
const OPERATION = "cline-task-readonly";
const SOURCE_NOTE = "tahmini, Cline geçmişinden okundu";

function pathsEqual(left, right) {
  const normalizedLeft = path.normalize(String(left || ""));
  const normalizedRight = path.normalize(String(right || ""));
  if (!normalizedLeft || !normalizedRight) {
    return false;
  }
  if (process.platform === "win32") {
    return normalizedLeft.toLowerCase() === normalizedRight.toLowerCase();
  }
  return normalizedLeft === normalizedRight;
}

function resolveClineGlobalStorageRoots() {
  if (process.platform === "win32") {
    const appData = process.env.APPDATA || "";
    if (!appData) {
      return [];
    }
    return CLINE_EXTENSION_IDS.map((extId) => path.join(
      appData,
      "Code",
      "User",
      "globalStorage",
      extId,
    ));
  }

  const home = os.homedir();
  if (process.platform === "darwin") {
    return CLINE_EXTENSION_IDS.map((extId) => path.join(
      home,
      "Library",
      "Application Support",
      "Code",
      "User",
      "globalStorage",
      extId,
    ));
  }

  return CLINE_EXTENSION_IDS.map((extId) => path.join(
    home,
    ".config",
    "Code",
    "User",
    "globalStorage",
    extId,
  ));
}

function resolveClineTaskHistoryPath() {
  for (const root of resolveClineGlobalStorageRoots()) {
    const candidate = path.join(root, "state", "taskHistory.json");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const roots = resolveClineGlobalStorageRoots();
  return roots.length
    ? path.join(roots[0], "state", "taskHistory.json")
    : null;
}

function getSyncStatePath(workspacePath) {
  return path.join(String(workspacePath || "").trim(), ".sauron", "usage", SYNC_STATE_FILENAME);
}

function loadSyncState(workspacePath) {
  const statePath = getSyncStatePath(workspacePath);
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, "utf8"));
    return {
      version: 1,
      tasks: parsed?.tasks && typeof parsed.tasks === "object" ? parsed.tasks : {},
    };
  } catch (error) {
    if (error?.code !== "ENOENT") {
      logger.warn("cline-usage-reader:sync-state-read-failed", {
        statePath,
        error: error?.message || String(error),
      });
    }
    return { version: 1, tasks: {} };
  }
}

function saveSyncState(workspacePath, state) {
  const statePath = getSyncStatePath(workspacePath);
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, `${JSON.stringify({
    version: 1,
    lastSyncedAt: new Date().toISOString(),
    tasks: state.tasks || {},
  }, null, 2)}\n`, "utf8");
}

function readTaskHistory(historyPath) {
  const raw = fs.readFileSync(historyPath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("taskHistory.json is not an array");
  }
  return parsed;
}

function taskMatchesWorkspace(task, workspacePath) {
  const configured = String(workspacePath || "").trim();
  if (!configured) {
    return false;
  }
  const cwd = String(task?.cwdOnTaskInitialization || "").trim();
  if (!cwd) {
    return false;
  }
  return pathsEqual(cwd, configured);
}

function snapshotTaskMetrics(task) {
  return {
    totalCost: Math.max(0, Number(task?.totalCost) || 0),
    tokensIn: Math.max(0, Number(task?.tokensIn) || 0),
    tokensOut: Math.max(0, Number(task?.tokensOut) || 0),
    ts: Number(task?.ts) || 0,
    modelId: String(task?.modelId || "unknown"),
  };
}

function computeUsageDelta(current, previous) {
  const next = snapshotTaskMetrics(current);
  if (!previous) {
    if (next.totalCost <= 0 && next.tokensIn <= 0 && next.tokensOut <= 0) {
      return null;
    }
    return next;
  }

  const delta = {
    totalCost: next.totalCost - Math.max(0, Number(previous.totalCost) || 0),
    tokensIn: next.tokensIn - Math.max(0, Number(previous.tokensIn) || 0),
    tokensOut: next.tokensOut - Math.max(0, Number(previous.tokensOut) || 0),
    ts: next.ts,
    modelId: next.modelId,
  };

  if (delta.totalCost <= 0 && delta.tokensIn <= 0 && delta.tokensOut <= 0) {
    return null;
  }

  return {
    totalCost: Math.max(0, delta.totalCost),
    tokensIn: Math.max(0, delta.tokensIn),
    tokensOut: Math.max(0, delta.tokensOut),
    ts: next.ts,
    modelId: next.modelId,
  };
}

function buildRecordId(taskId, totalCost) {
  return `cline-readonly:${taskId}:${totalCost.toFixed(9)}`;
}

function importTaskDelta(task, delta, settings) {
  const taskId = String(task?.id || task?.ulid || "").trim();
  if (!taskId) {
    return false;
  }

  trackCall({
    provider: "cline",
    model: delta.modelId || "unknown",
    promptTokens: delta.tokensIn,
    completionTokens: delta.tokensOut,
    costTl: convertUsdToTl(delta.totalCost, settings),
    costUsd: delta.totalCost,
    operation: OPERATION,
    recordId: buildRecordId(taskId, snapshotTaskMetrics(task).totalCost),
    sourceNote: SOURCE_NOTE,
    estimated: true,
    timestamp: delta.ts > 0
      ? new Date(delta.ts).toISOString()
      : new Date().toISOString(),
  }, settings);

  return true;
}

async function syncClineUsageFromDisk(settings = {}, options = {}) {
  const result = {
    ok: true,
    imported: 0,
    skipped: 0,
    reason: null,
    historyPath: null,
  };

  try {
    const workspacePath = String(settings.workspacePath || "").trim();
    if (!workspacePath || !fs.existsSync(workspacePath)) {
      result.ok = false;
      result.reason = "workspace-not-configured";
      return result;
    }

    const historyPath = options.historyPath || resolveClineTaskHistoryPath();
    result.historyPath = historyPath;
    if (!historyPath || !fs.existsSync(historyPath)) {
      result.ok = false;
      result.reason = "task-history-not-found";
      return result;
    }

    const history = readTaskHistory(historyPath);
    const syncState = loadSyncState(workspacePath);
    const nextTasks = { ...syncState.tasks };

    for (const task of history) {
      if (!task || typeof task !== "object") {
        result.skipped += 1;
        continue;
      }

      if (!taskMatchesWorkspace(task, workspacePath)) {
        result.skipped += 1;
        continue;
      }

      const taskId = String(task.id || task.ulid || "").trim();
      if (!taskId) {
        result.skipped += 1;
        continue;
      }

      const previous = nextTasks[taskId] || null;
      const delta = computeUsageDelta(task, previous);
      const currentSnapshot = snapshotTaskMetrics(task);
      nextTasks[taskId] = currentSnapshot;

      if (!delta) {
        result.skipped += 1;
        continue;
      }

      if (importTaskDelta(task, delta, settings)) {
        result.imported += 1;
      }
    }

    saveSyncState(workspacePath, { tasks: nextTasks });
    return result;
  } catch (error) {
    logger.warn("cline-usage-reader:sync-failed", {
      error: error?.message || String(error),
    });
    result.ok = false;
    result.reason = error?.message || "sync-failed";
    return result;
  }
}

module.exports = {
  CLINE_EXTENSION_IDS,
  OPERATION,
  SOURCE_NOTE,
  pathsEqual,
  resolveClineTaskHistoryPath,
  readTaskHistory,
  syncClineUsageFromDisk,
  computeUsageDelta,
  taskMatchesWorkspace,
  snapshotTaskMetrics,
  loadSyncState,
  saveSyncState,
  getSyncStatePath,
};
