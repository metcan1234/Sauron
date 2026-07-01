const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  createCheckpoint,
  listCheckpoints,
  rollbackCheckpoint,
} = require("../../src/code-agent/code-checkpoint");

test("code checkpoint create list rollback roundtrip", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-cp-"));
  const rel = "src/example.txt";
  const abs = path.join(workspace, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, "v1", "utf8");

  const created = createCheckpoint(workspace, { label: "test", files: [rel] });
  assert.equal(created.ok, true);
  assert.ok(created.checkpoint?.id);

  fs.writeFileSync(abs, "v2", "utf8");
  assert.equal(fs.readFileSync(abs, "utf8"), "v2");

  const listed = listCheckpoints(workspace);
  assert.equal(listed.length, 1);
  assert.equal(listed[0].id, created.checkpoint.id);

  const rolled = rollbackCheckpoint(workspace, created.checkpoint.id);
  assert.equal(rolled.ok, true);
  assert.deepEqual(rolled.restored, [rel]);
  assert.equal(fs.readFileSync(abs, "utf8"), "v1");
});
