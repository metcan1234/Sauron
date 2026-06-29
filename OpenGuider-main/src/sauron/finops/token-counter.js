const { estimateTokensLite } = require("./tiktoken-estimator");

function countWords(text) {
  if (!text || typeof text !== "string") return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

function estimateTokens(text, modelHint = "") {
  return estimateTokensLite(text, modelHint);
}

function normalizeProviderUsage(providerUsage) {
  if (!providerUsage || typeof providerUsage !== "object") {
    return null;
  }

  const promptTokens = pickNumber(
    providerUsage.prompt_tokens,
    providerUsage.promptTokens,
    providerUsage.input_tokens,
    providerUsage.inputTokens,
  );
  const completionTokens = pickNumber(
    providerUsage.completion_tokens,
    providerUsage.completionTokens,
    providerUsage.output_tokens,
    providerUsage.outputTokens,
  );

  if (promptTokens == null && completionTokens == null) {
    return null;
  }

  return {
    promptTokens: promptTokens ?? 0,
    completionTokens: completionTokens ?? 0,
  };
}

function pickNumber(...values) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function resolveTokenCounts({ promptText = "", completionText = "", providerUsage, modelHint = "" } = {}) {
  const normalized = normalizeProviderUsage(providerUsage);
  if (normalized) {
    return normalized;
  }

  return {
    promptTokens: estimateTokens(promptText, modelHint),
    completionTokens: estimateTokens(completionText, modelHint),
  };
}

function extractOpenAICompatibleUsage(parsed) {
  return normalizeProviderUsage(parsed?.usage);
}

function extractClaudeUsage(parsed) {
  const usage = parsed?.usage || parsed?.message?.usage || parsed?.delta?.usage;
  if (!usage) return null;
  return normalizeProviderUsage({
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
  });
}

function extractGeminiUsage(parsed) {
  const meta = parsed?.usageMetadata;
  if (!meta) return null;
  return normalizeProviderUsage({
    prompt_tokens: meta.promptTokenCount,
    completion_tokens: meta.candidatesTokenCount,
  });
}

function captureUsageFromStreamEvent(parsed, provider) {
  if (!parsed || typeof parsed !== "object") return null;

  switch (provider) {
    case "claude":
      return extractClaudeUsage(parsed);
    case "gemini":
      return extractGeminiUsage(parsed);
    case "openai":
    case "openrouter":
    case "groq":
      return extractOpenAICompatibleUsage(parsed);
    default:
      return extractOpenAICompatibleUsage(parsed) || extractClaudeUsage(parsed) || extractGeminiUsage(parsed);
  }
}

module.exports = {
  countWords,
  estimateTokens,
  normalizeProviderUsage,
  resolveTokenCounts,
  captureUsageFromStreamEvent,
};
