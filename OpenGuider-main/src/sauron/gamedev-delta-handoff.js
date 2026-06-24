const { shouldUseDeltaHandoff, updateHandoffContextCache } = require("./handoff-context-cache");

function resolveGamedevDeltaHandoff(settings, workspacePath, goalText) {
  const useDelta = shouldUseDeltaHandoff(settings, workspacePath, goalText);
  return {
    deltaMode: useDelta,
    hint: useDelta
      ? "Delta handoff: önceki oturumla aynı hedef — workspace tree tekrar gönderilmeyecek."
      : "",
  };
}

function recordGamedevHandoffContext(workspacePath, goalText, treeHint = "") {
  if (!workspacePath || !goalText) {
    return;
  }
  updateHandoffContextCache(workspacePath, {
    lastGoal: goalText,
    lastTreeHint: treeHint || `Game dev session: ${String(goalText).slice(0, 80)}`,
  });
}

module.exports = {
  resolveGamedevDeltaHandoff,
  recordGamedevHandoffContext,
};
