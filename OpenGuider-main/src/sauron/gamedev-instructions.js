const fs = require("fs");
const path = require("path");
const {
  GAMEDEV_INSTRUCTIONS_DIR,
  GAMEDEV_INSTRUCTIONS_FILE,
  GAMEDEV_INSTRUCTIONS_VERSION,
  GAMEDEV_ENGINE_LABELS,
  normalizeGamedevEngine,
} = require("./gamedev-config");
const { UNITY_BRIDGE_PACKAGE_URL } = require("./gamedev-doctor");

function buildGamedevRulesContent(engine = "unity") {
  const normalized = normalizeGamedevEngine(engine);
  const label = GAMEDEV_ENGINE_LABELS[normalized] || normalized;
  const toolPrefix = normalized;

  return `<!-- sauron-gamedev-version: ${GAMEDEV_INSTRUCTIONS_VERSION} -->
# Sauron Game Dev — MCP Kuralları (${label})

## Altın kural
**LLM düşünür (az), MCP yapar (çok).** 67 MCP tool'un tamamı kullanılabilir — kısıtlama yok.

## Tool-first
| Görev | MCP tool | Dosya okuma |
|-------|----------|-------------|
| Sahne | \`${toolPrefix}_get_hierarchy\` (veya eşdeğeri) | Assets tarama yok |
| Obje | \`${toolPrefix}_create_*\` | — |
| Fizik | \`${toolPrefix}_*physics*\`, rigidbody, raycast | — |
| Playtest | \`${toolPrefix}_play_mode\` veya eşdeğeri | — |

## Token tasarrufu
1. MCP tool çağrıları LLM token harcamaz.
2. Plan: handoff maddelerini takip et; transcript tekrar gönderme.
3. Scene cache: \`.sauron/gamedev-scene-cache.json\`
4. Delta handoff: aynı hedefte workspace tree tekrar yok.
5. Economy model plan için yeterli.

## Onay
Sahne silme, play mode, commit/push → kullanıcı onayı.

## Engine
Aktif: **${label}**. Diğer engine tool'larını bu görevde kullanma.

## Bridge
${normalized === "unity" ? `Unity Package Manager Git URL: ${UNITY_BRIDGE_PACKAGE_URL}` : "Engine editörü + MCP bridge eklentisi açık olmalı."}
`;
}

function seedGamedevRules(workspacePath, engine = "unity") {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return { seeded: false, updated: false, path: null };
  }

  const rulesDir = path.join(resolved, GAMEDEV_INSTRUCTIONS_DIR);
  const rulesPath = path.join(rulesDir, GAMEDEV_INSTRUCTIONS_FILE);
  const content = buildGamedevRulesContent(engine);

  if (!fs.existsSync(rulesPath)) {
    fs.mkdirSync(rulesDir, { recursive: true });
    fs.writeFileSync(rulesPath, content, "utf8");
    return { seeded: true, updated: false, path: rulesPath };
  }

  let existing = "";
  try {
    existing = fs.readFileSync(rulesPath, "utf8");
  } catch {
    existing = "";
  }

  const versionMatch = existing.match(/sauron-gamedev-version:\s*([\d.]+)/);
  const existingVersion = versionMatch ? versionMatch[1] : null;
  if (existingVersion === GAMEDEV_INSTRUCTIONS_VERSION) {
    return { seeded: false, updated: false, path: rulesPath };
  }

  fs.mkdirSync(rulesDir, { recursive: true });
  fs.writeFileSync(rulesPath, content, "utf8");
  return { seeded: false, updated: true, path: rulesPath };
}

module.exports = {
  buildGamedevRulesContent,
  seedGamedevRules,
};
