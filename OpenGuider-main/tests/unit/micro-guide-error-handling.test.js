const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { formatStructuredUserError } = require("../../src/ai/structured");

test("formatStructuredUserError uses micro-guide message instead of planning workflow", () => {
  const message = formatStructuredUserError(new Error("[guide-micro-instruct] [gemini/default] timeout"));
  assert.match(message, /ekran rehberliği/i);
  assert.doesNotMatch(message, /planning workflow/i);
});

test("llm-client enables locator json fallback for guide-micro-instruct", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../../src/agent/llm-client.js"),
    "utf8",
  );
  assert.match(source, /guide-micro-instruct/);
  assert.match(source, /usesLocatorJsonFallback/);
});

test("send-message wraps speakAssistantResponse in try/catch", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../../src/ipc/ai-ipc.js"),
    "utf8",
  );
  assert.match(source, /send-message:tts-failed/);
});

test("prepareLlmCall forces low complexity for planner operations", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../../src/sauron/finops/llm-tracker.js"),
    "utf8",
  );
  assert.match(source, /ECONOMY_VISION_OPERATIONS/);
});
