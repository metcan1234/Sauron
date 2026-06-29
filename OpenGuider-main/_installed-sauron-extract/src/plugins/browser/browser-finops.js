const { recordLlmUsage } = require("../../sauron/finops/llm-tracker");

async function recordBrowserGoalUsage({ settings, sessionId = "", usage = {} } = {}) {
  if (!settings || !usage) {
    return null;
  }

  const promptTokens = Math.max(0, Number(usage.promptTokens) || 0);
  const completionTokens = Math.max(0, Number(usage.completionTokens) || 0);
  if (promptTokens === 0 && completionTokens === 0) {
    return null;
  }

  return recordLlmUsage({
    settings,
    operation: "browser-goal",
    provider: String(usage.provider || settings.aiProvider || "unknown"),
    model: String(usage.model || settings.aiModel || "default"),
    promptText: "",
    completionText: "",
    providerUsage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
    },
    sessionId: String(sessionId || "").trim(),
  });
}

module.exports = {
  recordBrowserGoalUsage,
};
