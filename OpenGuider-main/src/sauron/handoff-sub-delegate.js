const { truncateText } = require("./token-ultra/local-summarizer");

function buildSubHandoffHint({ parentGoal = "", researchSummary = "", delegateTo = "cline" } = {}) {
  const goal = truncateText(String(parentGoal || "").trim(), 120);
  const summary = truncateText(String(researchSummary || "").trim(), 280);
  if (!goal && !summary) {
    return "";
  }
  const target = delegateTo === "goose" ? "Goose terminal" : "Cline workspace";
  const lines = [
    "Sub-handoff delegation:",
    `- Parent goal: ${goal || "(none)"}`,
    `- Research summary: ${summary || "(none)"}`,
    `- Execute in: ${target}`,
    "- Do not re-run full discovery; use pointers above.",
  ];
  return lines.join("\n");
}

function attachSubDelegateToHandoff(payload, options = {}) {
  if (!options.enabled && options.researchSummary == null) {
    return payload;
  }
  const hint = buildSubHandoffHint({
    parentGoal: payload?.goal,
    researchSummary: options.researchSummary,
    delegateTo: options.delegateTo,
  });
  if (!hint) {
    return payload;
  }
  return {
    ...payload,
    subHandoff: {
      delegateTo: options.delegateTo || "cline",
      researchSummary: truncateText(String(options.researchSummary || ""), 280),
    },
    taskSummary: `${hint}\n\n${String(payload?.taskSummary || "").trim()}`.trim(),
  };
}

module.exports = {
  buildSubHandoffHint,
  attachSubDelegateToHandoff,
};
