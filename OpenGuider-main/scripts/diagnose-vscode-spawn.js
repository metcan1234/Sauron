#!/usr/bin/env node
/**
 * Capture spawn error/exit/stderr for VS Code launch variants.
 * Usage: node scripts/diagnose-vscode-spawn.js
 */
const { spawn, execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

function readWorkspaceFromConfig() {
  const configCandidates = [
    path.join(process.env.APPDATA || "", "Sauron", "config.json"),
    path.join(process.env.APPDATA || "", "openguider", "config.json"),
  ];
  for (const configPath of configCandidates) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      const workspacePath = String(config.workspacePath || "").trim();
      if (workspacePath && fs.existsSync(workspacePath)) {
        return workspacePath;
      }
    } catch {
      // try next candidate
    }
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

async function getCodeProcessSnapshot() {
  const result = await runPowerShell(`
    $procs = @(Get-Process -Name Code -ErrorAction SilentlyContinue)
    $withWindow = @($procs | Where-Object { $_.MainWindowHandle -ne 0 })
    @{
      total = $procs.Count
      withWindow = $withWindow.Count
      pids = @($procs | ForEach-Object { [int]$_.Id })
      titles = @($withWindow | ForEach-Object { $_.MainWindowTitle })
    } | ConvertTo-Json -Compress
  `);
  try {
    return JSON.parse(result.stdout || "{}");
  } catch {
    return { total: 0, withWindow: 0, parseError: true, raw: result.stdout };
  }
}

async function stopAllCodeProcesses() {
  await runPowerShell(
    "Get-Process -Name Code -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue",
  );
  await sleep(1200);
}

function monitorSpawn(label, command, args, options = {}) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const stdoutChunks = [];
    const stderrChunks = [];
    const events = [];

    const record = (type, detail) => {
      events.push({
        type,
        at: new Date().toISOString(),
        elapsedMs: Date.now() - startedAt,
        ...detail,
      });
    };

    let child;
    try {
      child = spawn(command, args, options);
    } catch (error) {
      resolve({
        label,
        command,
        args,
        options: {
          detached: options.detached,
          shell: options.shell,
          stdio: options.stdio,
          windowsHide: options.windowsHide,
        },
        events,
        spawnThrown: error?.message || String(error),
        pid: null,
      });
      return;
    }

    record("spawn", { pid: child.pid });

    if (child.stdout) {
      child.stdout.on("data", (chunk) => {
        const text = String(chunk);
        stdoutChunks.push(text);
        record("stdout", { text });
      });
    }

    if (child.stderr) {
      child.stderr.on("data", (chunk) => {
        const text = String(chunk);
        stderrChunks.push(text);
        record("stderr", { text });
      });
    }

    child.on("error", (error) => {
      record("error", { message: error?.message || String(error), code: error?.code || null });
    });

    child.on("exit", (code, signal) => {
      record("exit", { code, signal });
    });

    child.on("close", (code, signal) => {
      record("close", { code, signal });
    });

    if (options.detached) {
      child.unref();
    }

    const settleMs = options._monitorMs || 4000;
    setTimeout(async () => {
      const processSnapshot = await getCodeProcessSnapshot();
      resolve({
        label,
        command,
        args,
        options: {
          detached: options.detached,
          shell: options.shell,
          stdio: options.stdio,
          windowsHide: options.windowsHide,
        },
        pid: child.pid,
        events,
        stdout: stdoutChunks.join(""),
        stderr: stderrChunks.join(""),
        processSnapshot,
        codeRunningAfterMonitor: (processSnapshot.total || 0) > 0,
        windowVisibleAfterMonitor: (processSnapshot.withWindow || 0) > 0,
      });
    }, settleMs);
  });
}

