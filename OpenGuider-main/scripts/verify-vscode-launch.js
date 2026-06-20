#!/usr/bin/env node
const fs = require("fs");
const os = require("os");
const path = require("path");

function readWorkspaceFromConfig() {
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
  return fs.mkdtempSync(path.join(os.tmpdir(), "og-vscode-verify-"));
}

async function main() {
  if (process.platform !== "win32") {
    console.error(JSON.stringify({ ok: false, error: "Windows-only verification script" }));
    process.exit(1);
  }

  delete require.cache[require.resolve("../src/sauron/vscode-window-focus")];
  delete require.cache[require.resolve("../src/sauron/vscode-launcher")];

  const {
    resolveVSCodeExecutable,
    resolveVSCodeCommand,
    openWorkspaceInVSCode,
    resetLaunchDebounceForTests,
  } = require("../src/sauron/vscode-launcher");
  const {
    getVSCodeProcessState,
    bringVSCodeToForeground,
  } = require("../src/sauron/vscode-window-focus");

  const workspacePath = readWorkspaceFromConfig();
  const executable = resolveVSCodeExecutable();
  const before = await getVSCodeProcessState();
  const needsNewWindow = !before.running || !before.hasWindow;

  resetLaunchDebounceForTests();
  const launchResult = await openWorkspaceInVSCode(workspacePath, {
    newWindow: needsNewWindow,
    force: true,
    verifyTimeoutMs: 15000,
  });

  const after = await getVSCodeProcessState();
  let focusResult = null;
  if (after.hasWindow) {
    focusResult = await bringVSCodeToForeground(after.hwnd);
  }

  const report = {
    ok: Boolean(launchResult.verified),
    workspacePath,
    codeCmd: resolveVSCodeCommand(),
    executable,
    before,
    launchResult,
    after,
    focusResult,
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error?.message || String(error) }, null, 2));
  process.exit(1);
});
