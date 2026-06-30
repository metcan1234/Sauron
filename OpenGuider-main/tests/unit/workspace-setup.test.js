const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");

test("resolveHeadlessVSCodeCli maps configured Code.exe to code.cmd", (t) => {
  if (process.platform !== "win32") {
    t.skip("Windows-only VS Code path mapping");
    return;
  }

  const localAppData = process.env.LOCALAPPDATA || "";
  const codeExe = path.join(localAppData, "Programs", "Microsoft VS Code", "Code.exe");
  const codeCmd = path.join(localAppData, "Programs", "Microsoft VS Code", "bin", "code.cmd");
  if (!fs.existsSync(codeExe) || !fs.existsSync(codeCmd)) {
    t.skip("VS Code install not found in default location");
    return;
  }

  delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
  delete require.cache[require.resolve("../../src/sauron/workspace-setup")];
  const { setConfiguredVscodePath, resolveVSCodeCommand, resolveVSCodeAppExe } = require("../../src/sauron/vscode-launcher");
  const { resolveHeadlessVSCodeCli } = require("../../src/sauron/workspace-setup");

  setConfiguredVscodePath(codeExe);
  assert.equal(resolveVSCodeAppExe(), codeExe);
  assert.match(resolveVSCodeCommand() || "", /code\.cmd$/i);
  assert.equal(resolveHeadlessVSCodeCli(codeExe), codeCmd);
});

test("checkWorkspacePrerequisites skips extension probe when requested", () => {
  delete require.cache[require.resolve("../../src/sauron/workspace-setup")];
  const { checkWorkspacePrerequisites } = require("../../src/sauron/workspace-setup");

  const originalExecSync = childProcess.execSync;
  childProcess.execSync = () => {
    throw new Error("should not list extensions during startup probe skip");
  };

  try {
    const result = checkWorkspacePrerequisites({ probeExtensions: false });
    assert.equal(result.extensionProbeSkipped, true);
    assert.equal(result.clineExtension, null);
    assert.equal(result.bridgeExtension, null);
  } finally {
    childProcess.execSync = originalExecSync;
    delete require.cache[require.resolve("../../src/sauron/workspace-setup")];
  }
});

test("listInstalledExtensions refuses to invoke Code.exe directly", () => {
  delete require.cache[require.resolve("../../src/sauron/workspace-setup")];
  const { listInstalledExtensions } = require("../../src/sauron/workspace-setup");

  const originalExecSync = childProcess.execSync;
  childProcess.execSync = () => {
    throw new Error("Code.exe must not be invoked for extension listing");
  };

  try {
    const extensions = listInstalledExtensions("C:\\Programs\\Microsoft VS Code\\Code.exe");
    assert.deepEqual(extensions, []);
  } finally {
    childProcess.execSync = originalExecSync;
    delete require.cache[require.resolve("../../src/sauron/workspace-setup")];
  }
});
