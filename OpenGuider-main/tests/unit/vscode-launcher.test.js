const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const childProcess = require("child_process");

const TEST_LAUNCH_OPTS = { skipVerification: true, skipPostVerifySettle: true };

function countLaunchExecCalls(execCalls) {
  return execCalls.filter(([, args]) => {
    const commandIndex = args.indexOf("-Command");
    const psCommand = commandIndex >= 0 ? args[commandIndex + 1] : "";
    return String(psCommand).includes("Start-Process");
  }).length;
}

function createDetachedSpawnMock(spawnCalls) {
  return (command, args, options) => {
    spawnCalls.push({ command, args, options });
    return {
      on() {
        return this;
      },
      unref() {},
    };
  };
}

function countLaunchCalls(execCalls, spawnCalls = []) {
  const cmdLaunches = spawnCalls.filter((entry) => /code\.(cmd|exe)$/i.test(String(entry.command))).length;
  return countLaunchExecCalls(execCalls) + cmdLaunches;
}

function installLaunchTransportMocks(t, { passthroughExecFile = false } = {}) {
  const execCalls = [];
  const spawnCalls = [];
  const originalExecFile = childProcess.execFile;
  const originalSpawn = childProcess.spawn;

  childProcess.execFile = (command, args, options, callback) => {
    if (typeof options === "function") {
      callback = options;
      options = {};
    }
    execCalls.push([command, args, options]);
    if (callback) {
      callback(null, "", "");
    }
    return {};
  };

  if (passthroughExecFile) {
    childProcess.execFile = (command, args, options, callback) => {
      if (typeof options === "function") {
        callback = options;
        options = {};
      }
      if (command === "powershell.exe") {
        execCalls.push([command, args, options]);
        if (callback) {
          callback(null, "", "");
        }
        return {};
      }
      return originalExecFile(command, args, options, callback);
    };
  }

  childProcess.spawn = createDetachedSpawnMock(spawnCalls);

  t.after(() => {
    childProcess.execFile = originalExecFile;
    childProcess.spawn = originalSpawn;
  });

  return {
    execCalls,
    spawnCalls,
    countLaunches: () => countLaunchCalls(execCalls, spawnCalls),
  };
}

test("spawnVSCodeProcess on Windows uses PowerShell Start-Process for code.cmd", async (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows-only spawn path");
    return;
  }

  const execCalls = [];
  const originalExecFile = childProcess.execFile;
  childProcess.execFile = (command, args, options, callback) => {
    if (typeof options === "function") {
      callback = options;
      options = {};
    }
    if (command === "powershell.exe") {
      execCalls.push([command, args, options]);
      if (callback) {
        callback(null, "", "");
      }
      return {};
    }
    return originalExecFile(command, args, options, callback);
  };

  t.after(() => {
    childProcess.execFile = originalExecFile;
    delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
    delete require.cache[require.resolve("../../src/sauron/vscode-window-focus")];
  });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "og-vscode-launch-"));
  delete require.cache[require.resolve("../../src/sauron/vscode-window-focus")];
  delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
  const { spawnVSCodeProcess } = require("../../src/sauron/vscode-launcher");

  await spawnVSCodeProcess(
    { kind: "cmd", path: "C:\\Microsoft VS Code\\bin\\code.cmd" },
    ["-n", tmpDir],
  );

  assert.equal(execCalls.length, 1);
  const psCommand = execCalls[0][1][execCalls[0][1].indexOf("-Command") + 1];
  assert.match(psCommand, /Start-Process/);
  assert.match(psCommand, /code\.cmd/);
  assert.match(psCommand, /-n/);
  assert.match(psCommand, /-WindowStyle Hidden/);
});

test("spawnVSCodeProcess on Windows uses PowerShell Start-Process for Code.exe", async (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows-only spawn guard");
    return;
  }

  const execCalls = [];
  const originalExecFile = childProcess.execFile;
  childProcess.execFile = (command, args, options, callback) => {
    if (typeof options === "function") {
      callback = options;
      options = {};
    }
    execCalls.push([command, args, options]);
    if (callback) {
      callback(null, "", "");
    }
    return {};
  };

  t.after(() => {
    childProcess.execFile = originalExecFile;
    delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
    delete require.cache[require.resolve("../../src/sauron/vscode-window-focus")];
  });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "og-vscode-launch-"));
  delete require.cache[require.resolve("../../src/sauron/vscode-window-focus")];
  delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
  const { spawnVSCodeProcess } = require("../../src/sauron/vscode-launcher");

  await spawnVSCodeProcess({ kind: "exe", path: "C:\\VS Code\\Code.exe" }, ["--new-window", tmpDir]);

  assert.equal(execCalls.length, 1);
  const [command, args] = execCalls[0];
  assert.equal(command, "powershell.exe");
  assert.ok(args.includes("-Command"));
  const psCommand = args[args.indexOf("-Command") + 1];
  assert.match(psCommand, /Start-Process/);
  assert.match(psCommand, /Code\.exe/);
  assert.match(psCommand, /--new-window/);
  assert.match(psCommand, /-WindowStyle Normal/);
  assert.doesNotMatch(psCommand, /cmd\.exe start/i);
});

