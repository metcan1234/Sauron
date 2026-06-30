const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { getWorkspaceHubStatus } = require("../../src/sauron/workspace-hub-status");
const { saveBrief } = require("../../src/sauron/web-studio/brief-schema");
const { writeHandoff, buildHandoffPayload } = require("../../src/sauron/handoff");

test("getWorkspaceHubStatus reads project label from web brief", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "hub-status-"));
  try {
    saveBrief(workspace, {
      companyName: "Hub Test A.Ş.",
      tagline: "Test slogan",
      pages: ["home"],
    });
    const hub = getWorkspaceHubStatus(workspace);
    assert.equal(hub.ok, true);
    assert.equal(hub.projectLabel, "Hub Test A.Ş.");
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("getWorkspaceHubStatus reports pending handoff", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "hub-pending-"));
  try {
    const payload = buildHandoffPayload({ goalIntent: "test handoff" }, workspace);
    writeHandoff(workspace, payload);
    const hub = getWorkspaceHubStatus(workspace);
    assert.equal(hub.ok, true);
    assert.equal(hub.handoffStatus, "bekliyor");
    assert.equal(hub.shouldShow, true);
    assert.match(hub.summaryLine, /bekliyor/);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("getWorkspaceHubStatus does not show banner for stale rejected handoff", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "hub-reject-"));
  try {
    const sauronDir = path.join(workspace, ".sauron");
    fs.mkdirSync(sauronDir, { recursive: true });
    const fileName = "handoff-test.json.rejected";
    fs.writeFileSync(
      path.join(sauronDir, fileName),
      JSON.stringify({ goal: "old task", id: "old" }),
      "utf8",
    );
    const hub = getWorkspaceHubStatus(workspace);
    assert.equal(hub.shouldShow, false);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
