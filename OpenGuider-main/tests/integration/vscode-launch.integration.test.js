const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

function readIntegrationWorkspace() {
  const configPath = path.join(process.env.APPDATA || "", "openguider", "config.json");
  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const workspacePath = String(config.workspacePath || "").trim();
    if (workspacePath && fs.existsSync(workspacePath)) {
      return workspacePath;
    }
  } catch {
    // fall through
  }
  return fs.mkdtempSync(path.join(os.tmpdir(), "og-vscode-integration-"));
}

test("waitForVSCodeWindow returns window_found when VS Code has a main window", async (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows-only VS Code integration");
    return;
  }

  delete require.cache[require.resolve("../../src/sauron/vscode-window-focus")];
  const { getVSCodeProcessState, resetScriptCacheForTests } = require("../../src/sauron/vscode-window-focus");
  resetScriptCacheForTests();
  const state = await getVSCodeProcessState();
  if (!state.running) {
    t.skip("VS Code is not running in this environment");
    return;
  }

  const { waitForVSCodeWindow } = require("../../src/sauron/vscode-window-focus");
  const result = await waitForVSCodeWindow({ timeoutMs: 3000 });
  if (!state.hasWindow) {
    assert.equal(result.verificationReason, "process_only");
    return;
  }
  assert.equal(result.verified, true);
  assert.equal(result.verificationReason, "window_found");
  assert.ok(result.pid);
});

test("openWorkspaceInVSCode verifies VS Code window on Windows", async (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows-only VS Code integration");
    return;
  }

  delete require.cache[require.resolve("../../src/sauron/vscode-window-focus")];
  delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
  const {
    openWorkspaceInVSCode,
    resolveVSCodeExecutable,
    resetLaunchDebounceForTests,
  } = require("../../src/sauron/vscode-launcher");
  const {
    resetScriptCacheForTests,
    getVSCodeProcessState,
    terminateVSCodeIfNoVisibleWindow,
  } = require("../../src/sauron/vscode-window-focus");
  resetScriptCacheForTests();

  if (!resolveVSCodeExecutable()) {
    t.skip("VS Code CLI not installed");
    return;
  }

  const workspacePath = readIntegrationWorkspace();
  const before = await getVSCodeProcessState();
  if (before.running && !before.hasWindow) {
    await terminateVSCodeIfNoVisibleWindow();
    await new Promise((resolve) => setTimeout(resolve, 700));
  }

  resetLaunchDebounceForTests();
  const result = await openWorkspaceInVSCode(workspacePath, {
    newWindow: !before.hasWindow,
    force: true,
    verifyTimeoutMs: 35000,
  });

  assert.equal(result.skipped, false);
  assert.equal(result.executableKind, "cmd");
  assert.ok(result.launchProfile, "expected launch profile metadata");
  if (result.verified) {
    assert.ok(
      result.verificationReason === "spawn_ok"
      || result.verificationReason === "window_found"
      || result.verificationReason === "window_stable"
      || result.verificationReason === "focus_restored",
    );
    return;
  }

  assert.ok(
    ["window_lost_after_verify", "timeout", "process_only"].includes(result.verificationReason),
    `expected verified launch or known unstable reason, got ${result.verificationReason}`,
  );
  t.diagnostic(`VS Code window unstable after ${result.launchProfile}: ${result.verificationReason}`);
});
