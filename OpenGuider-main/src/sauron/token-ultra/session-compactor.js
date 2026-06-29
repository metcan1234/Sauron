const { truncateText } = require("./local-summarizer");

function compactSessionMessages(messages = [], maxChars = 800) {
  const items = Array.isArray(messages) ? messages : [];
  if (!items.length) {
    return "";
  }
  const lines = items.slice(-6).map((entry) => {
    const role = entry?.role === "user" ? "U" : "A";
    const content = truncateText(entry?.content || "", 120);
    return `${role}: ${content}`;
  });
  return truncateText(lines.join(" | "), maxChars);
}

function buildSessionSummary({ goal, lastAction, touchedFiles = [] } = {}, maxChars = 200) {
  const parts = [];
  if (goal) {
    parts.push(`Goal: ${truncateText(goal, 80)}`);
  }
  if (lastAction) {
    parts.push(`Last: ${truncateText(lastAction, 60)}`);
  }
  if (touchedFiles.length) {
    parts.push(`Files: ${touchedFiles.slice(0, 3).join(", ")}`);
  }
  return truncateText(parts.join(" | "), maxChars);
}

function compactPhaseBoundary({ phase, totalPhases, goal, touchedFiles = [], lastSummary = "" } = {}, maxChars = 320) {
  const parts = [
    `Phase ${phase || "?"}${totalPhases ? `/${totalPhases}` : ""} complete`,
  ];
  if (goal) {
    parts.push(`Goal: ${truncateText(goal, 90)}`);
  }
  if (lastSummary) {
    parts.push(`Summary: ${truncateText(lastSummary, 120)}`);
  }
  if (touchedFiles.length) {
    parts.push(`Touched: ${touchedFiles.slice(0, 4).join(", ")}`);
  }
  return truncateText(parts.join(" | "), maxChars);
}

module.exports = {
  compactSessionMessages,
  buildSessionSummary,
  compactPhaseBoundary,
};
