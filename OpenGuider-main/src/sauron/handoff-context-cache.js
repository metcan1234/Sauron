const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { buildWorkspaceTreeHint } = require("./workspace-tree-snapshot");
const {
  resolveDeltaOverlapMin,
  isChangedFilesOnlyEnabled,
  shouldPreferFullTreeFallback,
} = require("./token-ultra/token-ultra-v3-config");
const { recordCompressionFallback } = require("./token-ultra/fallback-metrics");

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
  const tokenUltraDelta = settings.tokenUltraEnabled !== false && settings.tokenUltraUseDeltaHandoff !== false;
  const finopsDelta = settings.finopsDeltaHandoffEnabled !== false && settings.finopsCostOptimizerEnabled !== false;
  if (!tokenUltraDelta && !finopsDelta) {
    return false;
  }
  const cache = readHandoffContextCache(workspacePath);
  if (!cache?.lastGoal || !cache?.lastTreeHint) {
    return false;
  }
  const threshold = resolveDeltaOverlapMin(settings);
  return tokenOverlapRatio(goalText, cache.lastGoal) >= threshold;
}

function buildChangedFilesHint(workspacePath, options = {}) {
  const merged = { maxChars: 400, ...options };
  const changed = collectGitChangedFiles(workspacePath);
  if (!changed.length) {
    return { hint: "", changedCount: 0 };
  }
  let body = [
    "Changed files:",
    ...changed.map((line) => `- ${line}`),
    "Repo map pointer: .sauron/repo-map.json",
  ].join("\n");
  if (body.length > merged.maxChars) {
    body = `${body.slice(0, Math.max(0, merged.maxChars - 1))}…`;
  }
  return { hint: body, changedCount: changed.length };
}

function buildGitContextBlock(workspacePath, maxChars = 600) {
  const diff = collectGitDiffHunkSummary(workspacePath, maxChars);
  if (diff) {
    return diff;
  }
  const changed = collectGitChangedFiles(workspacePath);
  if (!changed.length) {
    return "";
  }
  let body = [
    "Git changed files:",
    ...changed.map((line) => `- ${line}`),
  ].join("\n");
  if (body.length > maxChars) {
    body = `${body.slice(0, Math.max(0, maxChars - 1))}…`;
  }
  return body;
}

function appendGitContext(hint, workspacePath, maxChars = 600) {
  const gitBlock = buildGitContextBlock(workspacePath, maxChars);
  if (!gitBlock) {
    return String(hint || "").trim();
  }
  const base = String(hint || "").trim();
  if (!base) {
    return gitBlock;
  }
  if (base.includes("Git diff hunk pointer:") || base.includes("Git changed files:")) {
    return base;
  }
  return `${base}\n\n${gitBlock}`.trim();
}

function isDeltaHintQualitySufficient(hint = "", treeFallback = "") {
  const text = String(hint || "").trim();
  if (!text) {
    return false;
  }
  if (text.includes("Git diff hunk pointer:") || text.includes("Git changed files:")) {
    return true;
  }
  if (text.includes("Workspace delta:") && !text.includes("(no file changes since last handoff)")) {
    return true;
  }
  if (text.includes("Changed files:")) {
    return true;
  }
  if (text.includes("Workspace snapshot:") || text.includes("Workspace delta:")) {
    return true;
  }
  return Boolean(String(treeFallback || "").trim());
}

function collectGitDiffHunkSummary(workspacePath, maxChars = 600) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return "";
  }
  try {
    const output = execSync("git diff --unified=1 --no-color", {
      cwd: resolved,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 4000,
    });
    const text = String(output || "").trim();
    if (!text) {
      return "";
    }
    const lines = text.split(/\r?\n/).slice(0, 40);
    let body = ["Git diff hunk pointer:", ...lines].join("\n");
    if (body.length > maxChars) {
      body = `${body.slice(0, maxChars - 1)}…`;
    }
    return body;
  } catch {
    return "";
  }
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
  const gitHunk = collectGitDiffHunkSummary(workspacePath, merged.maxChars);
  if (gitHunk) {
    return gitHunk;
  }
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
  const fullTree = buildWorkspaceTreeHint(workspacePath, options);
  const useChangedFilesOnly = isChangedFilesOnlyEnabled(settings);
  const changedFiles = useChangedFilesOnly ? buildChangedFilesHint(workspacePath, options) : null;
  const preferFullTree = changedFiles
    ? shouldPreferFullTreeFallback(settings, changedFiles.changedCount)
    : false;

  if (useChangedFilesOnly && !preferFullTree && changedFiles?.hint) {
    const hint = appendGitContext(changedFiles.hint, workspacePath);
    return {
      hint,
      deltaMode: false,
      changedFilesOnly: true,
    };
  }

  const useDelta = shouldUseDeltaHandoff(settings, workspacePath, goalText);
  if (!useDelta) {
    const hint = appendGitContext(fullTree, workspacePath);
    return {
      hint,
      deltaMode: false,
      changedFilesOnly: false,
    };
  }

  const cache = readHandoffContextCache(workspacePath);
  let deltaHint = buildDeltaWorkspaceHint(workspacePath, cache, options);
  if (!isDeltaHintQualitySufficient(deltaHint, fullTree)) {
    recordCompressionFallback(workspacePath, "delta-quality-gate", settings.activeChannel || "workspace");
    deltaHint = fullTree ? fullTree.replace(/^Workspace snapshot:/, "Workspace snapshot:") : fullTree;
    const hint = appendGitContext(deltaHint, workspacePath);
    return {
      hint,
      deltaMode: false,
      qualityFallback: true,
    };
  }

  const hint = appendGitContext(deltaHint, workspacePath);
  return {
    hint,
    deltaMode: true,
    changedFilesOnly: false,
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
  buildChangedFilesHint,
  buildGitContextBlock,
  appendGitContext,
  collectGitDiffHunkSummary,
  collectGitChangedFiles,
  isDeltaHintQualitySufficient,
  resolveWorkspaceHint,
  updateHandoffContextCache,
};
