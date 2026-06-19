const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  getBridgeVsixPath,
  getBridgeProjectRoot,
} = require("../../src/sauron/workspace-stack-installer");

test("getBridgeVsixPath points to sauron-vscode-bridge dist", () => {
  const vsixPath = getBridgeVsixPath();
  assert.match(vsixPath, /sauron-vscode-bridge\.vsix$/);
  assert.equal(path.basename(path.dirname(path.dirname(vsixPath))), "sauron-vscode-bridge");
});

test("getBridgeProjectRoot contains bridge package.json", () => {
  const bridgeRoot = getBridgeProjectRoot();
  assert.equal(fs.existsSync(path.join(bridgeRoot, "package.json")), true);
});
