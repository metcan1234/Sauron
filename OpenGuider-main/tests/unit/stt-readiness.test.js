const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveSttReadiness, resolveWhisperApiKey } = require("../../src/sauron/stt-readiness");

test("resolveSttReadiness prefers whisper when configured", () => {
  const result = resolveSttReadiness({
    sttProvider: "whisper",
    whisperApiKey: "sk-whisper",
  });
  assert.equal(result.provider, "whisper");
  assert.equal(result.ok, true);
});

test("resolveSttReadiness falls back to openai key for whisper", () => {
  const result = resolveSttReadiness({
    sttProvider: "whisper",
    openaiApiKey: "sk-openai",
  });
  assert.equal(result.provider, "whisper");
  assert.equal(result.ok, true);
  assert.equal(resolveWhisperApiKey({ openaiApiKey: "sk-openai" }), "sk-openai");
});

test("resolveSttReadiness falls back to assemblyai when whisper key missing", () => {
  const result = resolveSttReadiness({
    sttProvider: "whisper",
    assemblyaiApiKey: "aa-key",
  });
  assert.equal(result.provider, "assemblyai");
  assert.equal(result.ok, true);
});

test("resolveSttReadiness reports missing keys", () => {
  const result = resolveSttReadiness({ sttProvider: "whisper" });
  assert.equal(result.ok, false);
  assert.match(result.message, /Whisper|OpenAI/i);
});
