const fs = require("fs");
const path = require("path");

function readPackageJson(workspacePath) {
  const packagePath = path.join(workspacePath, "package.json");

  if (!fs.existsSync(packagePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(packagePath, "utf8"));
  } catch {
    return null;
  }
}

function hasNextDependency(pkg) {
  const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
  return Boolean(deps.next);
}

function detectNextProject(workspacePath) {
  const resolvedPath = String(workspacePath || "").trim();
  if (!resolvedPath || !fs.existsSync(resolvedPath)) {
    return {
      isNext: false,
      exists: false,
      workspacePath: resolvedPath,
      reason: "Workspace path missing or does not exist",
    };
  }

  const pkg = readPackageJson(resolvedPath);
  if (!pkg) {
    return {
      isNext: false,
      exists: true,
      workspacePath: resolvedPath,
      reason: "package.json not found",
    };
  }

  const nextInstalled = hasNextDependency(pkg);
  const appDir = path.join(resolvedPath, "app");
  const pagesDir = path.join(resolvedPath, "pages");
  const hasAppRouter = fs.existsSync(appDir);
  const hasPagesRouter = fs.existsSync(pagesDir);
  const briefPath = path.join(resolvedPath, ".sauron", "web-brief.json");
  const hasWebBrief = fs.existsSync(briefPath);

  const isNext = nextInstalled && (hasAppRouter || hasPagesRouter);

  return {
    isNext,
    exists: true,
    workspacePath: resolvedPath,
    nextInstalled,
    hasAppRouter,
    hasPagesRouter,
    hasWebBrief,
    briefPath: hasWebBrief ? briefPath : null,
    packageName: pkg.name || null,
    scripts: pkg.scripts || {},
    reason: isNext ? null : "Next.js dependency or app/pages directory not detected",
  };
}

module.exports = {
  detectNextProject,
  readPackageJson,
  hasNextDependency,
};
