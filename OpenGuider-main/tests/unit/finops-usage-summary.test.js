const test = require("node:test");
const assert = require("node:assert/strict");

const {
  dedupeUsageEntries,
  summarizeBreakdown,
} = require("../../src/sauron/finops/usage-tracker");

test("dedupeUsageEntries keeps latest recordId entry", () => {
  const entries = [
    { recordId: "cline-task:1", costTl: 1 },
    { recordId: "cline-task:1", costTl: 2 },
    { operation: "chat", costTl: 3 },
  ];
  const deduped = dedupeUsageEntries(entries);
  assert.equal(deduped.length, 2);
  const cline = deduped.find((entry) => entry.recordId === "cline-task:1");
  assert.equal(cline.costTl, 2);
});

test("summarizeBreakdown groups by operation and provider", () => {
  const { byOperation, byProvider } = summarizeBreakdown([
    { operation: "chat", provider: "openai", costTl: 1.5 },
    { operation: "cline-task", provider: "anthropic", costTl: 2.5 },
    { operation: "chat", provider: "openai", costTl: 0.5 },
  ]);
  assert.equal(byOperation.chat, 2);
  assert.equal(byOperation["cline-task"], 2.5);
  assert.equal(byProvider.openai, 2);
  assert.equal(byProvider.anthropic, 2.5);
});
