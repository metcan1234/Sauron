#!/usr/bin/env node
const { execFile } = require("child_process");
const {
  spawnVSCodeProcess,
  resolveVSCodeExecutable,
  buildLaunchArgs,
  resetLaunchDebounceForTests,
} = require("../src/sauron/vscode-launcher");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getCodeCount() {
  return new Promise((resolve) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-Command", "@(Get-Process -Name Code -ErrorAction SilentlyContinue).Count"],
      { windowsHide: true },
      (_error, stdout) => resolve(Number(String(stdout || "").trim()) || 0),
    );
  });
}

async function main() {
  const workspacePath = "C:\\Users\\Can\\OneDrive\\Desktop\\denemeler";
  const executable = resolveVSCodeExecutable();
  resetLaunchDebounceForTests();
  await spawnVSCodeProcess(
    executable,
    buildLaunchArgs(workspacePath, { newWindow: true, executableKind: executable.kind }),
  );
  await sleep(5000);
  const count = await getCodeCount();
  console.log(JSON.stringify({
    ok: count > 0,
    executable,
    args: buildLaunchArgs(workspacePath, { newWindow: true, executableKind: executable.kind }),
    codeProcessCount: count,
  }, null, 2));
  process.exit(count > 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
