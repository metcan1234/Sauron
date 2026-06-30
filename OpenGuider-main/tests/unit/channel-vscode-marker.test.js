const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { prepareChannelVSCode, CHANNEL_FILES } = require("../../src/sauron/channel-vscode-marker");

test("prepareChannelVSCode writes workspace welcome marker", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-channel-"));
  const prep = prepareChannelVSCode(dir, "workspace", { handoffFileName: "handoff-1.json" });

  assert.equal(prep.marker.channel, "workspace");
  assert.equal(prep.marker.handoffFileName, "handoff-1.json");
  assert.ok(fs.existsSync(prep.welcomePath));
  assert.ok(fs.existsSync(path.join(dir, ".sauron", "active-channel.json")));
  assert.equal(path.basename(prep.welcomePath), CHANNEL_FILES.workspace);
  const content = fs.readFileSync(prep.welcomePath, "utf8");
  assert.match(content, /ÇALIŞMA KISMI AKTİF/);
});

test("prepareChannelVSCode writes gamedev welcome marker", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-channel-"));
  const prep = prepareChannelVSCode(dir, "gamedev", { engineLabel: "Unity" });

  assert.equal(prep.marker.channel, "gamedev");
  assert.equal(prep.marker.engineLabel, "Unity");
  assert.equal(path.basename(prep.welcomePath), CHANNEL_FILES.gamedev);
  const content = fs.readFileSync(prep.welcomePath, "utf8");
  assert.match(content, /GAME DEV AKTİF/);
  assert.match(content, /Unity/);
});
