const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { getMissionControlStatus } = require("../../src/sauron/mission-control-status");
const { recordTask } = require("../../src/sauron/project-memory");

test("getMissionControlStatus returns three channel cards", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "mission-ctrl-"));
  try {
    const status = getMissionControlStatus(workspace, {
      settings: {
        gooseEnabled: true,
        gamedevEnabled: true,
        projectMemoryEnabled: true,
      },
    });
    assert.equal(status.ok, true);
    assert.ok(status.channels.workspace);
    assert.ok(status.channels.goose);
    assert.ok(status.channels.gamedev);
    assert.equal(status.primaryChannel, "workspace");
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("getMissionControlStatus includes recent memory lines", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "mission-mem-"));
  try {
    recordTask(workspace, {
      summary: "Unity sahne düzeni",
      channel: "gamedev",
    }, { projectMemoryEnabled: true });
    const status = getMissionControlStatus(workspace, {
      settings: { projectMemoryEnabled: true },
    });
    assert.ok(status.recentMemory.some((line) => line.includes("gamedev")));
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("getMissionControlStatus reads active channel marker", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "mission-marker-"));
  try {
    const sauronDir = path.join(workspace, ".sauron");
    fs.mkdirSync(sauronDir, { recursive: true });
    fs.writeFileSync(
      path.join(sauronDir, "active-channel.json"),
      JSON.stringify({ channel: "gamedev", label: "Game Dev" }),
      "utf8",
    );
    const status = getMissionControlStatus(workspace, { settings: {} });
    assert.equal(status.marker?.channel, "gamedev");
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
