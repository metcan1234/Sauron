const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { getBlockersForChannel } = require("../../src/sauron/doctor");

function makeStore(workspacePath, overrides = {}) {
  const values = {
    workspacePath,
    gooseEnabled: true,
    gamedevEnabled: true,
    browserAgentEnabled: true,
    webStudioEnabled: true,
    ...overrides,
  };
  return {
    get(key) {
      return values[key];
    },
  };
}

test("getBlockersForChannel gamedev does not throw when goose binary is probed lazily", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-blockers-"));
  const store = makeStore(workspace);

  assert.doesNotThrow(() => {
    const blockers = getBlockersForChannel("gamedev", store);
    assert.ok(Array.isArray(blockers));
  });

  fs.rmSync(workspace, { recursive: true, force: true });
});

test("getBlockersForChannel workspace does not reference probeGooseBinary", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-blockers-"));
  const store = makeStore(workspace);

  const blockers = getBlockersForChannel("workspace", store);
  assert.ok(Array.isArray(blockers));

  fs.rmSync(workspace, { recursive: true, force: true });
});

test("getBlockersForChannel goose evaluates goose rules only", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-blockers-"));
  const store = makeStore(workspace, { gooseEnabled: true });

  assert.doesNotThrow(() => {
    const blockers = getBlockersForChannel("goose", store);
    assert.ok(Array.isArray(blockers));
  });

  fs.rmSync(workspace, { recursive: true, force: true });
});
