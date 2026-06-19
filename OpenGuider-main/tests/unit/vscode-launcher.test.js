const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const childProcess = require("child_process");

test("spawnVSCodeProcess on Windows never uses cmd.exe start", async (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows-only spawn guard");
    return;
  }

  const spawnCalls = [];
  const originalSpawn = childProcess.spawn;
  childProcess.spawn = (...args) => {
    spawnCalls.push(args);
    return {
      on() {},
      unref() {},
    };
  };

  t.after(() => {
    childProcess.spawn = originalSpawn;
    delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
  });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "og-vscode-launch-"));
  const {
    spawnVSCodeProcess,
    resetLaunchDebounceForTests,
  } = require("../../src/sauron/vscode-launcher");
  resetLaunchDebounceForTests();

  await spawnVSCodeProcess({ kind: "exe", path: "C:\\VS Code\\Code.exe" }, ["-n", tmpDir]);

  assert.equal(spawnCalls.length, 1);
  const [command, args] = spawnCalls[0];
  assert.notEqual(command, "cmd.exe");
  assert.equal(command, "C:\\VS Code\\Code.exe");
  assert.deepEqual(args, ["-n", tmpDir]);
  assert.equal(args.includes("start"), false);

  spawnCalls.length = 0;
  await spawnVSCodeProcess({ kind: "cmd", path: "C:\\VS Code\\bin\\code.cmd" }, [tmpDir]);
  assert.equal(spawnCalls.length, 1);
  const [cmdCommand, cmdArgs] = spawnCalls[0];
  assert.notEqual(cmdCommand, "cmd.exe");
  assert.equal(cmdCommand, "C:\\VS Code\\bin\\code.cmd");
  assert.equal(cmdArgs.includes("start"), false);
});

test("openWorkspaceInVSCode debounces duplicate launches", async (t) => {
  const spawnCalls = [];
  const originalSpawn = childProcess.spawn;
  childProcess.spawn = (...args) => {
    spawnCalls.push(args);
    return {
      on() {},
      unref() {},
    };
  };

  t.after(() => {
    childProcess.spawn = originalSpawn;
    delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
  });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "og-vscode-debounce-"));
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

  const first = await openWorkspaceInVSCode(tmpDir, { newWindow: true });
  const second = await openWorkspaceInVSCode(tmpDir, { newWindow: true });

  assert.equal(first.skipped, false);
  assert.equal(second.skipped, true);
  assert.equal(second.reason, "debounced");
  assert.equal(spawnCalls.length, 1);
});

test("buildLaunchArgs uses -n only for new windows", () => {
  const { buildLaunchArgs } = require("../../src/sauron/vscode-launcher");
  const workspace = "C:\\work\\demo";
  assert.deepEqual(buildLaunchArgs(workspace, { newWindow: true }), ["-n", workspace]);
  assert.deepEqual(buildLaunchArgs(workspace, { newWindow: false }), [workspace]);
});
