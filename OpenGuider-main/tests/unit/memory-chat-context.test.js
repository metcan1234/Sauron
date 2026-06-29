const test = require("node:test");
const assert = require("node:assert/strict");

const { buildMemoryChatHistory, countConversationalMessages } = require("../../src/session/memory-chat-context");

test("buildMemoryChatHistory prepends summary and keeps recent turns", () => {
  const messages = [
    { role: "memory-summary", content: "Kullanıcı 70 kg hedefledi." },
    ...Array.from({ length: 25 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      content: `mesaj-${index}`,
    })),
  ];

  const history = buildMemoryChatHistory(messages, { maxRecent: 5 });
  assert.equal(history.length, 6);
  assert.match(history[0].content, /Geçmiş konuşma özeti/);
  assert.match(history[0].content, /70 kg/);
  assert.equal(history[1].content, "mesaj-20");
  assert.equal(history[5].content, "mesaj-24");
});

test("buildMemoryChatHistory works without summary", () => {
  const messages = [
    { role: "user", content: "merhaba" },
    { role: "assistant", content: "selam" },
  ];
  const history = buildMemoryChatHistory(messages);
  assert.equal(history.length, 2);
  assert.equal(history[0].role, "user");
});

test("countConversationalMessages ignores memory-summary", () => {
  const count = countConversationalMessages([
    { role: "memory-summary", content: "ozet" },
    { role: "user", content: "a" },
    { role: "assistant", content: "b" },
  ]);
  assert.equal(count, 2);
});