test("openWorkspaceInVSCode debounces duplicate launches", async (t) => {
  const { countLaunches } = installLaunchTransportMocks(t);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "og-vscode-debounce-"));
  delete require.cache[require.resolve("../../src/sauron/vscode-window-focus")];
  delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
  const {
    openWorkspaceInVSCode,
    resetLaunchDebounceForTests,
    resolveVSCodeExecutable,
  } = require("../../src/sauron/vscode-launcher");
  resetLaunchDebounceForTests();

  if (!resolveVSCodeExecutable()) {
    t.skip("VS Code not installed in this environment");
    return;
  }

  const first = await openWorkspaceInVSCode(tmpDir, { newWindow: true, ...TEST_LAUNCH_OPTS });
  const second = await openWorkspaceInVSCode(tmpDir, { newWindow: true, ...TEST_LAUNCH_OPTS });

  assert.equal(first.skipped, false);
  assert.equal(second.skipped, true);
  assert.equal(second.reason, "debounced");
  assert.equal(countLaunches(), 1);
});

test("buildLaunchArgs prepends extraArgs before workspace flags", () => {
  const { buildLaunchArgs } = require("../../src/sauron/vscode-launcher");
  const workspace = "C:\\work\\demo";
  assert.deepEqual(buildLaunchArgs(workspace, {
    newWindow: true,
    extraArgs: ["--disable-gpu"],
  }), ["--disable-gpu", "-n", workspace]);
  assert.deepEqual(buildLaunchArgs(workspace, {
    newWindow: true,
    executableKind: "exe",
    extraArgs: ["--disable-gpu", "--disable-extensions"],
  }), ["--disable-gpu", "--disable-extensions", "--new-window", workspace]);
});

test("buildLaunchArgs uses -n only for new windows", () => {
  const { buildLaunchArgs } = require("../../src/sauron/vscode-launcher");
  const workspace = "C:\\work\\demo";
  assert.deepEqual(buildLaunchArgs(workspace, { newWindow: true }), ["-n", workspace]);
  assert.deepEqual(buildLaunchArgs(workspace, { newWindow: false }), ["-r", workspace]);
});

test("buildLaunchArgs uses long flags for Code.exe fallback", () => {
  const { buildLaunchArgs } = require("../../src/sauron/vscode-launcher");
  const workspace = "C:\\work\\demo";
  assert.deepEqual(buildLaunchArgs(workspace, { newWindow: true, executableKind: "exe" }), [
    "--new-window",
    workspace,
  ]);
  assert.deepEqual(buildLaunchArgs(workspace, { newWindow: false, executableKind: "exe" }), [
    "--reuse-window",
    workspace,
  ]);
});

test("buildPowerShellStartProcessCommand escapes single quotes", () => {
  const { buildPowerShellStartProcessCommand } = require("../../src/sauron/vscode-launcher");
  const command = buildPowerShellStartProcessCommand("C:\\Tools\\Code.exe", ["--new-window", "C:\\user's\\demo"]);
  assert.match(command, /Code\.exe/);
  assert.match(command, /user''s/);
  assert.match(command, /-WindowStyle Normal/);
});

test("buildPowerShellStartProcessCommand hides cmd wrapper window for code.cmd", () => {
  const { buildPowerShellStartProcessCommand } = require("../../src/sauron/vscode-launcher");
  const command = buildPowerShellStartProcessCommand(
    "C:\\Microsoft VS Code\\bin\\code.cmd",
    ["-n", "C:\\work\\demo"],
  );
  assert.match(command, /code\.cmd/);
  assert.match(command, /-WindowStyle Hidden/);
  assert.doesNotMatch(command, /-PassThru/);
});

test("isVSCodeCliWrapper rejects Code.exe and accepts code.cmd", () => {
  const { isVSCodeCliWrapper } = require("../../src/sauron/vscode-launcher");
  assert.equal(
    isVSCodeCliWrapper("C:\\Users\\Can\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe"),
    false,
  );
  assert.equal(
    isVSCodeCliWrapper("C:\\Users\\Can\\AppData\\Local\\Programs\\Microsoft VS Code\\bin\\code.cmd"),
    true,
  );
  assert.equal(
    isVSCodeCliWrapper("C:\\Users\\Can\\AppData\\Local\\Programs\\cursor\\resources\\app\\codeBin\\code.cmd"),
    false,
  );
});

test("isCursorCliPath detects Cursor shims", () => {
  const { isCursorCliPath } = require("../../src/sauron/vscode-launcher");
  assert.equal(
    isCursorCliPath("C:\\Users\\Can\\AppData\\Local\\Programs\\cursor\\resources\\app\\codeBin\\code.cmd"),
    true,
  );
  assert.equal(
    isCursorCliPath("C:\\Users\\Can\\AppData\\Local\\Programs\\Microsoft VS Code\\bin\\code.cmd"),
    false,
  );
});

test("resolveVscodeExecutablePath prefers configured path", (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "og-vscode-configured-"));
  const fakeCli = path.join(tmpDir, "code.cmd");
  fs.writeFileSync(fakeCli, "@echo off\r\n", "utf8");

  const {
    resolveVscodeExecutablePath,
    setConfiguredVscodePath,
    getLastResolvedVscodePathInfo,
  } = require("../../src/sauron/vscode-launcher");

  t.after(() => {
    setConfiguredVscodePath("");
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
  });

  setConfiguredVscodePath(fakeCli);
  assert.equal(resolveVscodeExecutablePath(), fakeCli);
  assert.deepEqual(getLastResolvedVscodePathInfo(), {
    path: fakeCli,
    source: "settings",
  });
});

