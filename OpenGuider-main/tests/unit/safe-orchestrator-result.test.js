const test = require("node:test");
const assert = require("node:assert/strict");
const { safeHandleOrchestratorResult } = require("../../src/orchestrator/safe-handle-orchestrator-result");

test("safeHandleOrchestratorResult returns original result when post-process throws", async () => {
  const original = { assistantMessage: "ok", session: { id: "s1" } };
  const handled = await safeHandleOrchestratorResult(
    async () => {
      throw new Error("tts failed");
    },
    original,
    {},
    null,
    { channel: "test" },
  );
  assert.deepEqual(handled, original);
});

test("safeHandleOrchestratorResult returns handler output on success", async () => {
  const original = { assistantMessage: "ok" };
  const handled = await safeHandleOrchestratorResult(
    async () => ({ assistantMessage: "wrapped" }),
    original,
    {},
    null,
  );
  assert.equal(handled.assistantMessage, "wrapped");
});
