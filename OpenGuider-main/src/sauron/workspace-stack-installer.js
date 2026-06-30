const { execFileSync, execSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const {
  BRIDGE_VSIX_NAME,
  getBridgeProjectRoot,
  getBridgeVsixPath,
  isPackaged,
} = require("../app-paths");
const { resolveVSCodeCommand } = require("./handoff");
const { BRIDGE_EXTENSION_ID, listInstalledExtensions } = require("./workspace-setup");
const {
  getBridgeMarkerPath,
  readBridgeMarker,
  writeBridgeMarker,
  isBridgeMarkerValid,
  clearBridgeMarkerForTests,
} = require("./bridge-install-marker");
const { setBridgeInstallInProgress } = require("./vscode-launcher");

let ensureBridgeInstallPromise = null;

function buildBridgeVsixIfMissing() {
  const vsixPath = getBridgeVsixPath();
  if (fs.existsSync(vsixPath)) {
    return { ok: true, vsixPath, built: false };
  }

  if (isPackaged()) {
    return {
      ok: false,
      error: `Paketlenmiş uygulamada Bridge VSIX bulunamadı: ${vsixPath}`,
    };
  }

  const bridgeRoot = getBridgeProjectRoot();
  if (!bridgeRoot || !fs.existsSync(path.join(bridgeRoot, "package.json"))) {
    return { ok: false, error: "sauron-vscode-bridge projesi bulunamadı." };
  }

  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const installResult = spawnSync(npmCmd, ["install"], {
    cwd: bridgeRoot,
    stdio: "pipe",
    encoding: "utf8",
    windowsHide: true,
  });
  if (installResult.status !== 0) {
    return {
      ok: false,
      error: installResult.stderr || installResult.stdout || "npm install failed for bridge.",
    };
  }

  const packageResult = spawnSync(npmCmd, ["run", "package:vsix"], {
    cwd: bridgeRoot,
    stdio: "pipe",
    encoding: "utf8",
    windowsHide: true,
  });
  if (packageResult.status !== 0) {
    return {
      ok: false,
      error: packageResult.stderr || packageResult.stdout || "Bridge VSIX build failed.",
    };
  }

  if (!fs.existsSync(vsixPath)) {
    return { ok: false, error: `VSIX oluşturulamadı: ${vsixPath}` };
  }

  return { ok: true, vsixPath, built: true };
}

function isBridgeInstalled(codeCmd, options = {}) {
  if (!options.skipMarker && isBridgeMarkerValid(BRIDGE_EXTENSION_ID)) {
    return true;
  }
  const installed = listInstalledExtensions(codeCmd);
  return installed.includes(BRIDGE_EXTENSION_ID.toLowerCase());
}

function installBridgeExtension(codeCmd, vsixPath) {
  if (!codeCmd || !fs.existsSync(vsixPath)) {
    return { ok: false, error: "VS Code CLI veya VSIX dosyası bulunamadı." };
  }

  try {
    if (process.platform === "win32") {
      execSync(`"${codeCmd}" --install-extension "${vsixPath}" --force`, {
        encoding: "utf8",
        timeout: 120000,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
    } else {
      execFileSync(codeCmd, ["--install-extension", vsixPath, "--force"], {
        encoding: "utf8",
        timeout: 120000,
        stdio: ["ignore", "pipe", "pipe"],
      });
    }
  } catch (error) {
    return {
      ok: false,
      error: error?.stderr?.toString?.() || error?.message || "Bridge kurulumu başarısız.",
    };
  }

  if (isBridgeInstalled(codeCmd, { skipMarker: false })) {
    writeBridgeMarker({
      extensionId: BRIDGE_EXTENSION_ID,
      installedAt: new Date().toISOString(),
      codeCmd: String(codeCmd || ""),
      vsixPath: String(vsixPath || ""),
    });
    return { ok: true, vsixPath, verified: true };
  }

  writeBridgeMarker({
    extensionId: BRIDGE_EXTENSION_ID,
    installedAt: new Date().toISOString(),
    codeCmd: String(codeCmd || ""),
    vsixPath: String(vsixPath || ""),
    verifyWarning: true,
  });
  return {
    ok: true,
    vsixPath,
    verified: false,
    verifyWarning: "Bridge kuruldu ama CLI doğrulaması başarısız — marker ile devam ediliyor.",
  };
}

async function performEnsureBridgeInstalled(options = {}) {
  const force = Boolean(options.force);
  const codeCmd = resolveVSCodeCommand();

  if (!codeCmd || !fs.existsSync(codeCmd)) {
    return { ok: false, error: "VS Code CLI (code) bulunamadı.", codeCmd: null };
  }

  if (!force && isBridgeInstalled(codeCmd)) {
    return { ok: true, alreadyInstalled: true, codeCmd };
  }

  const buildResult = buildBridgeVsixIfMissing();
  if (!buildResult.ok) {
    return { ...buildResult, codeCmd };
  }

  const installResult = installBridgeExtension(codeCmd, buildResult.vsixPath);
  if (!installResult.ok) {
    return { ...installResult, codeCmd };
  }

  return {
    ok: true,
    alreadyInstalled: false,
    built: buildResult.built,
    vsixPath: buildResult.vsixPath,
    codeCmd,
    verifyWarning: installResult.verifyWarning || null,
    verified: installResult.verified !== false,
  };
}

function ensureBridgeInstalled(options = {}) {
  if (ensureBridgeInstallPromise) {
    return ensureBridgeInstallPromise;
  }

  const installPromise = performEnsureBridgeInstalled(options)
    .finally(() => {
      if (ensureBridgeInstallPromise === installPromise) {
        ensureBridgeInstallPromise = null;
      }
      setBridgeInstallInProgress(null);
    });

  ensureBridgeInstallPromise = installPromise;
  setBridgeInstallInProgress(installPromise);
  return installPromise;
}

function installWorkspaceStack(options = {}) {
  return ensureBridgeInstalled(options);
}

function resetBridgeInstallStateForTests() {
  ensureBridgeInstallPromise = null;
  setBridgeInstallInProgress(null);
  clearBridgeMarkerForTests();
}

module.exports = {
  BRIDGE_VSIX_NAME,
  buildBridgeVsixIfMissing,
  ensureBridgeInstalled,
  getBridgeProjectRoot,
  getBridgeVsixPath,
  getBridgeMarkerPath,
  installWorkspaceStack,
  isBridgeInstalled,
  installBridgeExtension,
  readBridgeMarker,
  resetBridgeInstallStateForTests,
  writeBridgeMarker,
};