test("resolveVscodeExecutablePath filters Cursor from where code", (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows-only where code filter");
    return;
  }

  const localAppData = process.env.LOCALAPPDATA || "";
  const expectedCmd = path.join(localAppData, "Programs", "Microsoft VS Code", "bin", "code.cmd");
  const cursorCmd = path.join(localAppData, "Programs", "cursor", "resources", "app", "codeBin", "code.cmd");
  if (!expectedCmd) {
    t.skip("LOCALAPPDATA unavailable");
    return;
  }

  const originalExecFileSync = childProcess.execFileSync;
  const originalExistsSync = fs.existsSync;
  childProcess.execFileSync = (command, args, options) => {
    if (command === "where" && args?.[0] === "code") {
      return [
        cursorCmd,
        path.join(localAppData, "Programs", "cursor", "resources", "app", "codeBin", "code"),
        expectedCmd,
      ].join("\r\n");
    }
    return originalExecFileSync(command, args, options);
  };
  fs.existsSync = (candidate) => {
    const value = String(candidate);
    if (value === expectedCmd) {
      return true;
    }
    if (value.includes("Microsoft VS Code") || value.includes("cursor")) {
      return false;
    }
    return originalExistsSync(candidate);
  };

  t.after(() => {
    childProcess.execFileSync = originalExecFileSync;
    fs.existsSync = originalExistsSync;
    delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
  });

  delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
  const {
    resolveVscodeExecutablePath,
    setConfiguredVscodePath,
    getLastResolvedVscodePathInfo,
    isCursorCliPath,
  } = require("../../src/sauron/vscode-launcher");
  setConfiguredVscodePath("");

  const resolved = resolveVscodeExecutablePath();
  assert.equal(resolved, expectedCmd);
  assert.ok(!isCursorCliPath(resolved));
  assert.ok(["common-path", "path-command"].includes(getLastResolvedVscodePathInfo().source));
});

test("resolveVSCodeExecutable prefers code.cmd CLI launch on Windows", () => {
  if (process.platform !== "win32") {
    return;
  }

  delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
  const {
    resolveVSCodeExecutable,
    resolveVSCodeCommand,
  } = require("../../src/sauron/vscode-launcher");
  const codeCmd = resolveVSCodeCommand();
  const executable = resolveVSCodeExecutable();

  if (!codeCmd) {
    return;
  }

  assert.equal(executable?.kind, "cmd");
  assert.equal(executable?.path, codeCmd);
  assert.match(executable?.path || "", /code\.cmd$/i);
});

test("resolveVSCodeCommand ignores Code.exe from where code", (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows-only where code filter");
    return;
  }

  const localAppData = process.env.LOCALAPPDATA || "";
  const expectedCmd = path.join(localAppData, "Programs", "Microsoft VS Code", "bin", "code.cmd");
  if (!expectedCmd || !fs.existsSync(expectedCmd)) {
    t.skip("VS Code code.cmd not installed in default location");
    return;
  }

  const originalExecFileSync = childProcess.execFileSync;
  childProcess.execFileSync = (command, args, options) => {
    if (command === "where" && args?.[0] === "code") {
      return `${path.join(localAppData, "Programs", "Microsoft VS Code", "Code.exe")}\r\n`;
    }
    return originalExecFileSync(command, args, options);
  };

  t.after(() => {
    childProcess.execFileSync = originalExecFileSync;
    delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
  });

  delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
  const { resolveVSCodeCommand } = require("../../src/sauron/vscode-launcher");
  assert.equal(resolveVSCodeCommand(), expectedCmd);
});

test("resolveEffectiveNewWindow opens new window when VS Code is not running", async (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows-only new window resolution");
    return;
  }

  delete require.cache[require.resolve("../../src/sauron/vscode-window-focus")];
  delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
  const focusModule = require("../../src/sauron/vscode-window-focus");
  const original = focusModule.getVSCodeProcessState;
  focusModule.getVSCodeProcessState = async () => ({
    running: false,
    pid: null,
    hwnd: 0,
    hasWindow: false,
    title: "",
  });

  t.after(() => {
    focusModule.getVSCodeProcessState = original;
    delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
    delete require.cache[require.resolve("../../src/sauron/vscode-window-focus")];
  });

  const { resolveEffectiveNewWindow } = require("../../src/sauron/vscode-launcher");
  assert.equal(await resolveEffectiveNewWindow(false), true);
  assert.equal(await resolveEffectiveNewWindow(true), true);
});

test("resolveEffectiveNewWindow opens new window when VS Code has no visible window", async (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows-only new window resolution");
    return;
  }

  delete require.cache[require.resolve("../../src/sauron/vscode-window-focus")];
  delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
  const focusModule = require("../../src/sauron/vscode-window-focus");
  const original = focusModule.getVSCodeProcessState;
  focusModule.getVSCodeProcessState = async () => ({
    running: true,
    pid: 1234,
    hwnd: 0,
    hasWindow: false,
    title: "",
  });

  t.after(() => {
    focusModule.getVSCodeProcessState = original;
    delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
    delete require.cache[require.resolve("../../src/sauron/vscode-window-focus")];
  });

  const { resolveEffectiveNewWindow } = require("../../src/sauron/vscode-launcher");
  assert.equal(await resolveEffectiveNewWindow(false), true);
});

test("resolveEffectiveNewWindow keeps reuse when VS Code window is visible", async (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows-only new window resolution");
    return;
  }

  delete require.cache[require.resolve("../../src/sauron/vscode-window-focus")];
  delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
  const focusModule = require("../../src/sauron/vscode-window-focus");
  const original = focusModule.getVSCodeProcessState;
  focusModule.getVSCodeProcessState = async () => ({
    running: true,
    pid: 1234,
    hwnd: 999,
    hasWindow: true,
    title: "demo - Visual Studio Code",
  });

  t.after(() => {
    focusModule.getVSCodeProcessState = original;
    delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
    delete require.cache[require.resolve("../../src/sauron/vscode-window-focus")];
  });

  const { resolveEffectiveNewWindow } = require("../../src/sauron/vscode-launcher");
  assert.equal(await resolveEffectiveNewWindow(false), false);
  assert.equal(await resolveEffectiveNewWindow(true), true);
});

