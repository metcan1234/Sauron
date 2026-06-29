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

  const toolTable = normalized === "unreal"
    ? `| Görev | MCP tool | Dosya okuma |
|-------|----------|-------------|
| Sahne | \`unreal_get_world_outliner\` | Manuel level tarama yok |
| Obje | \`unreal_spawn_actor\`, \`unreal_set_actor_transform\` | — |
| Blueprint | \`unreal_blueprint\`, \`unreal_compile_blueprint\` | — |
| Playtest | \`unreal_play_mode\` (PIE) | — |
| Asset | \`unreal_asset\`, \`unreal_import_asset\` | — |
| Console | \`unreal_console_command\` | — |`
    : `| Görev | MCP tool | Dosya okuma |
|-------|----------|-------------|
| Sahne | \`unity_get_hierarchy\` | Assets tarama yok |
| Obje | \`unity_create_*\` | — |
| Fizik | \`unity_*physics*\`, rigidbody, raycast | — |
| Playtest | \`unity_play_mode\` | — |
| Script | \`unity_script\` | — |
| Scene | \`unity_scene\` | — |`;

  return `<!-- sauron-gamedev-version: ${GAMEDEV_INSTRUCTIONS_VERSION} -->
# Sauron Game Dev — MCP Kuralları (${label})

## Altın kural
**LLM düşünür (az), MCP yapar (çok).** 74 MCP tool'un tamamı kullanılabilir — kısıtlama yok.

## Tool-first
${toolTable}

## Prompt Fabrikası (v2.2+)
1. Oyun planı: \`.sauron/game-design-brief.json\` — handoff'ta yalnızca pointer + 1 satır özet.
2. **Her oyun fikri desteklenir** (GTA, puzzle, eğitim, mobil, RPG…) — brief archetype analizi + evrensel faz hedefleri.
3. Hazır şablonlar (climb/horror/social) yalnızca Unity + kullanıcı seçerse veya çok güçlü tek-genre sinyali varsa.
4. Wire recipe pointer: \`.sauron/unity-wire-recipes/{genre}-phase{N}.json\` (Unity)
5. Pipeline state: \`.sauron/game-pipeline.json\`

## Token tasarrufu
1. MCP tool çağrıları LLM token harcamaz.
2. Plan: handoff maddelerini takip et; transcript tekrar gönderme.
3. Scene cache: \`.sauron/gamedev-scene-cache.json\`
4. Delta handoff: aynı brief hash'te workspace tree tekrar yok.
5. Economy model plan için yeterli; opsiyonel \`game-dev-plan\` LLM yalnızca ayarlarda açıksa.

## Onay
Sahne silme, play mode, commit/push → kullanıcı onayı.

## Engine
Aktif: **${label}**. Diğer engine tool'larını bu görevde kullanma.

## Bridge
${normalized === "unity"
    ? `Unity Package Manager Git URL: ${UNITY_BRIDGE_PACKAGE_URL}`
    : normalized === "unreal"
      ? "Unreal Editor açık + MCP bridge TCP 55557. Çalışma Kısmı .uproject klasörü olmalı."
      : "Engine editörü + MCP bridge eklentisi açık olmalı."}
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

function buildGamedevGenreRulesContent(genre, engine = "unity") {
  const normalized = normalizeGamedevEngine(engine);
  const guides = {
    "co-op-climb": "Co-op climb: stamina, grab, rope anchors, 4p Netcode. Scripts in Assets/SauronGameDev/co-op-climb.",
    "horror-coop": "Horror co-op: FPS flashlight, exit trigger, creature patrol, 4p lobby. Assets/SauronGameDev/horror-coop.",
    "social-deduction": "Social deduction: lobby, roles, day/night, vote UI, 12p Netcode stub. Assets/SauronGameDev/social-deduction.",
    empty: "Empty Unity: one mechanic from user task via MCP only.",
  };
  const guide = guides[genre] || guides.empty;
  return `<!-- sauron-gamedev-genre-version: ${GAMEDEV_INSTRUCTIONS_VERSION} -->
# Sauron Game Dev — Genre Playbook

Genre: **${genre}**

${guide}

Use MCP tools only for scene edits. Multiplayer: host/client via template NetworkManager scripts.
`;
}

function seedGamedevGenreRules(workspacePath, genre, engine = "unity") {
  if (!genre || genre === "empty") {
    return { seeded: false, path: null };
  }
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return { seeded: false, path: null };
  }
  const fileName = `sauron-game-${genre}.md`;
  const rulesDir = path.join(resolved, GAMEDEV_INSTRUCTIONS_DIR);
  const rulesPath = path.join(rulesDir, fileName);
  const content = buildGamedevGenreRulesContent(genre, engine);
  fs.mkdirSync(rulesDir, { recursive: true });
  fs.writeFileSync(rulesPath, content, "utf8");
  return { seeded: true, path: rulesPath };
}

module.exports = {
  buildGamedevRulesContent,
  buildGamedevGenreRulesContent,
  seedGamedevRules,
  seedGamedevGenreRules,
};
