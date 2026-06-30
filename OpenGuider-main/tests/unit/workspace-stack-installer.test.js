const test = require("node:test");
const assert = require("node:assert/strict");
const childProcess = require("child_process");

test("isBridgeInstalled uses marker without listing extensions", () => {
  delete require.cache[require.resolve("../../src/sauron/bridge-install-marker")];
  delete require.cache[require.resolve("../../src/sauron/vscode-launcher")];
  delete require.cache[require.resolve("../../src/sauron/workspace-setup")];
  delete require.cache[require.resolve("../../src/sauron/workspace-stack-installer")];

  const { writeBridgeMarker, clearBridgeMarkerForTests } = require("../../src/sauron/bridge-install-marker");
  const { isBridgeInstalled, resetBridgeInstallStateForTests } = require("../../src/sauron/workspace-stack-installer");

  clearBridgeMarkerForTests();
  resetBridgeInstallStateForTests();
  writeBridgeMarker({
    extensionId: "sauron-local.sauron-vscode-bridge",
    installedAt: new Date().toISOString(),
  });

  const originalExecSync = childProcess.execSync;
  childProcess.execSync = () => {
    throw new Error("list-extensions should not run when marker is valid");
  };

  try {
    assert.equal(isBridgeInstalled("C:\\fake\\code.cmd"), true);
  } finally {
    childProcess.execSync = originalExecSync;
    clearBridgeMarkerForTests();
    resetBridgeInstallStateForTests();
    delete require.cache[require.resolve("../../src/sauron/workspace-stack-installer")];
  }
});

test("installBridgeExtension fail-open writes marker when CLI verify fails", () => {
  delete require.cache[require.resolve("../../src/sauron/bridge-install-marker")];
  delete require.cache[require.resolve("../../src/sauron/workspace-stack-installer")];
  delete require.cache[require.resolve("../../src/sauron/workspace-setup")];

  const fs = require("fs");
  const os = require("os");
  const path = require("path");
  const { readBridgeMarker, clearBridgeMarkerForTests } = require("../../src/sauron/bridge-install-marker");
  const {
    installBridgeExtension,
    resetBridgeInstallStateForTests,
  } = require("../../src/sauron/workspace-stack-installer");

  clearBridgeMarkerForTests();
  resetBridgeInstallStateForTests();

  const fakeCli = path.join(os.tmpdir(), "sauron-fake-code.cmd");
  fs.writeFileSync(fakeCli, "@echo off\r\n", "utf8");
  const fakeVsix = path.join(os.tmpdir(), "sauron-fake-bridge.vsix");
  fs.writeFileSync(fakeVsix, "fake", "utf8");

  const originalExecSync = childProcess.execSync;
  childProcess.execSync = (command) => {
    if (String(command).includes("--install-extension")) {
      return "";
    }
    throw new Error("unexpected execSync");
  };

  delete require.cache[require.resolve("../../src/sauron/workspace-setup")];
  const setup = require("../../src/sauron/workspace-setup");
  const originalList = setup.listInstalledExtensions;
  setup.listInstalledExtensions = () => [];

  try {
    const result = installBridgeExtension(fakeCli, fakeVsix);
    assert.equal(result.ok, true);
    assert.equal(result.verified, false);
    assert.ok(readBridgeMarker()?.extensionId);
  } finally {
    childProcess.execSync = originalExecSync;
    setup.listInstalledExtensions = originalList;
    clearBridgeMarkerForTests();
    resetBridgeInstallStateForTests();
    try {
      fs.unlinkSync(fakeCli);
      fs.unlinkSync(fakeVsix);
    } catch {
      // ignore
    }
    delete require.cache[require.resolve("../../src/sauron/workspace-stack-installer")];
    delete require.cache[require.resolve("../../src/sauron/workspace-setup")];
  }
});
