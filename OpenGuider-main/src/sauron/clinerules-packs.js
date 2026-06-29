const fs = require("fs");
const path = require("path");

const CLINERULES_DIR = ".clinerules";

const PACKS = {
  "corporate-web": {
    files: ["sauron-web-dev.md"],
    content: {
      "sauron-web-dev.md": `# Sauron Web Dev
- Next.js App Router + Tailwind + TypeScript
- SEO, a11y, responsive quality gates
- Reuse components/ before creating new files
`,
    },
  },
  "electron-core": {
    files: ["sauron-electron-dev.md", "sauron-self-improve.md"],
    content: {
      "sauron-electron-dev.md": `# Sauron Electron Dev
- Main/renderer IPC boundaries
- Minimal diff; match existing patterns
`,
      "sauron-self-improve.md": `# Sauron Self Improve
- Small, testable changes only
`,
    },
  },
  "bridge-extension": {
    files: ["sauron-bridge-dev.md"],
    content: {
      "sauron-bridge-dev.md": `# Sauron Bridge Dev
- VS Code extension + handoff v3
- FinOps trackingOnly must stay true
`,
    },
  },
  "monorepo-stack": {
    files: ["sauron-electron-dev.md", "sauron-bridge-dev.md"],
    content: {},
  },
  "game-unity": {
    files: ["game-unity.md"],
    content: {
      "game-unity.md": `# Sauron Game Unity
- MCP-first: unity_get_hierarchy, unity_play_mode, unity_script
- Scene cache: .sauron/gamedev-scene-cache.json
- Steam-ready build pointer: .sauron/steam-build-hint.json
- Netcode/co-op: verify host/client skeleton before polish
`,
    },
  },
  "game-unreal": {
    files: ["game-unreal.md"],
    content: {
      "game-unreal.md": `# Sauron Game Unreal
- MCP-first: unreal_get_world_outliner, unreal_play_mode, unreal_blueprint
- Scene cache + executePython pointer when needed
- Steam-ready build pointer: .sauron/steam-build-hint.json
- PIE playtest before shipping phase
`,
    },
  },
  generic: {
    files: [],
    content: {},
  },
};

function normalizeProjectType(value) {
  const key = String(value || "").trim();
  if (PACKS[key]) {
    return key;
  }
  if (key === "game") {
    return "game-unity";
  }
  return "generic";
}

function seedClinerulesPacks(workspacePath, projectType = "generic") {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return { seeded: [] };
  }

  const normalized = normalizeProjectType(projectType);
  const pack = PACKS[normalized] || PACKS.generic;
  const targetDir = path.join(resolved, CLINERULES_DIR);
  fs.mkdirSync(targetDir, { recursive: true });

  const seeded = [];
  for (const fileName of pack.files) {
    const targetPath = path.join(targetDir, fileName);
    if (fs.existsSync(targetPath)) {
      continue;
    }
    const body = pack.content[fileName] || `# ${fileName}\n`;
    fs.writeFileSync(targetPath, body, "utf8");
    seeded.push(fileName);
  }

  return { seeded, projectType: normalized };
}

module.exports = {
  CLINERULES_DIR,
  PACKS,
  normalizeProjectType,
  seedClinerulesPacks,
};
