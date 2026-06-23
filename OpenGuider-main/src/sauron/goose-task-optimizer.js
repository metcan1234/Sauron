const { getGooseModeProfile } = require("./goose-mode-profiles");

const DEFAULT_TASK_MAX_CHARS = 500;
const WORKSPACE_HINT_MAX_CHARS = 120;

function normalizeWhitespace(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function countWords(text) {
  return String(text || "").split(/\s+/).filter(Boolean).length;
}

function optimizeGooseTaskText(taskText, options = {}) {
  const maxChars = Number(options.maxChars) || DEFAULT_TASK_MAX_CHARS;
  let text = normalizeWhitespace(taskText);
  if (!text) {
    return { text: "", wordCount: 0, truncated: false };
  }

  if (text.length <= maxChars) {
    return { text, wordCount: countWords(text), truncated: false };
  }

  const words = text.split(/\s+/).filter(Boolean);
  let result = "";
  for (const word of words) {
    const next = result ? `${result} ${word}` : word;
    if (next.length > maxChars) {
      break;
    }
    result = next;
  }

  if (!result) {
    result = text.slice(0, maxChars).trim();
  }

  return {
    text: result,
    wordCount: countWords(result),
    truncated: result.length < text.length,
  };
}

function getWorkspaceHintLine(workspacePath) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return "";
  }
  const parts = resolved.replace(/\\/g, "/").split("/").filter(Boolean);
  const leaf = parts[parts.length - 1] || resolved;
  const hint = `Proje kökü: ${leaf}`;
  if (hint.length <= WORKSPACE_HINT_MAX_CHARS) {
    return hint;
  }
  return hint.slice(0, WORKSPACE_HINT_MAX_CHARS - 1).trimEnd() + "…";
}

function truncateSystemInstructions(text, maxChars) {
  const limit = Number(maxChars) || 0;
  const content = String(text || "").trim();
  if (!content || limit <= 0 || content.length <= limit) {
    return content;
  }
  return `${content.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function buildModeSystemInstructions(baseInstructions, mode, workspacePath) {
  const profile = getGooseModeProfile(mode);
  const base = String(baseInstructions || "").trim();
  const hint = getWorkspaceHintLine(workspacePath);
  const parts = [base, profile.instructionSuffix];
  if (hint) {
    parts.push(`## Workspace\n- ${hint}`);
  }
  const combined = parts.filter(Boolean).join("\n\n");
  return truncateSystemInstructions(combined, profile.systemCharLimit);
}

module.exports = {
  DEFAULT_TASK_MAX_CHARS,
  WORKSPACE_HINT_MAX_CHARS,
  normalizeWhitespace,
  countWords,
  optimizeGooseTaskText,
  getWorkspaceHintLine,
  truncateSystemInstructions,
  buildModeSystemInstructions,
};
