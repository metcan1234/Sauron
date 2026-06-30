const MAX_CLARIFY_OUTPUT_CHARS = 200;
const MAX_CLARIFY_INPUT_CHARS = 1200;
const SKIP_CLARIFY_MAX_CHARS = 120;

const ACTION_VERBS = /\b(fix|add|update|remove|delete|rename|refactor|implement|create|write|change|move|lint|format|import)\b/i;

const {
  getCachedLlmResponse,
  setCachedLlmResponse,
} = require("./finops/llm-response-cache");

function extractHandoffClarifySource(snapshot = {}) {
  const messages = Array.isArray(snapshot.messages) ? snapshot.messages : [];
  const lastUser = [...messages].reverse().find((entry) => entry?.role === "user" && entry?.content);
  if (lastUser?.content) {
    return String(lastUser.content).trim();
  }
  if (snapshot.goalIntent) {
    return String(snapshot.goalIntent).trim();
  }
  if (snapshot.activePlan?.goal) {
    return String(snapshot.activePlan.goal).trim();
  }
  if (snapshot.browserExecution?.goal) {
    return String(snapshot.browserExecution.goal).trim();
  }
  return "";
}

function hasHandoffTaskContext(snapshot = {}, draftTaskText = "") {
  if (String(draftTaskText || "").trim()) {
    return true;
  }
  return Boolean(extractHandoffClarifySource(snapshot));
}

function normalizeClarifyText(text) {
  return String(text || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function clarifyOverlapRatio(a, b) {
  const left = normalizeClarifyText(a);
  const right = normalizeClarifyText(b);
  if (!left || !right) {
    return 0;
  }
  if (left === right) {
    return 1;
  }
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length > right.length ? left : right;
  return longer.includes(shorter) ? shorter.length / longer.length : 0;
}

function shouldSkipClarify(rawText, settings = {}, lastClarify = "") {
  if (settings.finopsCostOptimizerEnabled === false) {
    return false;
  }
  if (settings.finopsClarifySkipEnabled === false) {
    return false;
  }

  const source = String(rawText || "").trim();
  if (!source) {
    return true;
  }

  if (source.length <= SKIP_CLARIFY_MAX_CHARS && ACTION_VERBS.test(source)) {
    return true;
  }

  if (lastClarify && clarifyOverlapRatio(source, lastClarify) >= 0.9) {
    return true;
  }

  return false;
}

async function clarifyHandoffTask({
  rawText,
  settings,
  streamAIResponse,
  signal,
  appLogger,
  lastClarify,
}) {
  const source = String(rawText || "").trim();
  if (!source || typeof streamAIResponse !== "function") {
    return null;
  }

  if (shouldSkipClarify(source, settings, lastClarify)) {
    const direct = source.length > MAX_CLARIFY_OUTPUT_CHARS
      ? `${source.slice(0, MAX_CLARIFY_OUTPUT_CHARS - 1)}…`
      : source;
    appLogger?.info?.("handoff-task-clarify", { ok: true, skipped: true, charCount: direct.length });
    return direct;
  }

  const clipped = source.length > MAX_CLARIFY_INPUT_CHARS
    ? `${source.slice(0, MAX_CLARIFY_INPUT_CHARS)}…`
    : source;

  const promptText = [
    "Kullanıcının ham mesajını Cline için net, eyleme dönük 1-2 cümlelik bir görev özetine çevir.",
    "Aynı dili kullan (Türkçe ise Türkçe). Sadece özeti yaz, başka açıklama ekleme.",
    "Maksimum 200 karakter.",
    "",
    `Ham mesaj: ${clipped}`,
  ].join("\n");

  const cached = getCachedLlmResponse("handoff-task-clarify", promptText);
  if (cached) {
    appLogger?.info?.("handoff-task-clarify", { ok: true, cached: true, charCount: cached.length });
    return cached;
  }

  try {
    const response = await streamAIResponse({
      text: promptText,
      images: [],
      history: [],
      settings,
      operation: "handoff-task-clarify",
      complexityHint: "low",
      signal,
    });

    const summary = String(response || "").trim().replace(/\s+/g, " ");
    if (!summary) {
      appLogger?.info?.("handoff-task-clarify", { ok: false, reason: "empty_response" });
      return null;
    }

    const trimmed = summary.length > MAX_CLARIFY_OUTPUT_CHARS
      ? `${summary.slice(0, MAX_CLARIFY_OUTPUT_CHARS - 1)}…`
      : summary;

    setCachedLlmResponse("handoff-task-clarify", promptText, trimmed);
    appLogger?.info?.("handoff-task-clarify", { ok: true, charCount: trimmed.length });
    return trimmed;
  } catch (error) {
    appLogger?.warn?.("handoff-task-clarify", {
      ok: false,
      reason: "error",
      error: error?.message || String(error),
    });
    return null;
  }
}

module.exports = {
  MAX_CLARIFY_OUTPUT_CHARS,
  SKIP_CLARIFY_MAX_CHARS,
  extractHandoffClarifySource,
  hasHandoffTaskContext,
  shouldSkipClarify,
  clarifyHandoffTask,
};
