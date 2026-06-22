const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { resolveSafePath } = require("../../src/code-agent/workspace-sandbox");

test("resolveSafePath allows paths inside workspace", () => {
  const ws = path.resolve("/tmp/sauron-ws");
  const resolved = resolveSafePath(ws, "src/index.js");
  assert.equal(resolved, path.join(ws, "src", "index.js"));
});

test("resolveSafePath rejects traversal outside workspace", () => {
  const ws = path.resolve("/tmp/sauron-ws");
  assert.throws(() => resolveSafePath(ws, "../../../etc/passwd"), /outside workspace/i);
});

test("resolveSafePath rejects empty workspace", () => {
  assert.throws(() => resolveSafePath("", "file.js"), /workspace path/i);
});
