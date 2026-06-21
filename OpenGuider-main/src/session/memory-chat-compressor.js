const {
  MEMORY_COMPRESS_THRESHOLD,
  MEMORY_COMPRESS_BATCH,
  MEMORY_SUMMARY_ROLE,
} = require("./memory-chat-constants");
const { countConversationalMessages, isConversationalMessage } = require("./memory-chat-context");

function collectOldestConversationalBatch(messages, batchSize) {
  const batch = [];
  for (const entry of messages) {
    if (!isConversationalMessage(entry)) {
      continue;
    }
    batch.push(entry);
    if (batch.length >= batchSize) {
      break;
    }
  }
  return batch;
}

function formatTranscriptForSummary(messages) {
  return messages.map((entry) => {
    const speaker = entry.role === "user" ? "Kullanıcı" : "Sauron";
    return `${speaker}: ${String(entry.content || "").trim()}`;
  }).join("\n");
}

async function maybeCompressMemoryChat({
  store,
  sessionManager,
  streamAIResponse,
  getRuntimeSettings,
  persistActiveSession,
  broadcastSessionSnapshot,
  getActiveChatSessionRecord,
  appLogger,
}) {
  try {
    const activeSession = getActiveChatSessionRecord?.(store);
    if (!activeSession?.isMemoryChat || !sessionManager) {
      return;
    }

    const messages = sessionManager.getSnapshot()?.messages || [];
    if (countConversationalMessages(messages) < MEMORY_COMPRESS_THRESHOLD) {
      return;
    }

    const batch = collectOldestConversationalBatch(messages, MEMORY_COMPRESS_BATCH);
    if (batch.length < MEMORY_COMPRESS_BATCH) {
      return;
    }

    const settings = await getRuntimeSettings();
    const summaryText = await streamAIResponse({
      text: [
        "Aşağıdaki sohbeti 3-6 cümleyle özetle.",
        "Tarih, sayılar, hedefler ve kullanıcı tercihleri korunsun.",
        "",
        formatTranscriptForSummary(batch),
      ].join("\n"),
      images: [],
      history: [],
      settings,
      operation: "memory-chat-summary",
      complexityHint: "low",
      sessionId: sessionManager.getSnapshot()?.sessionId || "",
    });

    const trimmedSummary = String(summaryText || "").trim();
    if (!trimmedSummary) {
      return;
    }

    const applied = sessionManager.applyMemoryCompression({
      summaryText: trimmedSummary,
      removeCount: batch.length,
    });
    if (!applied) {
      return;
    }

    persistActiveSession(store, sessionManager.getSnapshot());
    broadcastSessionSnapshot(sessionManager.getSnapshot());
  } catch (error) {
    appLogger?.warn?.("memory-chat-compress-failed", {
      error: error?.message || error,
    });
  }
}

module.exports = {
  collectOldestConversationalBatch,
  formatTranscriptForSummary,
  maybeCompressMemoryChat,
  MEMORY_SUMMARY_ROLE,
};
