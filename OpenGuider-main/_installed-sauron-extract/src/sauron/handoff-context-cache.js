const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { buildWorkspaceTreeHint } = require("./workspace-tree-snapshot");

const CACHE_FILENAME = "handoff-context-cache.json";
const DELTA_TREE_OPTIONS = { maxDepth: 2, maxEntries: 15, maxChars: 200 };

function normalizeGoal(text) {
  return String(text || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function tokenOverlapRatio(a, b) {
  const tokensA = new Set(normalizeGoal(a).split(/\s+/).filter(Boolean));
  const tokensB = new Set(normalizeGoal(b).split(/\s+/).filter(Boolean));
  if (!tokensA.size || !tokensB.size) {
    return 0;
  }
  let overlap = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      overlap += 1;
    }
  }
  return overlap / Math.max(tokensA.size, tokensB.size);
}

function getCachePath(workspacePath) {
  return path.join(String(workspacePath || "").trim(), ".sauron", CACHE_FILENAME);
}

function readHandoffContextCache(workspacePath) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return null;
  }
  const cachePath = getCachePath(resolved);
  try {
    const raw = fs.readFileSync(cachePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeHandoffContextCache(workspacePath, cache) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return false;
  }
  const cachePath = getCachePath(resolved);
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), "utf8");
  return true;
}

function shouldUseDeltaHandoff(settings = {}, workspacePath, goalText) {
  if (settings.finopsCostOptimizerEnabled === false) {
    return false;
  }
  if (settings.finopsDeltaHandoffEnabled === false) {
    return false;
  }
  const cache = readHandoffContextCache(workspacePath);
  if (!cache?.lastGoal || !cache?.lastTreeHint) {
    return false;
  }
  return tokenOverlapRatio(goalText, cache.lastGoal) >= 0.7;
}

function collectGitChangedFiles(workspacePath) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return [];
  }
  try {
    const output = execSync("git status --porcelain", {
      cwd: resolved,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 3000,
    });
    return String(output || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 20);
  } catch {
    return [];
  }
}

function buildDeltaWorkspaceHint(workspacePath, cache = {}, options = {}) {
  const merged = { ...DELTA_TREE_OPTIONS, ...options };
  const changed = collectGitChangedFiles(workspacePath);
  if (changed.length > 0) {
    let body = [
      "Workspace delta:",
      ...changed.map((line) => `- ${line}`),
    ].join("\n");
    if (body.length > merged.maxChars) {
      body = `${body.slice(0, Math.max(0, merged.maxChars - 1))}…`;
    }
    return body;
  }

  const compact = buildWorkspaceTreeHint(workspacePath, merged);
  if (compact) {
    return compact.replace(/^Workspace snapshot:/, "Workspace delta:");
  }

  const previous = String(cache?.lastTreeHint || "").trim();
  if (previous) {
    return `Workspace delta:\n(no file changes since last handoff)`;
  }
  return "";
}

function resolveWorkspaceHint(workspacePath, settings = {}, goalText = "", options = {}) {
  const useDelta = shouldUseDeltaHandoff(settings, workspacePath, goalText);
  if (!useDelta) {
    return {
      hint: buildWorkspaceTreeHint(workspacePath, options),
      deltaMode: false,
    };
  }
  const cache = readHandoffContextCache(workspacePath);
  return {
    hint: buildDeltaWorkspaceHint(workspacePath, cache, options),
    deltaMode: true,
  };
}

function updateHandoffContextCache(workspacePath, { goal, treeHint, lastClarify } = {}) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return false;
  }
  const previous = readHandoffContextCache(resolved) || {};
  const next = {
    ...previous,
    lastGoal: String(goal || previous.lastGoal || "").trim(),
    lastTreeHint: String(treeHint || previous.lastTreeHint || "").trim(),
    lastClarify: String(lastClarify ?? previous.lastClarify ?? "").trim(),
    updatedAt: new Date().toISOString(),
  };
  return writeHandoffContextCache(resolved, next);
}

module.exports = {
  CACHE_FILENAME,
  normalizeGoal,
  tokenOverlapRatio,
  getCachePath,
  readHandoffContextCache,
  writeHandoffContextCache,
  shouldUseDeltaHandoff,
  buildDeltaWorkspaceHint,
  resolveWorkspaceHint,
  updateHandoffContextCache,
};
