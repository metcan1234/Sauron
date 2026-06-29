const { estimateTokens } = require("./token-counter");

function estimateHandoffPayloadChars(payload = {}) {
  const summary = String(payload.taskSummary || "").trim();
  const goal = String(payload.goal || "").trim();
  return summary.length + goal.length;
}

function estimateHandoffPayloadTokens(payload = {}) {
  const chars = estimateHandoffPayloadChars(payload);
  return estimateTokens("x".repeat(chars));
}

function rollupByOperation(entries = []) {
  const rollup = {};
  for (const entry of entries) {
    const key = String(entry.operation || "unknown").trim() || "unknown";
    if (!rollup[key]) {
      rollup[key] = { count: 0, costTl: 0, promptTokens: 0, completionTokens: 0 };
    }
    rollup[key].count += 1;
    rollup[key].costTl += Number(entry.costTl) || 0;
    rollup[key].promptTokens += Number(entry.promptTokens) || 0;
    rollup[key].completionTokens += Number(entry.completionTokens) || 0;
  }
  return rollup;
}

function compareHandoffPayloadSize(beforePayload, afterPayload) {
  const before = estimateHandoffPayloadChars(beforePayload);
  const after = estimateHandoffPayloadChars(afterPayload);
  const saved = Math.max(0, before - after);
  const ratio = before > 0 ? saved / before : 0;
  return { before, after, saved, savingsRatio: ratio };
}

module.exports = {
  estimateHandoffPayloadChars,
  estimateHandoffPayloadTokens,
  rollupByOperation,
  compareHandoffPayloadSize,
};