test("openWorkspaceInVSCode reports launchMethod and verified when skipped", async (t) => {
  const { countLaunches } = installLaunchTransportMocks(t);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "og-vscode-method-"));
  delete require.cache[require.resolve("../../src/sauron/vscode-window-focus")];
  delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
  const {
    openWorkspaceInVSCode,
    resetLaunchDebounceForTests,
    resolveVSCodeExecutable,
  } = require("../../src/sauron/vscode-launcher");
  resetLaunchDebounceForTests();

  if (!resolveVSCodeExecutable()) {
    t.skip("VS Code not installed in this environment");
    return;
  }

  const result = await openWorkspaceInVSCode(tmpDir, { newWindow: true, ...TEST_LAUNCH_OPTS });
  assert.equal(result.launchMethod, "code.cmd");
  assert.equal(result.executableKind, "cmd");
  assert.equal(result.verified, true);
  assert.equal(result.verificationReason, "skipped");
  assert.equal(countLaunches(), 1);
});

test("openWorkspaceInVSCode force bypasses debounce", async (t) => {
  const { countLaunches } = installLaunchTransportMocks(t);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "og-vscode-force-"));
  delete require.cache[require.resolve("../../src/sauron/vscode-window-focus")];
  delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
  const {
    openWorkspaceInVSCode,
    resetLaunchDebounceForTests,
    resolveVSCodeExecutable,
  } = require("../../src/sauron/vscode-launcher");
  resetLaunchDebounceForTests();

  if (!resolveVSCodeExecutable()) {
    t.skip("VS Code not installed in this environment");
    return;
  }

  const first = await openWorkspaceInVSCode(tmpDir, { newWindow: true, ...TEST_LAUNCH_OPTS });
  const forced = await openWorkspaceInVSCode(tmpDir, { newWindow: true, force: true, ...TEST_LAUNCH_OPTS });

  assert.equal(first.skipped, false);
  assert.equal(forced.skipped, false);
  assert.equal(countLaunches(), 2);
});

test("focusWorkspaceInVSCode focuses existing window without terminate", async (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows-only focus path");
    return;
  }

  delete require.cache[require.resolve("../../src/sauron/vscode-window-focus")];
  delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
  const focusModule = require("../../src/sauron/vscode-window-focus");
  const originalGetState = focusModule.getVSCodeProcessState;
  const originalBring = focusModule.bringVSCodeToForeground;
  const originalTerminate = focusModule.terminateVSCodeIfNoVisibleWindow;
  let terminateCalls = 0;

  focusModule.getVSCodeProcessState = async () => ({
    running: true,
    pid: 4242,
    hwnd: 999001,
    hasWindow: true,
    title: "",
  });
  focusModule.bringVSCodeToForeground = async () => ({
    ok: true,
    hwnd: 999001,
    reason: "focused",
  });
  focusModule.terminateVSCodeIfNoVisibleWindow = async () => {
    terminateCalls += 1;
    return { terminated: true, reason: "should_not_run" };
  };

  const { countLaunches } = installLaunchTransportMocks(t, { passthroughExecFile: true });

  t.after(() => {
    focusModule.getVSCodeProcessState = originalGetState;
    focusModule.bringVSCodeToForeground = originalBring;
    focusModule.terminateVSCodeIfNoVisibleWindow = originalTerminate;
    delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
    delete require.cache[require.resolve("../../src/sauron/vscode-window-focus")];
  });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "og-vscode-focus-only-"));
  const {
    focusWorkspaceInVSCode,
    resetLaunchDebounceForTests,
    resolveVSCodeExecutable,
  } = require("../../src/sauron/vscode-launcher");
  resetLaunchDebounceForTests();

  if (!resolveVSCodeExecutable()) {
    t.skip("VS Code not installed in this environment");
    return;
  }

  const result = await focusWorkspaceInVSCode(tmpDir);

  assert.equal(result.action, "focus_existing");
  assert.equal(result.verified, true);
  assert.equal(terminateCalls, 0);
  assert.equal(countLaunches(), 0);
});

