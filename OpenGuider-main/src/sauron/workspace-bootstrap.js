const fs = require("fs");
const path = require("path");
const { seedSauronRules } = require("./handoff");
const { seedWebDevRules } = require("./web-studio/web-dev-rules");
const { syncFinOpsConfigToWorkspace } = require("./finops/workspace-config");
const { BRIDGE_EXTENSION_ID, CLINE_EXTENSION_IDS } = require("./workspace-setup");

const VSCODE_DIR = ".vscode";
const EXTENSIONS_FILE = "extensions.json";

const WORKSPACE_EXTENSION_RECOMMENDATIONS = [
  CLINE_EXTENSION_IDS[0],
  BRIDGE_EXTENSION_ID,
];

function writeExtensionsRecommendations(workspacePath) {
  const vscodeDir = path.join(workspacePath, VSCODE_DIR);
  const extensionsPath = path.join(vscodeDir, EXTENSIONS_FILE);
  const payload = {
    recommendations: WORKSPACE_EXTENSION_RECOMMENDATIONS,
  };

  fs.mkdirSync(vscodeDir, { recursive: true });

  let existing = null;
  try {
    existing = JSON.parse(fs.readFileSync(extensionsPath, "utf8"));
  } catch {
    existing = null;
  }

  const merged = {
    ...(existing && typeof existing === "object" ? existing : {}),
    recommendations: Array.from(new Set([
      ...(Array.isArray(existing?.recommendations) ? existing.recommendations : []),
      ...WORKSPACE_EXTENSION_RECOMMENDATIONS,
    ])),
  };

  fs.writeFileSync(extensionsPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  return extensionsPath;
}

function ensureSauronDir(workspacePath) {
  const sauronDir = path.join(workspacePath, ".sauron");
  fs.mkdirSync(sauronDir, { recursive: true });
  return sauronDir;
}

async function bootstrapWorkspace(workspacePath, settings = {}) {
  const resolvedPath = String(workspacePath || "").trim();
  if (!resolvedPath || !fs.existsSync(resolvedPath)) {
    return { ok: false, error: "Workspace path is missing or does not exist." };
  }

  ensureSauronDir(resolvedPath);

  const finopsResult = await syncFinOpsConfigToWorkspace({
    ...settings,
    workspacePath: resolvedPath,
  });

  const rulesResult = seedSauronRules(resolvedPath);
  const webDevRulesResult = seedWebDevRules(resolvedPath);
  const extensionsPath = writeExtensionsRecommendations(resolvedPath);

  return {
    ok: true,
    workspacePath: resolvedPath,
    finopsConfigPath: finopsResult.configPath || null,
    rulesSeeded: rulesResult.seeded,
    webDevRulesSeeded: webDevRulesResult.seeded,
    webDevRulesPath: webDevRulesResult.path || null,
    extensionsPath,
  };
}

module.exports = {
  bootstrapWorkspace,
  ensureSauronDir,
  writeExtensionsRecommendations,
  WORKSPACE_EXTENSION_RECOMMENDATIONS,
};
