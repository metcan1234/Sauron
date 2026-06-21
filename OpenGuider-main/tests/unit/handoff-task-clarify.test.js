const test = require("node:test");
const assert = require("node:assert/strict");
const {
  clarifyHandoffTask,
  extractHandoffClarifySource,
} = require("../../src/sauron/handoff-task-clarify");

test("extractHandoffClarifySource prefers last user message", () => {
  const source = extractHandoffClarifySource({
    goalIntent: "fallback goal",
    messages: [
      { role: "user", content: "login sayfasini duzelt" },
      { role: "assistant", content: "tamam" },
    ],
  });
  assert.equal(source, "login sayfasini duzelt");
});

test("clarifyHandoffTask returns null when streamAIResponse throws", async () => {
  const result = await clarifyHandoffTask({
    rawText: "bu hatayi duzelt",
    settings: {},
    streamAIResponse: async () => {
      throw new Error("model down");
    },
    appLogger: { warn: () => {}, info: () => {} },
  });
  assert.equal(result, null);
});

test("clarifyHandoffTask trims successful summary", async () => {
  const result = await clarifyHandoffTask({
    rawText: "su dosyada bug var",
    settings: {},
    streamAIResponse: async () => "  Auth modulundeki login hatasini duzelt.  ",
    appLogger: { warn: () => {}, info: () => {} },
  });
  assert.match(result, /login hatasini duzelt/i);
});