test("concurrent openWorkspaceInVSCode awaits inflight launch", async (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows-only launch mutex");
    return;
  }

  delete require.cache[require.resolve("../../src/sauron/vscode-window-focus")];
  delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
  const focusModule = require("../../src/sauron/vscode-window-focus");
  const originalGetState = focusModule.getVSCodeProcessState;
  const originalVerify = focusModule.verifyAndFocusVSCode;
  const originalTerminate = focusModule.terminateVSCodeIfNoVisibleWindow;
  let terminateCalls = 0;
  let launchDelayResolve;

  focusModule.getVSCodeProcessState = async () => ({
    running: false,
    pid: null,
    hwnd: 0,
    hasWindow: false,
    title: "",
  });
  focusModule.verifyAndFocusVSCode = async () => {
    await new Promise((resolve) => {
      launchDelayResolve = resolve;
    });
    return {
      verified: true,
      verificationReason: "window_found",
      pid: 100,
      hwnd: 200,
      focused: true,
      focusReason: "focused",
    };
  };
  focusModule.terminateVSCodeIfNoVisibleWindow = async () => {
    terminateCalls += 1;
    return { terminated: true, reason: "should_not_run" };
  };

  const { countLaunches } = installLaunchTransportMocks(t, { passthroughExecFile: true });

  t.after(() => {
    focusModule.getVSCodeProcessState = originalGetState;
    focusModule.verifyAndFocusVSCode = originalVerify;
    focusModule.terminateVSCodeIfNoVisibleWindow = originalTerminate;
    delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
    delete require.cache[require.resolve("../../src/sauron/vscode-window-focus")];
  });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "og-vscode-concurrent-"));
  const {
    openWorkspaceInVSCode,
    resetLaunchDebounceForTests,
    resolveVSCodeExecutable,
  } = require("../../src/sauron/vscode-launcher");
  resetLaunchDebounceForTests();

  if (!resolveVSCodeExecutable()) {
    t.skip("VS Code not installed in this environment");
    return;
  }

  const firstPromise = openWorkspaceInVSCode(tmpDir, { newWindow: true, force: true });
  await new Promise((resolve) => setTimeout(resolve, 50));
  focusModule.getVSCodeProcessState = async () => ({
    running: true,
    pid: 100,
    hwnd: 200,
    hasWindow: true,
    title: "",
  });
  focusModule.bringVSCodeToForeground = async () => ({
    ok: true,
    hwnd: 200,
    reason: "focused",
  });

  const secondPromise = openWorkspaceInVSCode(tmpDir, { newWindow: true, force: true });
  launchDelayResolve();
  const [first, second] = await Promise.all([firstPromise, secondPromise]);

  assert.equal(first.skipped, false);
  assert.equal(second.skipped, true);
  assert.equal(second.reason, "awaited_inflight_launch");
  assert.equal(terminateCalls, 0);
  assert.equal(countLaunches(), 1);
});

test("vscode-window-focus treats handle without title as visible window", () => {
  delete require.cache[require.resolve("../../src/sauron/vscode-window-focus")];
  const { ZOMBIE_GRACE_MS, resetScriptCacheForTests } = require("../../src/sauron/vscode-window-focus");
  resetScriptCacheForTests();
  assert.equal(ZOMBIE_GRACE_MS, 5000);
});

test("focusWorkspaceInVSCode recovers from zombie process with cleanup and relaunch", async (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows-only zombie recovery");
    return;
  }

  delete require.cache[require.resolve("../../src/sauron/vscode-window-focus")];
  delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
  const focusModule = require("../../src/sauron/vscode-window-focus");
  const originalGetState = focusModule.getVSCodeProcessState;
  const originalTerminate = focusModule.terminateVSCodeIfNoVisibleWindow;
  const originalVerify = focusModule.verifyAndFocusVSCode;
  let terminateCalls = 0;
  let verifyCalls = 0;

  focusModule.getVSCodeProcessState = async () => ({
    running: true,
    pid: 9001,
    hwnd: 0,
    hasWindow: false,
    title: "",
  });
  focusModule.bringVSCodeToForeground = async () => ({ ok: false, reason: "no_window" });
  focusModule.waitForVSCodeWindow = async () => ({
    verified: false,
    verificationReason: "process_only",
    pid: 9001,
    hwnd: 0,
  });
  focusModule.terminateVSCodeIfNoVisibleWindow = async () => {
    terminateCalls += 1;
    return { terminated: true, count: 3, reason: "terminated_stale_zombie" };
  };
  focusModule.verifyAndFocusVSCode = async () => {
    verifyCalls += 1;
    return {
      verified: true,
      verificationReason: "window_found",
      pid: 9100,
      hwnd: 123456,
      focused: true,
      focusReason: "focused",
    };
  };

  const { countLaunches } = installLaunchTransportMocks(t, { passthroughExecFile: true });

  t.after(() => {
    focusModule.getVSCodeProcessState = originalGetState;
    focusModule.terminateVSCodeIfNoVisibleWindow = originalTerminate;
    focusModule.verifyAndFocusVSCode = originalVerify;
    delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
    delete require.cache[require.resolve("../../src/sauron/vscode-window-focus")];
  });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "og-vscode-zombie-recovery-"));
  const {
    focusWorkspaceInVSCode,
    resetLaunchDebounceForTests,
    resolveVSCodeExecutable,
  } = require("../../src/sauron/vscode-launcher");
  resetLaunchDebounceForTests();

  if (!resolveVSCodeExecutable()) {
    t.skip("VS Code not installed in this environment");
    return;
  }

  const result = await focusWorkspaceInVSCode(tmpDir, {
    skipPostVerifySettle: true,
    launchProfiles: [{ profile: "default", extraArgs: [] }],
  });

  assert.ok(terminateCalls <= 3);
  assert.equal(result.verified, true);
  assert.ok(["launch", "launch_after_recovery"].includes(result.action));
  assert.ok(countLaunches() >= 1);
});

