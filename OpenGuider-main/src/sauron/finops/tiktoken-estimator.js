const CHANNELS = ["core", "workspace", "goose", "gamedev"];

function countWords(text) {
  if (!text || typeof text !== "string") return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

function estimateTokensLite(text, modelHint = "") {
  const normalized = String(text || "");
  if (!normalized.trim()) {
    return 0;
  }

  const hint = String(modelHint || "").toLowerCase();
  const wordEstimate = Math.ceil(countWords(normalized) * 1.3);
  const charEstimate = Math.ceil(normalized.length / 4);

  if (hint.includes("gemini") || hint.includes("gpt") || hint.includes("claude")) {
    return Math.max(wordEstimate, charEstimate);
  }

  return Math.round((wordEstimate * 0.55) + (charEstimate * 0.45));
}

function inferChannel(record = {}) {
  const explicit = String(record.channel || "").trim().toLowerCase();
  if (CHANNELS.includes(explicit)) {
    return explicit;
  }

  const operation = String(record.operation || "");
  const source = String(record.source || "").trim().toLowerCase();

  if (operation.startsWith("goose-session-") || source === "goose") {
    return "goose";
  }
  if (operation.startsWith("gamedev-") || source === "gamedev" || source === "sauron-gamedev") {
    return "gamedev";
  }
  if (operation === "cline-task" || operation === "cline-task-readonly" || source === "cline") {
    return "workspace";
  }
  if (
    operation === "workspace-handoff"
    || operation === "scaffold-web-project"
    || operation.startsWith("build-pipeline-")
  ) {
    return "workspace";
  }
  if (operation === "token-ultra-saved") {
    return "core";
  }
  return "core";
}

function emptyChannelStats() {
  return {
    promptTokens: 0,
    completionTokens: 0,
    costTl: 0,
    entryCount: 0,
  };
}

function summarizeByChannel(entries = []) {
  const byChannel = Object.fromEntries(CHANNELS.map((id) => [id, emptyChannelStats()]));

  for (const entry of entries) {
    const channel = inferChannel(entry);
    const bucket = byChannel[channel] || emptyChannelStats();
    bucket.entryCount += 1;
    bucket.promptTokens += Math.max(0, Number(entry.promptTokens) || 0);
    bucket.completionTokens += Math.max(0, Number(entry.completionTokens) || 0);
    bucket.costTl += Math.max(0, Number(entry.costTl) || 0);
    byChannel[channel] = bucket;
  }

  for (const channel of CHANNELS) {
    byChannel[channel].costTl = Number(byChannel[channel].costTl.toFixed(6));
  }

  return byChannel;
}

module.exports = {
  CHANNELS,
  estimateTokensLite,
  inferChannel,
  summarizeByChannel,
};
