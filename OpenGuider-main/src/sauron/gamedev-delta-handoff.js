const { shouldUseDeltaHandoff, updateHandoffContextCache } = require("./handoff-context-cache");
const { hashBriefText } = require("./gamedev-prompt-compiler");
const { buildSceneDeltaHint } = require("./token-ultra/scene-delta");

function resolveGamedevDeltaHandoff(settings, workspacePath, goalText, briefHash = null) {
  const briefKey = briefHash ? `brief:${briefHash}` : goalText;
  const useDelta = shouldUseDeltaHandoff(settings, workspacePath, briefKey);
  const sceneDelta = buildSceneDeltaHint(workspacePath, settings);
  const hints = [];
  if (useDelta) {
    hints.push("Delta handoff: önceki oturumla aynı hedef — workspace tree tekrar gönderilmeyecek.");
  }
  if (sceneDelta.hint) {
    hints.push(sceneDelta.hint);
  }
  return {
    deltaMode: useDelta || sceneDelta.deltaMode,
    hint: hints.join("\n"),
    sceneDeltaMode: sceneDelta.deltaMode,
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