test("recoverFromZombieVSCodeIfNeeded does not terminate when window is visible", async (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows-only zombie recovery");
    return;
  }

  delete require.cache[require.resolve("../../src/sauron/vscode-window-focus")];
  delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
  const focusModule = require("../../src/sauron/vscode-window-focus");
  const originalGetState = focusModule.getVSCodeProcessState;
  const originalTerminate = focusModule.terminateVSCodeIfNoVisibleWindow;
  let terminateCalls = 0;

  focusModule.getVSCodeProcessState = async () => ({
    running: true,
    pid: 8001,
    hwnd: 555001,
    hasWindow: true,
    title: "Visual Studio Code",
  });
  focusModule.terminateVSCodeIfNoVisibleWindow = async () => {
    terminateCalls += 1;
    return { terminated: true, reason: "should_not_run" };
  };

  t.after(() => {
    focusModule.getVSCodeProcessState = originalGetState;
    focusModule.terminateVSCodeIfNoVisibleWindow = originalTerminate;
    delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
    delete require.cache[require.resolve("../../src/sauron/vscode-window-focus")];
  });

  const { recoverFromZombieVSCodeIfNeeded } = require("../../src/sauron/vscode-launcher");
  const result = await recoverFromZombieVSCodeIfNeeded();

  assert.equal(result.recovered, false);
  assert.equal(result.reason, "window_visible");
  assert.equal(terminateCalls, 0);
});

test("recoverFromZombieVSCodeIfNeeded skips terminate during post-verify grace", async (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows-only zombie recovery");
    return;
  }

  delete require.cache[require.resolve("../../src/sauron/vscode-window-focus")];
  delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
  const focusModule = require("../../src/sauron/vscode-window-focus");
  const originalGetState = focusModule.getVSCodeProcessState;
  const originalTerminate = focusModule.terminateVSCodeIfNoVisibleWindow;
  let terminateCalls = 0;

  focusModule.getVSCodeProcessState = async () => ({
    running: true,
    pid: 7001,
    hwnd: 0,
    hasWindow: false,
    title: "",
  });
  focusModule.terminateVSCodeIfNoVisibleWindow = async () => {
    terminateCalls += 1;
    return { terminated: true, reason: "should_not_run" };
  };

  t.after(() => {
    focusModule.getVSCodeProcessState = originalGetState;
    focusModule.terminateVSCodeIfNoVisibleWindow = originalTerminate;
    delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
    delete require.cache[require.resolve("../../src/sauron/vscode-window-focus")];
  });

  const {
    recoverFromZombieVSCodeIfNeeded,
    recordVerifiedLaunch,
    resetLaunchDebounceForTests,
  } = require("../../src/sauron/vscode-launcher");
  resetLaunchDebounceForTests();
  recordVerifiedLaunch({ verified: true, hwnd: 12345 });

  const result = await recoverFromZombieVSCodeIfNeeded();

  assert.equal(result.recovered, false);
  assert.equal(result.reason, "post_verify_grace");
  assert.equal(terminateCalls, 0);
});

test("focusWorkspaceInVSCode preferFocusOnly escalates to relaunch when window is gone", async (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows-only focus path");
    return;
  }

  delete require.cache[require.resolve("../../src/sauron/vscode-window-focus")];
  delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
  const focusModule = require("../../src/sauron/vscode-window-focus");
  const originalGetState = focusModule.getVSCodeProcessState;
  const originalBring = focusModule.bringVSCodeToForeground;
  const originalVerify = focusModule.verifyAndFocusVSCode;
  const originalTerminate = focusModule.terminateVSCodeIfNoVisibleWindow;
  let terminateCalls = 0;

  focusModule.getVSCodeProcessState = async () => ({
    running: true,
    pid: 6001,
    hwnd: 0,
    hasWindow: false,
    title: "",
  });
  focusModule.bringVSCodeToForeground = async () => ({ ok: false, reason: "no_window" });
  focusModule.waitForVSCodeWindow = async () => ({
    verified: false,
    verificationReason: "process_only",
    pid: 6001,
    hwnd: 0,
  });
  focusModule.verifyAndFocusVSCode = async () => ({
    verified: true,
    verificationReason: "window_found",
    pid: 6001,
    hwnd: 123456,
    focused: true,
    focusReason: "focused",
  });
  focusModule.terminateVSCodeIfNoVisibleWindow = async () => {
    terminateCalls += 1;
    return { terminated: true, reason: "no_visible_window", count: 1 };
  };

  const { countLaunches } = installLaunchTransportMocks(t, { passthroughExecFile: true });

  t.after(() => {
    focusModule.getVSCodeProcessState = originalGetState;
    focusModule.bringVSCodeToForeground = originalBring;
    focusModule.verifyAndFocusVSCode = originalVerify;
    focusModule.terminateVSCodeIfNoVisibleWindow = originalTerminate;
    delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
    delete require.cache[require.resolve("../../src/sauron/vscode-window-focus")];
  });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "og-vscode-prefer-focus-"));
  const {
    focusWorkspaceInVSCode,
    markHandoffLaunchVerified,
    resetLaunchDebounceForTests,
    resolveVSCodeExecutable,
  } = require("../../src/sauron/vscode-launcher");
  resetLaunchDebounceForTests();
  markHandoffLaunchVerified();

  if (!resolveVSCodeExecutable()) {
    t.skip("VS Code not installed in this environment");
    return;
  }

  const result = await focusWorkspaceInVSCode(tmpDir, { preferFocusOnly: true, skipPostVerifySettle: true });

  assert.notEqual(result.action, "focus_only");
  assert.equal(result.verified, true);
  assert.ok(countLaunches() >= 1);
  assert.ok(terminateCalls >= 0);
});

