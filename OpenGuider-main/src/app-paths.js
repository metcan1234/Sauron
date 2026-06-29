const path = require("path");

const BRIDGE_VSIX_NAME = "sauron-vscode-bridge.vsix";

function getElectronApp() {
  try {
    return require("electron").app;
  } catch {
    return null;
  }
}

function isPackaged() {
  const app = getElectronApp();
  return Boolean(app?.isPackaged);
}

function getProjectRoot() {
  return path.resolve(__dirname, "..");
}

function getMonorepoRoot() {
  return path.resolve(getProjectRoot(), "..");
}

function resolveAppAsset(...segments) {
  return path.join(getProjectRoot(), ...segments);
}

function getPreloadPath() {
  return resolveAppAsset("preload.js");
}

function getRendererDir() {
  return resolveAppAsset("renderer");
}

function getBridgeProjectRoot() {
  if (isPackaged()) {
    return null;
  }
  return path.join(getMonorepoRoot(), "sauron-vscode-bridge");
}

function getBridgeVsixPath() {
  if (isPackaged()) {
    return path.join(process.resourcesPath, "bridge", BRIDGE_VSIX_NAME);
  }
  return path.join(getBridgeProjectRoot(), "dist", BRIDGE_VSIX_NAME);
}

module.exports = {
  BRIDGE_VSIX_NAME,
  getElectronApp,
  isPackaged,
  getProjectRoot,
  getMonorepoRoot,
  resolveAppAsset,
  getPreloadPath,
  getRendererDir,
  getBridgeProjectRoot,
  getBridgeVsixPath,
};
