const crypto = require("crypto");

const promptCache = new Map();

function hashPromptBlock(text = "") {
  return crypto.createHash("sha256").update(String(text || "")).digest("hex").slice(0, 24);
}

function buildPromptCacheKey(settings = {}) {
  const systemPrompt = String(
    settings.resolvedSystemPrompt
    || settings.systemPromptOverride
    || "",
  ).trim();
  if (!systemPrompt || systemPrompt.length < 120) {
    return null;
  }
  const provider = String(settings.aiProvider || "").trim().toLowerCase();
  const model = String(settings.aiModel || "").trim();
  return `${provider}:${model}:${hashPromptBlock(systemPrompt)}`;
}

function applyPromptCacheToSettings(settings = {}) {
  if (settings.tokenUltraPromptCacheEnabled === false) {
    return settings;
  }
  const key = buildPromptCacheKey(settings);
  if (!key) {
    return settings;
  }
  const provider = String(settings.aiProvider || "").trim().toLowerCase();
  const cached = promptCache.get(key);
  if (cached) {
    return {
      ...settings,
      _tokenUltraPromptCacheHit: true,
      _tokenUltraPromptCacheKey: key,
    };
  }
  promptCache.set(key, { at: Date.now(), provider });
  return {
    ...settings,
    _tokenUltraPromptCacheHit: false,
    _tokenUltraPromptCacheKey: key,
  };
}

function clearPromptCache() {
  promptCache.clear();
}

module.exports = {
  buildPromptCacheKey,
  applyPromptCacheToSettings,
  clearPromptCache,
};
