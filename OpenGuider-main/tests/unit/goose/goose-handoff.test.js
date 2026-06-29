const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  writeGooseHandoff,
  updateGooseHandoffStatus,
  listGooseHandoffs,
} = require("../../../src/sauron/goose-handoff");

test("writeGooseHandoff creates goose json under .sauron", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "goose-handoff-"));
  const { handoff, filePath } = writeGooseHandoff(workspace, {
    taskText: "fix typo in readme",
    mode: "economy",
    sessionId: "sess-1",
  });

  assert.ok(handoff.id.startsWith("goose-"));
  assert.equal(handoff.status, "pending");
  assert.equal(handoff.task, "fix typo in readme");
  assert.ok(fs.existsSync(filePath));

  const updated = updateGooseHandoffStatus(workspace, handoff.id, "running", { provider: "ollama" });
  assert.equal(updated, true);

  const listed = listGooseHandoffs(workspace);
  assert.equal(listed.length, 1);
  assert.equal(listed[0].status, "running");
  assert.equal(listed[0].provider, "ollama");

  fs.rmSync(workspace, { recursive: true, force: true });
});
