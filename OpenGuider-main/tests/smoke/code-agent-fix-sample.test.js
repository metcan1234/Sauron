const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createCheckpoint, rollbackCheckpoint } = require("../../src/code-agent/code-checkpoint");

test("smoke: checkpoint rollback restores sample fixture file", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-smoke-"));
  const rel = "fix-sample.txt";
  const abs = path.join(workspace, rel);
  fs.writeFileSync(abs, "before-agent", "utf8");

  const created = createCheckpoint(workspace, { label: "smoke", files: [rel] });
  assert.equal(created.ok, true);

  fs.writeFileSync(abs, "after-agent", "utf8");
  const rolled = rollbackCheckpoint(workspace, created.checkpoint.id);
  assert.equal(rolled.ok, true);
  assert.equal(fs.readFileSync(abs, "utf8"), "before-agent");
});
