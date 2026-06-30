const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { applyChannelVSCodeTheme } = require("../../src/sauron/channel-vscode-theme");

test("applyChannelVSCodeTheme writes orange workspace colors", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-vscode-theme-"));
  const result = applyChannelVSCodeTheme(dir, "workspace");
  assert.equal(result.ok, true);

  const settings = JSON.parse(fs.readFileSync(result.settingsPath, "utf8"));
  assert.match(settings["window.title"], /ÇALIŞMA/);
  assert.equal(settings["sauron.activeChannel"], "workspace");
  assert.equal(settings["workbench.colorCustomizations"]["statusBar.background"], "#7c2d12");
});

test("applyChannelVSCodeTheme writes purple gamedev colors", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-vscode-theme-gd-"));
  const result = applyChannelVSCodeTheme(dir, "gamedev", { engineLabel: "Unity" });
  assert.equal(result.ok, true);

  const settings = JSON.parse(fs.readFileSync(result.settingsPath, "utf8"));
  assert.match(settings["window.title"], /GAME DEV/);
  assert.equal(settings["sauron.activeChannel"], "gamedev");
  assert.equal(settings["workbench.colorCustomizations"]["statusBar.background"], "#581c87");
});