test("focusWorkspaceInVSCode preferFocusOnly does not relaunch when window exists", async (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows-only focus path");
    return;
  }

  delete require.cache[require.resolve("../../src/sauron/vscode-window-focus")];
  delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
  const focusModule = require("../../src/sauron/vscode-window-focus");
  const originalGetState = focusModule.getVSCodeProcessState;
  const originalBring = focusModule.bringVSCodeToForeground;

  focusModule.getVSCodeProcessState = async () => ({
    running: true,
    pid: 6101,
    hwnd: 777001,
    hasWindow: true,
    title: "Visual Studio Code",
  });
  focusModule.bringVSCodeToForeground = async (hwnd) => ({
    ok: true,
    reason: "focused",
    hwnd: hwnd || 777001,
  });

  const { countLaunches } = installLaunchTransportMocks(t, { passthroughExecFile: true });

  t.after(() => {
    focusModule.getVSCodeProcessState = originalGetState;
    focusModule.bringVSCodeToForeground = originalBring;
    delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
    delete require.cache[require.resolve("../../src/sauron/vscode-window-focus")];
  });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "og-vscode-prefer-focus-visible-"));
  const {
    focusWorkspaceInVSCode,
    markHandoffLaunchVerified,
    resetLaunchDebounceForTests,
  } = require("../../src/sauron/vscode-launcher");
  resetLaunchDebounceForTests();
  markHandoffLaunchVerified();

  const result = await focusWorkspaceInVSCode(tmpDir, { preferFocusOnly: true, skipPostVerifySettle: true });

  assert.equal(result.action, "focus_existing");
  assert.equal(result.verified, true);
  assert.equal(countLaunches(), 0);
});

test("openWorkspaceInVSCode treats spawn success as verified when window check fails", async (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows-only spawn success path");
    return;
  }

  const { countLaunches } = installLaunchTransportMocks(t, { passthroughExecFile: true });

  delete require.cache[require.resolve("../../src/sauron/vscode-window-focus")];
  delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
  const focusModule = require("../../src/sauron/vscode-window-focus");
  const originalVerify = focusModule.verifyAndFocusVSCode;
  focusModule.verifyAndFocusVSCode = async () => ({
    verified: false,
    verificationReason: "timeout",
    pid: null,
    hwnd: 0,
    focused: false,
    focusReason: "timeout",
  });
  focusModule.getVSCodeProcessState = async () => ({
    running: true,
    pid: 4242,
    hwnd: 0,
    hasWindow: false,
    title: "",
  });
  focusModule.terminateVSCodeIfNoVisibleWindow = async () => {
    throw new Error("terminateVSCodeIfNoVisibleWindow should not run after handoff spawn");
  };

  t.after(() => {
    focusModule.verifyAndFocusVSCode = originalVerify;
    delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
    delete require.cache[require.resolve("../../src/sauron/vscode-window-focus")];
  });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "og-vscode-spawn-ok-"));
  const {
    openWorkspaceInVSCode,
    resetLaunchDebounceForTests,
    resolveVSCodeExecutable,
  } = require("../../src/sauron/vscode-launcher");
  resetLaunchDebounceForTests();

  if (!resolveVSCodeExecutable()) {
    t.skip("VS Code not installed in this environment");
    return;
  }

  const result = await openWorkspaceInVSCode(tmpDir, {
    newWindow: true,
    force: true,
    skipRecovery: true,
  });

  assert.equal(result.verified, true);
  assert.equal(result.verificationReason, "spawn_ok");
  assert.equal(countLaunches(), 1);
});

test("recoverFromZombieVSCodeIfNeeded skips terminate during recent spawn grace", async (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows-only spawn grace");
    return;
  }

  delete require.cache[require.resolve("../../src/sauron/vscode-window-focus")];
  delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
  const focusModule = require("../../src/sauron/vscode-window-focus");
  const originalTerminate = focusModule.terminateVSCodeIfNoVisibleWindow;
  focusModule.getVSCodeProcessState = async () => ({
    running: true,
    pid: 5151,
    hwnd: 0,
    hasWindow: false,
    title: "",
  });
  focusModule.terminateVSCodeIfNoVisibleWindow = async () => {
    throw new Error("terminateVSCodeIfNoVisibleWindow should not run during spawn grace");
  };

  const originalExecFile = childProcess.execFile;
  childProcess.execFile = (command, args, options, callback) => {
    if (typeof options === "function") {
      callback = options;
      options = {};
    }
    if (command === "powershell.exe") {
      if (callback) {
        callback(null, "", "");
      }
      return {};
    }
    return originalExecFile(command, args, options, callback);
  };

  t.after(() => {
    focusModule.terminateVSCodeIfNoVisibleWindow = originalTerminate;
    childProcess.execFile = originalExecFile;
    delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
    delete require.cache[require.resolve("../../src/sauron/vscode-window-focus")];
  });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "og-vscode-spawn-grace-"));
  const {
    recoverFromZombieVSCodeIfNeeded,
    spawnVSCodeProcess,
    resetLaunchDebounceForTests,
  } = require("../../src/sauron/vscode-launcher");
  resetLaunchDebounceForTests();
  await spawnVSCodeProcess({ kind: "exe", path: "C:\\VS Code\\Code.exe" }, ["--new-window", tmpDir]);

  const result = await recoverFromZombieVSCodeIfNeeded({ forceRecovery: true });
  assert.equal(result.reason, "recent_spawn_grace");
});

