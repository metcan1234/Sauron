const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  listHandoffHistory,
  rejectHandoffFile,
  writeHandoff,
  buildHandoffPayload,
} = require("../../src/sauron/handoff");

test("listHandoffHistory returns pending consumed and rejected entries", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-handoff-history-"));
  try {
    const pending = writeHandoff(workspace, buildHandoffPayload({ goalIntent: "pending task" }, workspace));
    const consumedDir = path.join(workspace, ".sauron");
    fs.writeFileSync(path.join(consumedDir, "handoff-consumed.json.consumed"), JSON.stringify({
      goal: "done",
      createdAt: "2026-06-18T10:00:00.000Z",
    }), "utf8");
    fs.writeFileSync(path.join(consumedDir, "handoff-rejected.json.rejected"), JSON.stringify({
      goal: "no",
      createdAt: "2026-06-17T10:00:00.000Z",
    }), "utf8");

    const history = listHandoffHistory(workspace, { limit: 10 });
    assert.equal(history.length, 3);
    assert.ok(history.some((item) => item.status === "pending" && item.fileName === pending.fileName));
    assert.ok(history.some((item) => item.status === "consumed"));
    assert.ok(history.some((item) => item.status === "rejected"));
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("rejectHandoffFile renames pending file to rejected", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-handoff-reject-"));
  try {
    const written = writeHandoff(workspace, buildHandoffPayload({ goalIntent: "reject me" }, workspace));
    const result = rejectHandoffFile(workspace, written.fileName);
    assert.equal(result.status, "rejected");
    assert.equal(fs.existsSync(written.handoffPath), false);
    assert.equal(fs.existsSync(`${written.handoffPath}.rejected`), true);
    assert.equal(listHandoffHistory(workspace).filter((item) => item.status === "pending").length, 0);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("listHandoffHistory respects limit", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-handoff-limit-"));
  try {
    for (let index = 0; index < 5; index += 1) {
      writeHandoff(workspace, buildHandoffPayload({ goalIntent: `task-${index}` }, workspace));
    }
    const history = listHandoffHistory(workspace, { limit: 2 });
    assert.equal(history.length, 2);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
