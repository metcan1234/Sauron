const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const { detectWorkspaceLayout } = require("../../src/sauron/workspace-detector");

test("detectWorkspaceLayout identifies OpenGuider-main", () => {
  const root = path.join(__dirname, "..", "..");
  const layout = detectWorkspaceLayout(root);
  assert.equal(layout.isOpenGuider, true);
  assert.equal(layout.suggestedProjectType, "electron-core");
});

test("detectWorkspaceLayout identifies bridge extension", () => {
  const root = path.join(__dirname, "..", "..", "..", "sauron-vscode-bridge");
  const layout = detectWorkspaceLayout(root);
  assert.equal(layout.isBridge, true);
  assert.equal(layout.suggestedProjectType, "bridge-extension");
});
