const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { scaffoldUnityTemplate } = require("../../src/sauron/scaffold-unity-template");

test("scaffoldUnityTemplate copies co-op-climb scripts", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-scaffold-"));
  const result = scaffoldUnityTemplate(tmp, "co-op-climb");
  assert.equal(result.ok, true);
  assert.ok(fs.existsSync(path.join(tmp, "Assets", "SauronGameDev", "co-op-climb", "ClimbController.cs")));
  assert.ok(fs.existsSync(path.join(tmp, "Packages", "manifest.json")));
});

test("scaffoldUnityTemplate rejects unknown template", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-scaffold-bad-"));
  const result = scaffoldUnityTemplate(tmp, "unknown");
  assert.equal(result.ok, false);
});
