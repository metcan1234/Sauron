const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");
const {
  isTempWorkspacePath,
  describeWorkspacePathIssue,
  resolveUsableWorkspacePath,
  ensureDefaultWorkspaceDir,
} = require("../../src/sauron/workspace-path-validator");

test("isTempWorkspacePath detects AppData temp folders", () => {
  assert.equal(
    isTempWorkspacePath("C:\\Users\\Can\\AppData\\Local\\Temp\\sauron-temp_project-123"),
    true,
  );
  assert.equal(isTempWorkspacePath("C:\\Projects\\MyGame"), false);
});

test("describeWorkspacePathIssue flags missing path", () => {
  const result = describeWorkspacePathIssue("");
  assert.equal(result.valid, false);
  assert.equal(result.issue, "empty");
});

test("resolveUsableWorkspacePath repairs temp workspace", () => {
  const resolved = resolveUsableWorkspacePath("C:\\Temp\\sauron-temp_project-1");
  assert.equal(resolved.changed, true);
  assert.equal(resolved.issue, "temp");
  assert.ok(resolved.workspacePath.includes("SauronWorkspace"));
  assert.ok(describeWorkspacePathIssue(resolved.workspacePath).valid);
});

test("ensureDefaultWorkspaceDir creates readme", () => {
  const dir = ensureDefaultWorkspaceDir();
  assert.ok(dir);
  assert.ok(describeWorkspacePathIssue(dir).valid);
});
