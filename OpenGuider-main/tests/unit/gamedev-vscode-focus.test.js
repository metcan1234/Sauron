const test = require("node:test");
const assert = require("node:assert/strict");

const {
  focusOrLaunchWorkspaceVSCode,
  GAMEDEV_VSCODE_LAUNCH_OPTIONS,
} = require("../../src/sauron/gamedev-vscode-focus");

test("Game Dev VS Code launch uses single reuse-window profile", () => {
  const profiles = GAMEDEV_VSCODE_LAUNCH_OPTIONS.launchProfiles.map((entry) => entry.profile);
  assert.deepEqual(profiles, ["default"]);
  assert.equal(GAMEDEV_VSCODE_LAUNCH_OPTIONS.requireWindowVerification, false);
  assert.equal(GAMEDEV_VSCODE_LAUNCH_OPTIONS.skipVerification, true);
  assert.equal(GAMEDEV_VSCODE_LAUNCH_OPTIONS.newWindow, false);
  assert.equal(GAMEDEV_VSCODE_LAUNCH_OPTIONS.respectRequestedNewWindow, true);
  assert.equal(GAMEDEV_VSCODE_LAUNCH_OPTIONS.skipInterProfileRecovery, true);
  assert.equal(GAMEDEV_VSCODE_LAUNCH_OPTIONS.skipRecovery, true);
});

test("focusOrLaunchWorkspaceVSCode returns error for empty path", async () => {
  const result = await focusOrLaunchWorkspaceVSCode("");
  assert.equal(result.ok, false);
  assert.match(result.error, /required/i);
});
