const test = require("node:test");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("url");
const path = require("path");

test("isNoHandlerRegisteredError detects Electron IPC race message", async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, "../../renderer/js/panel/ipc-safe-invoke.js")).href);
  const error = new Error("Error invoking remote method 'get-settings': Error: No handler registered for 'get-settings'");
  assert.equal(mod.isNoHandlerRegisteredError(error), true);
  assert.equal(mod.isNoHandlerRegisteredError(new Error("network fail")), false);
});

test("safeInvoke retries until handler is registered", async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, "../../renderer/js/panel/ipc-safe-invoke.js")).href);
  let attempts = 0;
  const api = {
    invoke: async (channel) => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error(`No handler registered for '${channel}'`);
      }
      return { ok: true, channel };
    },
  };

  const result = await mod.safeInvoke(api, "get-settings");
  assert.equal(attempts, 3);
  assert.deepEqual(result, { ok: true, channel: "get-settings" });
});

test("safeInvoke rethrows non-handler errors immediately", async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, "../../renderer/js/panel/ipc-safe-invoke.js")).href);
  let attempts = 0;
  const api = {
    invoke: async () => {
      attempts += 1;
      throw new Error("permission denied");
    },
  };

  await assert.rejects(
    () => mod.safeInvoke(api, "get-settings"),
    /permission denied/,
  );
  assert.equal(attempts, 1);
});