function buildPowerShellStartProcessCommand(filePath, args) {
  const escape = (value) => String(value).replace(/'/g, "''");
  const argList = args.map((arg) => `'${escape(arg)}'`).join(", ");
  return `Start-Process -FilePath '${escape(filePath)}' -ArgumentList ${argList} -WindowStyle Normal -PassThru`;
}

async function runVariant(label, runner) {
  await stopAllCodeProcesses();
  const before = await getCodeProcessSnapshot();
  const result = await runner();
  return {
    label,
    before,
    ...result,
  };
}

async function main() {
  if (process.platform !== "win32") {
    console.error(JSON.stringify({ ok: false, error: "Windows only" }, null, 2));
    process.exit(1);
  }

  const {
    resolveVscodeExecutablePath,
    resolveVSCodeExecutable,
    buildLaunchArgs,
    buildPowerShellStartProcessCommand,
  } = require("../src/sauron/vscode-launcher");

  const workspacePath = readWorkspaceFromConfig();
  const spacedWorkspace = "C:\\Users\\Can\\OneDrive\\Desktop\\Sauron Core\\OpenGuider-main";
  const codeCmd = resolveVscodeExecutablePath();
  const executable = resolveVSCodeExecutable();

  const variants = [];

  // 1) Current Sauron method: code.cmd + shell + detached + stdio ignore
  variants.push(await runVariant("sauron_shell_detached_ignore", async () => monitorSpawn(
    "sauron_shell_detached_ignore",
    codeCmd,
    buildLaunchArgs(workspacePath, { newWindow: true, executableKind: "cmd", extraArgs: [] }),
    { detached: true, shell: true, stdio: "ignore", windowsHide: true },
  )));

  // 2) Diagnostic: capture stderr/stdout
  variants.push(await runVariant("sauron_shell_detached_pipes", async () => monitorSpawn(
    "sauron_shell_detached_pipes",
    codeCmd,
    buildLaunchArgs(workspacePath, { newWindow: true, executableKind: "cmd", extraArgs: [] }),
    { detached: true, shell: true, stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
  )));

  // 3) Bare manual equivalent via cmd.exe /c (no -n flag, path only) — user said `code.cmd .` works
  variants.push(await runVariant("cmd_exe_c_plain_path", async () => monitorSpawn(
    "cmd_exe_c_plain_path",
    "cmd.exe",
    ["/d", "/s", "/c", codeCmd, workspacePath],
    { detached: true, shell: false, stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
  )));

  // 4) cmd.exe /c with -n
  variants.push(await runVariant("cmd_exe_c_with_n", async () => monitorSpawn(
    "cmd_exe_c_with_n",
    "cmd.exe",
    ["/d", "/s", "/c", codeCmd, "-n", workspacePath],
    { detached: true, shell: false, stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
  )));

  // 5) Code.exe direct detached (no shell)
  if (executable?.kind === "cmd") {
    const codeExe = path.join(path.dirname(path.dirname(codeCmd)), "Code.exe");
    if (fs.existsSync(codeExe)) {
      variants.push(await runVariant("code_exe_direct", async () => monitorSpawn(
        "code_exe_direct",
        codeExe,
        buildLaunchArgs(workspacePath, { newWindow: true, executableKind: "exe", extraArgs: [] }),
        { detached: true, shell: false, stdio: ["ignore", "pipe", "pipe"], windowsHide: false },
      )));
    }
  }

  // 6) PowerShell Start-Process on code.cmd
  const psCmd = buildPowerShellStartProcessCommand(
    codeCmd,
    buildLaunchArgs(workspacePath, { newWindow: true, executableKind: "cmd", extraArgs: [] }),
  );
  variants.push(await runVariant("powershell_start_code_cmd", async () => new Promise((resolve) => {
    const startedAt = Date.now();
    execFile(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-Command", psCmd],
      { windowsHide: true },
      async (error, stdout, stderr) => {
        await sleep(4000);
        const processSnapshot = await getCodeProcessSnapshot();
        resolve({
          label: "powershell_start_code_cmd",
          command: "powershell.exe",
          args: ["-Command", psCmd],
          events: [{
            type: error ? "execFile_error" : "execFile_ok",
            elapsedMs: Date.now() - startedAt,
            message: error?.message || null,
          }],
          stdout: String(stdout || ""),
          stderr: String(stderr || ""),
          processSnapshot,
          codeRunningAfterMonitor: (processSnapshot.total || 0) > 0,
          windowVisibleAfterMonitor: (processSnapshot.withWindow || 0) > 0,
        });
      },
    );
  })));

  // 7) disable-gpu profile on code.cmd shell spawn
  variants.push(await runVariant("sauron_shell_disable_gpu", async () => monitorSpawn(
    "sauron_shell_disable_gpu",
    codeCmd,
    buildLaunchArgs(workspacePath, {
      newWindow: true,
      executableKind: "cmd",
      extraArgs: ["--disable-gpu"],
    }),
    { detached: true, shell: true, stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
  )));

  // 8) Spaced path via cmd.exe /c -n (escape stress test)
  if (fs.existsSync(spacedWorkspace)) {
    variants.push(await runVariant("cmd_exe_c_spaced_path", async () => monitorSpawn(
      "cmd_exe_c_spaced_path",
      "cmd.exe",
      ["/d", "/s", "/c", `"${codeCmd}"`, "-n", `"${spacedWorkspace}"`],
      { detached: true, shell: false, stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
    )));
  }

  const report = {
    ok: true,
    workspacePath,
    spacedWorkspace,
    codeCmd,
    executable,
    variants: variants.map((variant) => ({
      label: variant.label,
      command: variant.command,
      args: variant.args,
      options: variant.options,
      pid: variant.pid,
      events: variant.events,
      stdout: variant.stdout,
      stderr: variant.stderr,
      before: variant.before,
      processSnapshot: variant.processSnapshot,
      codeRunningAfterMonitor: variant.codeRunningAfterMonitor,
      windowVisibleAfterMonitor: variant.windowVisibleAfterMonitor,
    })),
    summary: variants.map((variant) => ({
      label: variant.label,
      codeRunningAfterMonitor: variant.codeRunningAfterMonitor,
      windowVisibleAfterMonitor: variant.windowVisibleAfterMonitor,
      exitEvents: (variant.events || []).filter((event) => event.type === "exit" || event.type === "close"),
      errorEvents: (variant.events || []).filter((event) => event.type === "error" || event.type === "execFile_error"),
      stderr: variant.stderr || "",
    })),
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error?.message || String(error) }, null, 2));
  process.exit(1);
});
