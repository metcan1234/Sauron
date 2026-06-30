const fs = require("fs");
const path = require("path");

function getOpenGuiderRoot() {
  return path.resolve(__dirname, "..", "..");
}

function getSauronAsistanRoot() {
  return path.resolve(getOpenGuiderRoot(), "..");
}

function getBundledWorkspacePath() {
  return path.join(getSauronAsistanRoot(), "workspace");
}

function getBundledGooseExePath() {
  return path.join(getSauronAsistanRoot(), "goose-package", "goose.exe");
}

function isSauronAsistanLayout() {
  const root = getSauronAsistanRoot();
  try {
    return (
      fs.existsSync(path.join(root, "OpenGuider-main", "main.js"))
      && fs.existsSync(path.join(root, "goose-package"))
      && fs.existsSync(path.join(root, "workspace"))
    );
  } catch {
    return false;
  }
}

module.exports = {
  getOpenGuiderRoot,
  getSauronAsistanRoot,
  getBundledWorkspacePath,
  getBundledGooseExePath,
  isSauronAsistanLayout,
};
