const fs = require("fs");
const path = require("path");

const PACKS_DIR = __dirname;

const PROJECT_TYPES = [
  "corporate-web",
  "electron-core",
  "bridge-extension",
  "monorepo-stack",
  "generic",
];

const PACKS_BY_PROJECT_TYPE = {
  "corporate-web": ["sauron-web-dev.md"],
  "electron-core": ["sauron-electron-dev.md", "sauron-self-improve.md"],
  "bridge-extension": ["sauron-bridge-dev.md"],
  "monorepo-stack": ["sauron-electron-dev.md", "sauron-bridge-dev.md"],
  generic: [],
};

function normalizeProjectType(projectType) {
  const normalized = String(projectType || "generic").trim();
  return PROJECT_TYPES.includes(normalized) ? normalized : "generic";
}

function getPacksForProjectType(projectType) {
  return PACKS_BY_PROJECT_TYPE[normalizeProjectType(projectType)] || [];
}

function readPackContent(filename) {
  const packPath = path.join(PACKS_DIR, filename);
  if (!fs.existsSync(packPath)) {
    return null;
  }
  return fs.readFileSync(packPath, "utf8");
}

function seedClinerulesPacks(workspacePath, projectType = "generic") {
  const resolvedPath = String(workspacePath || "").trim();
  if (!resolvedPath) {
    return { seeded: [], skipped: [], error: "Workspace path is missing." };
  }

  const rulesDir = path.join(resolvedPath, ".clinerules");
  fs.mkdirSync(rulesDir, { recursive: true });

  const seeded = [];
  const skipped = [];

  for (const filename of getPacksForProjectType(projectType)) {
    const content = readPackContent(filename);
    if (!content) {
      continue;
    }
    const targetPath = path.join(rulesDir, filename);
    if (fs.existsSync(targetPath)) {
      skipped.push(filename);
      continue;
    }
    fs.writeFileSync(targetPath, content, "utf8");
    seeded.push(filename);
  }

  return { seeded, skipped, projectType: normalizeProjectType(projectType) };
}

function getClinerulesPromptHint(projectType) {
  const files = getPacksForProjectType(projectType);
  if (!files.length) {
    return ".clinerules/sauron-workspace.md";
  }
  return files.map((f) => `.clinerules/${f}`).join(", ");
}

module.exports = {
  PROJECT_TYPES,
  PACKS_BY_PROJECT_TYPE,
  normalizeProjectType,
  getPacksForProjectType,
  seedClinerulesPacks,
  getClinerulesPromptHint,
  readPackContent,
};
