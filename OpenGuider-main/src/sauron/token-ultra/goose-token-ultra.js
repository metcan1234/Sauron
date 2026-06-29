const { compressHandoffSummary } = require("./compress-brief");
const {
  recordHandoffSnapshot,
  recordSavings,
  shouldUseDeltaFromCache,
} = require("./delta-store");
const { buildSessionSummary } = require("./session-compactor");
const { resolveChannelMaxChars } = require("./channel-limit-resolver");

function isTokenUltraEnabled(settings = {}) {
  return settings.tokenUltraEnabled !== false;
}

function applyTokenUltraToGooseTask(taskText, settings = {}, options = {}) {
  const original = String(taskText || "").trim();
  if (!original || !isTokenUltraEnabled(settings)) {
    return {
      text: original,
      tokenUltra: null,
      savedChars: 0,
      truncated: false,
    };
  }

  const workspacePath = String(options.workspacePath || "").trim();
  const goal = String(options.goal || original).trim();
  const maxChars = resolveChannelMaxChars(settings, "goose");
  const deltaState = shouldUseDeltaFromCache(workspacePath, goal);

  let text = original;
  let savedChars = 0;

  if (deltaState.useDelta) {
    const summary = buildSessionSummary({
      goal,
      lastAction: options.lastAction,
      touchedFiles: options.touchedFiles,
    });
    if (summary) {
      const deltaLine = `Delta (önceki Goose görevi: ${deltaState.deltaFrom || "cache"}): ${summary}`;
      text = `${deltaLine}\n\n${text}`.trim();
    }
  }

  const compressed = compressHandoffSummary(text, maxChars);
  text = compressed.text;
  savedChars += compressed.savedChars || 0;
  savedChars += Math.max(0, original.length - text.length);

  const compressedSummary = buildSessionSummary({
    goal,
    lastAction: options.lastAction,
    touchedFiles: options.touchedFiles,
  });

  const tokenUltra = {
    channel: "goose",
    deltaFrom: deltaState.deltaFrom,
    compressedSummary,
    deltaMode: deltaState.useDelta,
    savedChars,
    maxChars,
  };

  if (workspacePath) {
    recordHandoffSnapshot(workspacePath, {
      handoffId: options.handoffId,
      goal,
      summary: text,
    });
    if (savedChars > 0) {
      recordSavings(workspacePath, savedChars, settings, "goose");
    }
  }

  return {
    text,
    tokenUltra,
    savedChars,
    truncated: text.length < original.length,
    deltaFrom: deltaState.deltaFrom,
    compressedSummary,
  };
}

module.exports = {
  applyTokenUltraToGooseTask,
  isTokenUltraEnabled,
};
