const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { readPackageScripts, runScript } = require("../../src/code-agent/repair-loop");

test("readPackageScripts returns empty when no package.json", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-repair-"));
  return readPackageScripts(dir).then((scripts) => {
    assert.deepEqual(scripts, {});
  });
});

test("runScript skips when script missing", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-repair-"));
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ scripts: {} }), "utf8");
  const result = await runScript(dir, "lint");
  assert.equal(result.skipped, true);
  assert.equal(result.ok, true);
});

test("runScript fails when script exits non-zero", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-repair-"));
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ scripts: { test: "node -e \"process.exit(1)\"" } }),
    "utf8",
  );
  const result = await runScript(dir, "test");
  assert.equal(result.ok, false);
  assert.equal(result.scriptName, "test");
});
