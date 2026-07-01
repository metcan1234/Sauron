const test = require("node:test");
const assert = require("node:assert/strict");

const {
  PANEL_COMPRESS_THRESHOLD,
  PANEL_KEEP_RECENT,
  collectOlderConversationalBatch,
  buildCompactPanelHistory,
} = require("../../src/session/panel-context-compactor");

function makeMessages(count) {
  const messages = [];
  for (let i = 0; i < count; i += 1) {
    messages.push({ role: i % 2 === 0 ? "user" : "assistant", content: `msg-${i}` });
  }
  return messages;
}

test("panel compactor keeps last 8 conversational messages", () => {
  const messages = makeMessages(20);
  const batch = collectOlderConversationalBatch(messages, PANEL_KEEP_RECENT);
  assert.equal(batch.length, 20 - PANEL_KEEP_RECENT);
  const compacted = buildCompactPanelHistory(messages, "özet metin", PANEL_KEEP_RECENT);
  const recentTurns = compacted.filter((entry) => !String(entry.content || "").startsWith("[Önceki panel"));
  assert.equal(recentTurns.length, PANEL_KEEP_RECENT);
  assert.equal(recentTurns[recentTurns.length - 1].content, "msg-19");
  assert.ok(compacted[0].content.includes("özet metin"));
});

test("panel compactor threshold is 16 messages", () => {
  assert.equal(PANEL_COMPRESS_THRESHOLD, 16);
  assert.equal(PANEL_KEEP_RECENT, 8);
});
