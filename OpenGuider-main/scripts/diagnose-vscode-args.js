#!/usr/bin/env node
/**
 * Compare VS Code launch methods and log full command details.
 * Usage: node scripts/diagnose-vscode-args.js
 */
const { execFile, spawn } = require("child_process");
const fs = require("fs");
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
  return "C:\\Users\\Can\\OneDrive\\Desktop\\Sauron Core\\OpenGuider-main";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runPowerShell(command) {
  return new Promise((resolve) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
      { maxBuffer: 4 * 1024 * 1024, windowsHide: true },
      (error, stdout, stderr) => {
        resolve({
          ok: !error,
          stdout: String(stdout || "").trim(),
          stderr: String(stderr || "").trim(),
          error: error?.message || null,
        });
      },
    );
  });
}

async function getCodeState() {
  const result = await runPowerShell(`
    $withWindow = Get-Process -Name Code -ErrorAction SilentlyContinue |
      Where-Object { $_.MainWindowHandle -ne 0 } |
      Select-Object -First 1
    $all = @(Get-Process -Name Code -ErrorAction SilentlyContinue)
    @{
      total = $all.Count
      withWindow = @($all | Where-Object { $_.MainWindowHandle -ne 0 }).Count
      pid = if ($withWindow) { [int]$withWindow.Id } else { $null }
      title = if ($withWindow) { $withWindow.MainWindowTitle } else { "" }
    } | ConvertTo-Json -Compress
  `);
  try {
    return JSON.parse(result.stdout || "{}");
  } catch {
    return { total: 0, withWindow: 0, parseError: true, raw: result.stdout };
  }
}

async function pollState(label, seconds = 5) {
  const samples = [];
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    const state = await getCodeState();
    samples.push({ at: new Date().toISOString(), ...state });
    await sleep(500);
  }
  return { label, samples, stillOpen: samples.some((s) => s.withWindow > 0) };
}

async function launchViaSauronMethod(workspacePath) {
  const {
    buildLaunchArgs,
    buildPowerShellStartProcessCommand,
    resolveVSCodeExecutable,
    spawnVSCodeProcess,
    resetLaunchDebounceForTests,
  } = require("../src/sauron/vscode-launcher");
  resetLaunchDebounceForTests();
  const executable = resolveVSCodeExecutable();
  const args = buildLaunchArgs(workspacePath, {
    newWindow: true,
    executableKind: executable.kind,
    extraArgs: [],
  });
  const psCommand = buildPowerShellStartProcessCommand(executable.path, args);
  const detail = {
    method: "sauron_start_process",
    executable: executable.path,
    executableKind: executable.kind,
    args,
    cwd: null,
    envOverrides: null,
    codeWorkspaceFile: null,
    powershellCommand: psCommand,
  };
  await spawnVSCodeProcess(executable, args);
  return detail;
}

function launchViaCodeCmd(codeCmd, workspacePath, flags) {
  return new Promise((resolve, reject) => {
    const args = [...flags, workspacePath];
    const useShell = process.platform === "win32" && /\.(cmd|bat)$/i.test(codeCmd);
    const child = spawn(codeCmd, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      shell: useShell,
    });
    child.on("error", reject);
    child.unref();
    resolve({
      method: "code_cmd_spawn",
      executable: codeCmd,
      args,
      shell: useShell,
      cwd: null,
      envOverrides: null,
      codeWorkspaceFile: null,
    });
  });
}

async function main() {
  if (process.platform !== "win32") {
    console.error("Windows only");
    process.exit(1);
  }

  const workspacePath = readWorkspaceFromConfig();
  const { resolveVscodeExecutablePath, resolveVSCodeExecutable } = require("../src/sauron/vscode-launcher");
  const codeCmd = resolveVscodeExecutablePath();
  const executable = resolveVSCodeExecutable();

  const codeWorkspaceCandidates = [
    path.join(workspacePath, `${path.basename(workspacePath)}.code-workspace`),
    path.join(workspacePath, ".vscode", "workspace.code-workspace"),
  ];
  const workspaceFiles = {};
  for (const candidate of codeWorkspaceCandidates) {
    if (fs.existsSync(candidate)) {
      workspaceFiles[candidate] = fs.readFileSync(candidate, "utf8");
    }
  }

  const report = {
    workspacePath,
    workspaceExists: fs.existsSync(workspacePath),
    workspacePathHasSpaces: /\s/.test(workspacePath),
    resolvedCodeCmd: codeCmd,
    resolvedExecutable: executable,
    codeWorkspaceFiles: workspaceFiles,
    vscodeExtensionsJson: null,
    tests: [],
  };

  const extJson = path.join(workspacePath, ".vscode", "extensions.json");
  if (fs.existsSync(extJson)) {
    report.vscodeExtensionsJson = fs.readFileSync(extJson, "utf8");
  }

  // Clean slate
  await runPowerShell("Get-Process -Name Code -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue");
  await sleep(1500);

  // Test 1: Sauron method (Code.exe + Start-Process)
  const sauronDetail = await launchViaSauronMethod(workspacePath);
  report.tests.push({
    ...sauronDetail,
    poll: await pollState("after_sauron", 6),
  });
  await runPowerShell("Get-Process -Name Code -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue");
  await sleep(1500);

  // Test 2: code.cmd -n path (minimal, user-style)
  if (codeCmd && fs.existsSync(codeCmd)) {
    const codeCmdDetail = await launchViaCodeCmd(codeCmd, workspacePath, ["-n"]);
    report.tests.push({
      ...codeCmdDetail,
      poll: await pollState("after_code_cmd_n", 6),
    });
    await runPowerShell("Get-Process -Name Code -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue");
    await sleep(1500);
  }

  // Test 3: code.cmd path only (no -n)
  if (codeCmd && fs.existsSync(codeCmd)) {
    const codeCmdPlain = await launchViaCodeCmd(codeCmd, workspacePath, []);
    report.tests.push({
      ...codeCmdPlain,
      poll: await pollState("after_code_cmd_plain", 6),
    });
    await runPowerShell("Get-Process -Name Code -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue");
    await sleep(1500);
  }

  // Test 4: Code.exe --new-window via direct spawn (no PowerShell wrapper)
  if (executable?.path && fs.existsSync(executable.path)) {
    const directDetail = await launchViaCodeCmd(executable.path, workspacePath, ["--new-window"]);
    report.tests.push({
      method: "code_exe_direct_spawn",
      executable: executable.path,
      args: ["--new-window", workspacePath],
      poll: await pollState("after_code_exe_direct", 6),
    });
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error?.message || String(error) }, null, 2));
  process.exit(1);
});
