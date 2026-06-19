const { execFileSync, execSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { resolveVSCodeCommand } = require("./handoff");
const { BRIDGE_EXTENSION_ID, listInstalledExtensions } = require("./workspace-setup");

const BRIDGE_VSIX_NAME = "sauron-vscode-bridge.vsix";

function getRepoRoot() {
  return path.resolve(__dirname, "..", "..", "..");
}

function getBridgeProjectRoot() {
  return path.join(getRepoRoot(), "sauron-vscode-bridge");
}

function getBridgeVsixPath() {
  return path.join(getBridgeProjectRoot(), "dist", BRIDGE_VSIX_NAME);
}

function isBridgeInstalled(codeCmd) {
  const installed = listInstalledExtensions(codeCmd);
  return installed.includes(BRIDGE_EXTENSION_ID.toLowerCase());
}

function buildBridgeVsixIfMissing() {
  const vsixPath = getBridgeVsixPath();
  if (fs.existsSync(vsixPath)) {
    return { ok: true, vsixPath, built: false };
  }

  const bridgeRoot = getBridgeProjectRoot();
  if (!fs.existsSync(path.join(bridgeRoot, "package.json"))) {
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

  if (!isBridgeInstalled(codeCmd)) {
    return { ok: false, error: "Bridge kuruldu ama doğrulanamadı. VS Code'u yeniden başlatın." };
  }

  return { ok: true, vsixPath };
}

function ensureBridgeInstalled(options = {}) {
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
  };
}

function installWorkspaceStack(options = {}) {
  return ensureBridgeInstalled(options);
}

module.exports = {
  BRIDGE_VSIX_NAME,
  buildBridgeVsixIfMissing,
  ensureBridgeInstalled,
  getBridgeProjectRoot,
  getBridgeVsixPath,
  installWorkspaceStack,
  isBridgeInstalled,
};
