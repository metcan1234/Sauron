const { MEMORY_CONTEXT_RECENT, MEMORY_SUMMARY_ROLE } = require("./memory-chat-constants");

function isConversationalMessage(message) {
  return message?.role === "user" || message?.role === "assistant";
}

function countConversationalMessages(messages) {
  return (Array.isArray(messages) ? messages : []).filter(isConversationalMessage).length;
}

function buildMemoryChatHistory(messages, options = {}) {
  const maxRecent = Number(options.maxRecent) > 0
    ? Number(options.maxRecent)
    : MEMORY_CONTEXT_RECENT;
  const all = Array.isArray(messages) ? messages : [];
  const summaryEntry = all.find((entry) => entry?.role === MEMORY_SUMMARY_ROLE);
  const conversational = all.filter(isConversationalMessage);
  const recentTurns = conversational.slice(-maxRecent);

  const history = [];
  if (summaryEntry?.content) {
    history.push({
      role: "user",
      content: `[Geçmiş konuşma özeti]\n${String(summaryEntry.content).trim()}`,
    });
  }

  for (const entry of recentTurns) {
    history.push({
      role: entry.role,
      content: String(entry.content || ""),
    });
  }

  return history;
}

module.exports = {
  isConversationalMessage,
  countConversationalMessages,
  buildMemoryChatHistory,
};
