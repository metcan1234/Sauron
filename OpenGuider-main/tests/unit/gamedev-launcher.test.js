const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { activateGamedevMode } = require("../../src/sauron/gamedev-launcher");

test("activateGamedevMode bootstraps workspace and writes MCP config", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-gamedev-activate-"));
  const settings = {
    gamedevEnabled: true,
    gamedevActiveEngine: "unity",
    workspacePath: tmp,
  };

  const result = await activateGamedevMode(settings);
  assert.equal(result.ok, true);
  assert.equal(result.modeActive, true);
  assert.equal(result.engine, "unity");
  assert.ok(result.launchResult);
  assert.ok(fs.existsSync(path.join(tmp, ".vscode", "extensions.json")));
  assert.ok(
    fs.existsSync(path.join(tmp, ".vscode", "mcp.json"))
      || fs.existsSync(path.join(tmp, ".cursor", "mcp.json")),
  );
  assert.ok(fs.existsSync(path.join(tmp, ".clinerules", "sauron-gamedev.md")));
});

test("activateGamedevMode rejects missing workspace folder", async () => {
  const result = await activateGamedevMode({
    gamedevEnabled: true,
    workspacePath: path.join(os.tmpdir(), "sauron-missing-workspace-xyz"),
  });
  assert.equal(result.ok, false);
  assert.match(result.error || "", /bulunamadı/i);
});
