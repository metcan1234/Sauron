const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");

const {
  PRELOAD_ON_CHANNELS,
  PRELOAD_SEND_CHANNELS,
} = require("../../src/ipc/channel-registry");

test("pipeline-updated is registered for preload listeners", () => {
  assert.equal(PRELOAD_ON_CHANNELS.includes("pipeline-updated"), true);
});

test("code agent events are registered for preload listeners", () => {
  assert.equal(PRELOAD_ON_CHANNELS.includes("code-agent-step-updated"), true);
  assert.equal(PRELOAD_ON_CHANNELS.includes("code-agent-diff-pending"), true);
  assert.equal(PRELOAD_ON_CHANNELS.includes("code-agent-complete"), true);
  assert.equal(PRELOAD_ON_CHANNELS.includes("code-agent-error"), true);
});

test("preload.js uses channel registry allowlists", () => {
  const preloadSource = fs.readFileSync(
    require("path").join(__dirname, "..", "..", "preload.js"),
    "utf8",
  );
  assert.match(preloadSource, /channel-registry/);
  assert.match(preloadSource, /PRELOAD_ON_CHANNELS/);
  assert.match(preloadSource, /PRELOAD_SEND_CHANNELS/);
});

test("preload on/send lists are non-empty", () => {
  assert.ok(PRELOAD_ON_CHANNELS.length > 0);
  assert.ok(PRELOAD_SEND_CHANNELS.length > 0);
});
