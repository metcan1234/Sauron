const { countConversationalMessages, isConversationalMessage } = require("./memory-chat-context");
const { applyExtractProviderPreference } = require("../sauron/token-ultra/token-ultra-v3-config");

const PANEL_COMPRESS_THRESHOLD = 16;
const PANEL_KEEP_RECENT = 8;
const PANEL_SUMMARY_ROLE = "panel-context-summary";

function collectOlderConversationalBatch(messages, keepRecent) {
  const conversational = (Array.isArray(messages) ? messages : []).filter(isConversationalMessage);
  if (conversational.length <= keepRecent) {
    return [];
  }
  return conversational.slice(0, conversational.length - keepRecent);
}

function formatTranscriptForSummary(messages) {
  return messages.map((entry) => {
    const speaker = entry.role === "user" ? "Kullanıcı" : "Asistan";
    return `${speaker}: ${String(entry.content || "").trim()}`;
  }).join("\n");
}

function buildCompactPanelHistory(messages, summaryText, keepRecent = PANEL_KEEP_RECENT) {
  const conversational = (Array.isArray(messages) ? messages : []).filter(isConversationalMessage);
  const recent = conversational.slice(-keepRecent);
  const history = [];
  const trimmedSummary = String(summaryText || "").trim();
  if (trimmedSummary) {
    history.push({
      role: "user",
      content: `[Önceki panel konuşması özeti]\n${trimmedSummary}`,
    });
  }
  for (const entry of recent) {
    history.push({
      role: entry.role,
      content: String(entry.content || ""),
    });
  }
  return history;
}

async function maybeCompactPanelHistoryForRequest({
  messages = [],
  settings = {},
  isMemoryChat = false,
  streamAIResponse,
  signal,
  sessionId = "",
}) {
  if (isMemoryChat || settings.tokenUltraPanelContextSummary === false) {
    return null;
  }
  const conversationalCount = countConversationalMessages(messages);
  if (conversationalCount < PANEL_COMPRESS_THRESHOLD) {
    return null;
  }
  const batch = collectOlderConversationalBatch(messages, PANEL_KEEP_RECENT);
  if (!batch.length) {
    return null;
  }

  const extractSettings = applyExtractProviderPreference(settings);
  const runSummary = async (runtimeSettings) => streamAIResponse({
    text: [
      "Aşağıdaki Luna/Hiri panel sohbetini 4-8 cümleyle özetle.",
      "Kullanıcı tercihleri, açık görevler ve kararlar korunsun.",
      "",
      formatTranscriptForSummary(batch),
    ].join("\n"),
    images: [],
    history: [],
    settings: runtimeSettings,
    signal,
    sessionId: sessionId || "panel-context",
    operation: "panel-context-summary",
    complexityHint: "low",
  });

  let summaryText = "";
  try {
    summaryText = await runSummary(extractSettings);
  } catch (ollamaError) {
    if (extractSettings._tokenUltraExtractProvider === "ollama") {
      summaryText = await runSummary(settings);
    } else {
      throw ollamaError;
    }
  }

  const trimmedSummary = String(summaryText || "").trim();
  if (!trimmedSummary) {
    return null;
  }

  return buildCompactPanelHistory(messages, trimmedSummary, PANEL_KEEP_RECENT);
}

module.exports = {
  PANEL_COMPRESS_THRESHOLD,
  PANEL_KEEP_RECENT,
  PANEL_SUMMARY_ROLE,
  collectOlderConversationalBatch,
  buildCompactPanelHistory,
  maybeCompactPanelHistoryForRequest,
};
