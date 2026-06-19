const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  writeHandoff,
  buildHandoffPayload,
  getHandoffStatus,
  listHandoffHistory,
  rejectHandoffFile,
} = require("../../src/sauron/handoff");

test("handoff smoke: write status poll reject lifecycle", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-handoff-smoke-"));
  try {
    const written = writeHandoff(workspace, buildHandoffPayload({
      goalIntent: "smoke test goal",
      activePlan: { goal: "Ship feature", steps: [{ title: "Test", status: "pending" }] },
    }, workspace));

    assert.equal(getHandoffStatus(workspace, written.fileName).status, "pending");

    const historyBefore = listHandoffHistory(workspace, { limit: 5 });
    assert.equal(historyBefore[0]?.status, "pending");

    rejectHandoffFile(workspace, written.fileName);
    assert.equal(getHandoffStatus(workspace, written.fileName).status, "rejected");

    const historyAfter = listHandoffHistory(workspace, { limit: 5 });
    assert.equal(historyAfter[0]?.status, "rejected");
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
