const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const TEMPLATES_ROOT = path.join(PROJECT_ROOT, "templates", "unity");

const GENRE_LABELS = {
  "co-op-climb": "Co-op Climb",
  "horror-coop": "Horror Co-op",
  "social-deduction": "Social Deduction",
};

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function mergeManifestPackages(workspacePath) {
  const manifestPath = path.join(workspacePath, "Packages", "manifest.json");
  const deps = {
    "com.unity.render-pipelines.universal": "14.0.11",
    "com.unity.netcode.gameobjects": "1.8.1",
    "com.unity.transport": "2.3.0",
  };

  let manifest = { dependencies: {} };
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      manifest.dependencies = manifest.dependencies || {};
    } catch {
      manifest = { dependencies: {} };
    }
  } else {
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  }

  for (const [pkg, version] of Object.entries(deps)) {
    if (!manifest.dependencies[pkg]) {
      manifest.dependencies[pkg] = version;
    }
  }

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function scaffoldUnityTemplate(workspacePath, templateId) {
  const resolved = String(workspacePath || "").trim();
  const genre = String(templateId || "").trim();
  if (!resolved) {
    return { ok: false, error: "Workspace path required." };
  }
  if (!genre || !GENRE_LABELS[genre]) {
    return { ok: false, error: `Unknown template: ${templateId}` };
  }

  const src = path.join(TEMPLATES_ROOT, genre);
  if (!fs.existsSync(src)) {
    return { ok: false, error: `Template folder missing: ${src}` };
  }

  const dest = path.join(resolved, "Assets", "SauronGameDev", genre);
  copyDirRecursive(src, dest);
  mergeManifestPackages(resolved);

  const markerPath = path.join(resolved, ".sauron", "gamedev-template.json");
  fs.mkdirSync(path.dirname(markerPath), { recursive: true });
  fs.writeFileSync(markerPath, JSON.stringify({
    templateId: genre,
    label: GENRE_LABELS[genre],
    scaffoldedAt: new Date().toISOString(),
    assetsPath: `Assets/SauronGameDev/${genre}`,
  }, null, 2), "utf8");

  return {
    ok: true,
    templateId: genre,
    label: GENRE_LABELS[genre],
    assetsPath: dest,
  };
}

module.exports = {
  GENRE_LABELS,
  scaffoldUnityTemplate,
};
