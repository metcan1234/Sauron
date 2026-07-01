const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildPromptCacheKey,
  applyPromptCacheToSettings,
  clearPromptCache,
} = require("../../src/sauron/token-ultra/prompt-cache");

test("prompt cache no-op for short system prompt", () => {
  clearPromptCache();
  const settings = { aiProvider: "gemini", aiModel: "gemini-2.5-flash" };
  const result = applyPromptCacheToSettings(settings);
  assert.equal(result._tokenUltraPromptCacheKey, undefined);
});

test("prompt cache tracks gemini-compatible system block", () => {
  clearPromptCache();
  const longPrompt = `system rules ${"x".repeat(200)}`;
  const settings = {
    aiProvider: "gemini",
    aiModel: "gemini-2.5-flash",
    resolvedSystemPrompt: longPrompt,
  };
  const first = applyPromptCacheToSettings(settings);
  assert.ok(first._tokenUltraPromptCacheKey);
  assert.equal(first._tokenUltraPromptCacheHit, false);
  const second = applyPromptCacheToSettings(settings);
  assert.equal(second._tokenUltraPromptCacheHit, true);
  assert.equal(buildPromptCacheKey(settings), first._tokenUltraPromptCacheKey);
});

test("prompt cache disabled is no-op", () => {
  clearPromptCache();
  const settings = {
    tokenUltraPromptCacheEnabled: false,
    aiProvider: "openai",
    aiModel: "gpt-4o-mini",
    resolvedSystemPrompt: `rules ${"y".repeat(200)}`,
  };
  const result = applyPromptCacheToSettings(settings);
  assert.equal(result._tokenUltraPromptCacheKey, undefined);
});
