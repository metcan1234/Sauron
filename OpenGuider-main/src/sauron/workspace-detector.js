const fs = require("fs");
const path = require("path");

function pathExists(targetPath) {
  try {
    return fs.existsSync(targetPath);
  } catch {
    return false;
  }
}

function readPackageName(workspacePath) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(workspacePath, "package.json"), "utf8"));
    return String(pkg.name || "").trim().toLowerCase();
  } catch {
    return "";
  }
}

function detectWorkspaceLayout(workspacePath) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved || !pathExists(resolved)) {
    return {
      layout: "unknown",
      suggestedProjectType: "generic",
      isOpenGuider: false,
      isBridge: false,
      isNextWeb: false,
    };
  }

  const pkgName = readPackageName(resolved);
  const hasSauronSrc = pathExists(path.join(resolved, "src", "sauron"));
  const hasMainJs = pathExists(path.join(resolved, "main.js"));
  const isOpenGuider = pkgName === "openguider" || (hasMainJs && hasSauronSrc);
  const isBridge = pkgName === "sauron-vscode-bridge"
    || pathExists(path.join(resolved, "src", "extension.ts"));
  const isNextWeb = pathExists(path.join(resolved, "next.config.js"))
    || pathExists(path.join(resolved, "next.config.mjs"))
    || pathExists(path.join(resolved, "app", "layout.tsx"));

  let layout = "generic";
  let suggestedProjectType = "generic";

  if (isOpenGuider) {
    layout = "electron-core";
    suggestedProjectType = "electron-core";
  } else if (isBridge) {
    layout = "bridge-extension";
    suggestedProjectType = "bridge-extension";
  } else if (isNextWeb) {
    layout = "corporate-web";
    suggestedProjectType = "corporate-web";
  }

  const parent = path.dirname(resolved);
  const siblingOpenGuider = pathExists(path.join(parent, "OpenGuider-main", "main.js"));
  const siblingBridge = pathExists(path.join(parent, "sauron-vscode-bridge", "package.json"));
  if (siblingOpenGuider && siblingBridge && layout === "generic") {
    layout = "monorepo-stack";
    suggestedProjectType = "monorepo-stack";
  }

  return {
    layout,
    suggestedProjectType,
    isOpenGuider,
    isBridge,
    isNextWeb,
    packageName: pkgName,
  };
}

module.exports = {
  detectWorkspaceLayout,
  readPackageName,
};
