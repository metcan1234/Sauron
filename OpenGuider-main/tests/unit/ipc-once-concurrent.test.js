const test = require("node:test");
const assert = require("node:assert/strict");
const {
  wrapOnceConcurrent,
  resetOnceConcurrentForTests,
  isChannelInFlight,
} = require("../../src/ipc/ipc-once-concurrent");

test("wrapOnceConcurrent rejects overlapping invocations", async () => {
  resetOnceConcurrentForTests();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });

  const handler = wrapOnceConcurrent("demo-channel", async () => {
    await gate;
    return { ok: true, value: 42 };
  });

  const first = handler({}, "a");
  assert.equal(isChannelInFlight("demo-channel"), true);

  const second = await handler({}, "b");
  assert.deepEqual(second, { ok: false, error: "already-in-progress", skipped: true });

  release();
  const firstResult = await first;
  assert.deepEqual(firstResult, { ok: true, value: 42 });
  assert.equal(isChannelInFlight("demo-channel"), false);
});

test("wrapOnceConcurrent allows sequential invocations", async () => {
  resetOnceConcurrentForTests();
  let calls = 0;
  const handler = wrapOnceConcurrent("demo-seq", async () => {
    calls += 1;
    return { ok: true, calls };
  });

  const first = await handler();
  const second = await handler();
  assert.equal(first.calls, 1);
  assert.equal(second.calls, 2);
});
