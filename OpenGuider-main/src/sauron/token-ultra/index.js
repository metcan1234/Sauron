const { buildCachePointer, formatPointerLine } = require("./context-pointer");
const { compressHandoffSummary } = require("./compress-brief");
const { resolveChannelMaxChars } = require("./channel-limit-resolver");
const { recordHandoffSnapshot, recordSavings, shouldUseDeltaFromCache } = require("./delta-store");
const { writeRepoMapCache } = require("./repo-map");
const { buildTokenBudgetHints } = require("./token-budget-hints");
const { sandboxLargeOutput } = require("./tool-output-sandbox");
const { buildSessionSummary } = require("./session-compactor");
const { compressToolOutput } = require("./tool-output-compressor");
const { buildReadPointer } = require("./read-cache");

function isTokenUltraEnabled(settings = {}) {
  return settings.tokenUltraEnabled !== false;
}

function buildContextPointers(workspacePath, settings = {}, context = {}) {
  const pointers = [];
  if (settings.tokenUltraUseRepoMap !== false && workspacePath) {
    const repoMap = writeRepoMapCache(workspacePath);
    if (repoMap?.pointer) {
      pointers.push(buildCachePointer(repoMap.pointer));
    }
  }
  if (settings.tokenUltraUseSceneCache !== false) {
    pointers.push(buildCachePointer(context.sceneCachePointer || ".sauron/gamedev-scene-cache.json"));
  }
  for (const filePath of context.relevantFiles || []) {
    const readPointer = buildReadPointer(workspacePath, filePath);
    if (readPointer.usePointer && readPointer.line) {
      pointers.push({ path: filePath, label: readPointer.line });
    }
  }
  return pointers.filter(Boolean);
}

function applyTokenUltraToHandoff(payload, settings = {}, options = {}) {
  if (!isTokenUltraEnabled(settings)) {
    return { payload, savedChars: 0, tokenUltra: null };
  }

  const workspacePath = String(payload?.workspacePath || options.workspacePath || "").trim();
  const goal = String(payload?.goal || "").trim();
  const deltaState = shouldUseDeltaFromCache(workspacePath, goal);
  const pointers = buildContextPointers(workspacePath, settings, {
    ...options,
    relevantFiles: payload?.relevantFiles || [],
  });

  let taskSummary = String(payload?.taskSummary || "");
  let savedChars = 0;

  if (settings.tokenUltraSandboxToolOutput !== false && taskSummary.length > 2500) {
    const compressed = compressToolOutput(taskSummary, { maxChars: 2200 });
    if (compressed.compressed) {
      savedChars += compressed.savedChars || 0;
      taskSummary = compressed.text;
    }
    const sandboxed = sandboxLargeOutput(workspacePath, "handoff-summary", taskSummary);
    if (sandboxed.sandboxed) {
      savedChars += Math.max(0, (sandboxed.charCount || 0) - String(sandboxed.summary || "").length);
      taskSummary = sandboxed.summary;
    }
  }

  const channel = String(options.channel || payload?.channel || "workspace").trim().toLowerCase();
  const resolvedChannel = ["workspace", "gamedev", "goose"].includes(channel) ? channel : "workspace";

  const maxChars = resolveChannelMaxChars(settings, resolvedChannel);
  const compressed = compressHandoffSummary(taskSummary, maxChars);
  taskSummary = compressed.text;
  savedChars += compressed.savedChars || 0;

  const pointerLines = pointers.map(formatPointerLine).filter(Boolean);
  if (pointerLines.length) {
    taskSummary = `${pointerLines.join("\n")}\n\n${taskSummary}`.trim();
  }

  const compressedSummary = buildSessionSummary({
    goal,
    lastAction: options.lastAction,
    touchedFiles: options.touchedFiles,
  });

  const tokenUltra = buildTokenBudgetHints(settings, {
    deltaFrom: deltaState.deltaFrom,
    repoMapPointer: pointers[0]?.path || null,
    sceneCachePointer: ".sauron/gamedev-scene-cache.json",
    channel: resolvedChannel,
  });
  tokenUltra.compressedSummary = compressedSummary;
  tokenUltra.deltaMode = deltaState.useDelta;
  tokenUltra.cacheBreakpoint = payload?.cacheBreakpoint || payload?.id || null;

  const nextPayload = {
    ...payload,
    version: Math.max(Number(payload?.version) || 2, 3),
    taskSummary,
    tokenUltra,
  };

  if (workspacePath) {
    recordHandoffSnapshot(workspacePath, {
      handoffId: payload?.id,
      goal,
      summary: taskSummary,
      sceneHash: options.sceneHash,
      repoMapHash: options.repoMapHash,
    });
    if (savedChars > 0) {
      recordSavings(workspacePath, savedChars, settings, resolvedChannel);
    }
  }

  return { payload: nextPayload, savedChars, tokenUltra };
}

module.exports = {
  isTokenUltraEnabled,
  buildContextPointers,
  applyTokenUltraToHandoff,
  buildTokenBudgetHints,
};