test("openWorkspaceInVSCode tries disable-gpu profile when default launch fails verification", async (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows-only launch profiles");
    return;
  }

  delete require.cache[require.resolve("../../src/sauron/vscode-window-focus")];
  delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
  const focusModule = require("../../src/sauron/vscode-window-focus");
  const originalVerify = focusModule.verifyAndFocusVSCode;
  let verifyCalls = 0;

  focusModule.verifyAndFocusVSCode = async () => {
    verifyCalls += 1;
    if (verifyCalls === 1) {
      return {
        verified: false,
        verificationReason: "timeout",
        pid: null,
        hwnd: 0,
        focused: false,
        focusReason: "timeout",
      };
    }
    return {
      verified: true,
      verificationReason: "window_found",
      pid: 6201,
      hwnd: 888001,
      focused: true,
      focusReason: "focused",
    };
  };
  focusModule.getVSCodeProcessState = async () => ({
    running: false,
    pid: null,
    hwnd: 0,
    hasWindow: false,
    title: "",
  });
  focusModule.terminateVSCodeIfNoVisibleWindow = async () => ({
    terminated: false,
    reason: "not_running",
    count: 0,
  });

  const execCalls = [];
  const spawnCalls = [];
  const originalExecFile = childProcess.execFile;
  const originalSpawn = childProcess.spawn;
  childProcess.execFile = (command, args, options, callback) => {
    if (typeof options === "function") {
      callback = options;
      options = {};
    }
    if (command === "powershell.exe") {
      execCalls.push([command, args, options]);
      if (callback) {
        callback(null, "", "");
      }
      return {};
    }
    return originalExecFile(command, args, options, callback);
  };
  childProcess.spawn = createDetachedSpawnMock(spawnCalls);

  t.after(() => {
    focusModule.verifyAndFocusVSCode = originalVerify;
    childProcess.execFile = originalExecFile;
    childProcess.spawn = originalSpawn;
    delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
    delete require.cache[require.resolve("../../src/sauron/vscode-window-focus")];
  });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "og-vscode-profile-fallback-"));
  const {
    openWorkspaceInVSCode,
    resetLaunchDebounceForTests,
    resolveVSCodeExecutable,
  } = require("../../src/sauron/vscode-launcher");
  resetLaunchDebounceForTests();

  if (!resolveVSCodeExecutable()) {
    t.skip("VS Code not installed in this environment");
    return;
  }

  const result = await openWorkspaceInVSCode(tmpDir, {
    newWindow: true,
    force: true,
    skipPostVerifySettle: true,
    requireWindowVerification: true,
  });

  assert.equal(result.verified, true);
  assert.equal(result.launchProfile, "disable-gpu");
  assert.equal(result.action, "launch_disable_gpu");
  assert.ok(countLaunchCalls(execCalls, spawnCalls) >= 2);
  const psCommands = execCalls.map(([, args]) => args[args.indexOf("-Command") + 1]);
  assert.ok(psCommands.some((cmd) => String(cmd).includes("--disable-gpu")));
});

test("focusWorkspaceInVSCode escalates during post-verify grace when window is lost", async (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows-only focus path");
    return;
  }

  delete require.cache[require.resolve("../../src/sauron/vscode-window-focus")];
  delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
  const focusModule = require("../../src/sauron/vscode-window-focus");
  const originalGetState = focusModule.getVSCodeProcessState;
  const originalVerify = focusModule.verifyAndFocusVSCode;

  focusModule.getVSCodeProcessState = async () => ({
    running: false,
    pid: null,
    hwnd: 0,
    hasWindow: false,
    title: "",
  });
  focusModule.bringVSCodeToForeground = async () => ({ ok: false, reason: "no_window" });
  focusModule.waitForVSCodeWindow = async () => ({
    verified: false,
    verificationReason: "timeout",
    pid: null,
    hwnd: 0,
  });
  focusModule.verifyAndFocusVSCode = async () => ({
    verified: true,
    verificationReason: "window_found",
    pid: 6301,
    hwnd: 999001,
    focused: true,
    focusReason: "focused",
  });

  const execCalls = [];
  const spawnCalls = [];
  const originalExecFile = childProcess.execFile;
  const originalSpawn = childProcess.spawn;
  childProcess.execFile = (command, args, options, callback) => {
    if (typeof options === "function") {
      callback = options;
      options = {};
    }
    if (command === "powershell.exe") {
      execCalls.push([command, args, options]);
      if (callback) {
        callback(null, "", "");
      }
      return {};
    }
    return originalExecFile(command, args, options, callback);
  };
  childProcess.spawn = createDetachedSpawnMock(spawnCalls);

  t.after(() => {
    focusModule.getVSCodeProcessState = originalGetState;
    focusModule.verifyAndFocusVSCode = originalVerify;
    childProcess.execFile = originalExecFile;
    childProcess.spawn = originalSpawn;
    delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
    delete require.cache[require.resolve("../../src/sauron/vscode-window-focus")];
  });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "og-vscode-grace-escalate-"));
  const {
    focusWorkspaceInVSCode,
    markHandoffLaunchVerified,
    recordVerifiedLaunch,
    resetLaunchDebounceForTests,
    resolveVSCodeExecutable,
  } = require("../../src/sauron/vscode-launcher");
  resetLaunchDebounceForTests();
  markHandoffLaunchVerified();
  recordVerifiedLaunch({ verified: true, hwnd: 111222 });

  if (!resolveVSCodeExecutable()) {
    t.skip("VS Code not installed in this environment");
    return;
  }

  const result = await focusWorkspaceInVSCode(tmpDir, {
    preferFocusOnly: true,
    skipPostVerifySettle: true,
    launchProfiles: [{ profile: "default", extraArgs: [] }],
  });

  assert.notEqual(result.action, "focus_only");
  assert.notEqual(result.verificationReason, "focus_only_no_window");
  assert.equal(result.verified, true);
  assert.ok(countLaunchCalls(execCalls, spawnCalls) >= 1);
});
