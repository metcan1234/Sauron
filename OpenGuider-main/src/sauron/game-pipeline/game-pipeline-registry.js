const STEAM_READY_PHASE = {
  phase: 99,
  goal: "Steam-ready: verify standalone player build script at .sauron/steam-build-hint.json",
  complexityHint: "low",
  handoffHint: "Build script pointer: .sauron/steam-build-hint.json",
  verification: { artifact: "steam-build-hint.json" },
};

function withSteamPhase(phases) {
  const maxPhase = phases.reduce((max, entry) => Math.max(max, Number(entry.phase) || 0), 0);
  return [
    ...phases,
    {
      ...STEAM_READY_PHASE,
      phase: maxPhase + 1,
    },
  ];
}

const GAME_PIPELINE_REGISTRY = {
  "unity-empty-v1": {
    id: "unity-empty-v1",
    label: "Boş Unity",
    templateId: null,
    genre: "empty",
    projectType: "game-unity",
    phases: withSteamPhase([
      {
        phase: 1,
        goal: "Verify URP scene and enter play mode via unity_play_mode MCP",
        complexityHint: "low",
        executionMode: "mcp-only",
        verification: { mcp: "unity_play_mode" },
      },
      {
        phase: 2,
        goal: "Add player capsule + follow camera in active scene",
        complexityHint: "low",
      },
      {
        phase: 3,
        goal: "Implement one core mechanic from user task using MCP tools only",
        complexityHint: "low",
      },
      {
        phase: 4,
        goal: "Playtest, fix errors, update scene cache",
        complexityHint: "low",
        verification: { mcp: "unity_play_mode" },
      },
    ]),
  },
  "unity-co-op-climb-v1": {
    id: "unity-co-op-climb-v1",
    label: "Co-op Climb",
    templateId: "co-op-climb",
    genre: "co-op-climb",
    projectType: "game-unity",
    phases: withSteamPhase([
      {
        phase: 1,
        goal: "Verify playable base scene from scaffold + enter play mode via unity_play_mode MCP",
        complexityHint: "low",
        verification: { artifact: "cline-task-complete.json" },
      },
      {
        phase: 2,
        goal: "Wire character controller + stamina system",
        complexityHint: "low",
      },
      {
        phase: 3,
        goal: "Add climb/grab + rope anchor mechanics",
        complexityHint: "low",
      },
      {
        phase: 4,
        goal: "Enable 4-player Netcode host/client skeleton",
        complexityHint: "low",
      },
      {
        phase: 5,
        goal: "Add simple procedural climb chunk or biome block",
        complexityHint: "low",
      },
      {
        phase: 6,
        goal: "Playtest loop via unity_play_mode MCP",
        complexityHint: "low",
        verification: { mcp: "unity_play_mode" },
      },
    ]),
  },
  "unity-horror-coop-v1": {
    id: "unity-horror-coop-v1",
    label: "Horror Co-op",
    templateId: "horror-coop",
    genre: "horror-coop",
    projectType: "game-unity",
    phases: withSteamPhase([
      {
        phase: 1,
        goal: "Verify playable horror base scene from scaffold + first-person setup",
        complexityHint: "low",
      },
      {
        phase: 2,
        goal: "Build map layout + exit door win condition",
        complexityHint: "low",
      },
      {
        phase: 3,
        goal: "Add creature patrol AI + proximity audio hook",
        complexityHint: "low",
      },
      {
        phase: 4,
        goal: "Wire 4-player Netcode lobby skeleton",
        complexityHint: "low",
      },
      {
        phase: 5,
        goal: "Playtest horror loop via unity_play_mode MCP",
        complexityHint: "low",
        verification: { mcp: "unity_play_mode" },
      },
    ]),
  },
  "unity-social-deduction-v1": {
    id: "unity-social-deduction-v1",
    label: "Social Deduction",
    templateId: "social-deduction",
    genre: "social-deduction",
    projectType: "game-unity",
    phases: withSteamPhase([
      {
        phase: 1,
        goal: "Verify playable social-deduction base scene + lobby UI stub from scaffold",
        complexityHint: "low",
      },
      {
        phase: 2,
        goal: "Implement role assignment innocent/impostor/neutral stub",
        complexityHint: "low",
      },
      {
        phase: 3,
        goal: "Add day/night state machine",
        complexityHint: "low",
      },
      {
        phase: 4,
        goal: "Add vote UI and elimination flow",
        complexityHint: "low",
      },
      {
        phase: 5,
        goal: "Wire 8-12 player Netcode lobby skeleton",
        complexityHint: "low",
      },
      {
        phase: 6,
        goal: "Playtest social loop via unity_play_mode MCP",
        complexityHint: "low",
        verification: { mcp: "unity_play_mode" },
      },
    ]),
  },
  "unity-physics-extraction-v1": {
    id: "unity-physics-extraction-v1",
    label: "Physics Extraction",
    templateId: "physics-extraction",
    genre: "physics-extraction",
    projectType: "game-unity",
    phases: withSteamPhase([
      {
        phase: 1,
        goal: "Verify physics sandbox scene + grab/interaction via unity_play_mode MCP",
        complexityHint: "low",
      },
      {
        phase: 2,
        goal: "Add carry weight, stamina drain, and drop physics tuning",
        complexityHint: "low",
      },
      {
        phase: 3,
        goal: "Implement extraction zone + loot value scoring loop",
        complexityHint: "low",
      },
      {
        phase: 4,
        goal: "Wire 2-4 player co-op Netcode + shared inventory skeleton",
        complexityHint: "low",
      },
      {
        phase: 5,
        goal: "Playtest extraction loop via unity_play_mode MCP",
        complexityHint: "low",
        verification: { mcp: "unity_play_mode" },
      },
    ]),
  },
  "unity-arena-pvp-v1": {
    id: "unity-arena-pvp-v1",
    label: "Arena PvP",
    templateId: "arena-pvp",
    genre: "arena-pvp",
    projectType: "game-unity",
    phases: withSteamPhase([
      {
        phase: 1,
        goal: "Verify arena scene + player spawn via unity_play_mode MCP",
        complexityHint: "low",
      },
      {
        phase: 2,
        goal: "Add movement, dash, and hit detection combat core",
        complexityHint: "low",
      },
      {
        phase: 3,
        goal: "Implement round timer, scoreboard, and respawn flow",
        complexityHint: "low",
      },
      {
        phase: 4,
        goal: "Wire 2-8 player Netcode matchmaking skeleton",
        complexityHint: "low",
      },
      {
        phase: 5,
        goal: "Playtest PvP loop via unity_play_mode MCP",
        complexityHint: "low",
        verification: { mcp: "unity_play_mode" },
      },
    ]),
  },
  "unreal-empty-v1": {
    id: "unreal-empty-v1",
    label: "Boş Unreal",
    templateId: null,
    genre: "empty",
    engine: "unreal",
    projectType: "game-unreal",
    phases: withSteamPhase([
      {
        phase: 1,
        goal: "Verify UE level via unreal_get_world_outliner + unreal_play_mode MCP",
        complexityHint: "low",
        verification: { mcp: "unreal_play_mode" },
      },
      {
        phase: 2,
        goal: "Spawn player pawn + camera via unreal_spawn_actor MCP",
        complexityHint: "low",
      },
      {
        phase: 3,
        goal: "Implement core mechanic from brief using unreal_* MCP tools only",
        complexityHint: "low",
      },
      {
        phase: 4,
        goal: "Playtest in PIE, fix errors, update scene cache",
        complexityHint: "low",
        verification: { mcp: "unreal_play_mode" },
      },
    ]),
  },
  "unreal-horror-coop-v1": {
    id: "unreal-horror-coop-v1",
    label: "Horror Co-op (UE)",
    templateId: "horror-coop",
    genre: "horror-coop",
    engine: "unreal",
    projectType: "game-unreal",
    phases: withSteamPhase([
      {
        phase: 1,
        goal: "Verify horror level outliner + first-person pawn via unreal_play_mode",
        complexityHint: "low",
      },
      {
        phase: 2,
        goal: "Build map layout + exit door win condition with unreal_spawn_actor",
        complexityHint: "low",
      },
      {
        phase: 3,
        goal: "Add creature patrol AI blueprint + proximity audio hook",
        complexityHint: "low",
      },
      {
        phase: 4,
        goal: "Wire 4-player listen-server skeleton",
        complexityHint: "low",
      },
      {
        phase: 5,
        goal: "Playtest horror loop in PIE via unreal_play_mode MCP",
        complexityHint: "low",
        verification: { mcp: "unreal_play_mode" },
      },
    ]),
  },
  "unreal-co-op-climb-v1": {
    id: "unreal-co-op-climb-v1",
    label: "Co-op Climb (UE)",
    templateId: "co-op-climb",
    genre: "co-op-climb",
    engine: "unreal",
    projectType: "game-unreal",
    phases: withSteamPhase([
      {
        phase: 1,
        goal: "Verify climb arena level + pawn via unreal_play_mode MCP",
        complexityHint: "low",
      },
      {
        phase: 2,
        goal: "Add stamina + climb/grab interaction via Blueprint",
        complexityHint: "low",
      },
      {
        phase: 3,
        goal: "Add rope anchor + co-op revive hook",
        complexityHint: "low",
      },
      {
        phase: 4,
        goal: "Wire 4-player co-op session skeleton",
        complexityHint: "low",
      },
      {
        phase: 5,
        goal: "Playtest climb loop in PIE via unreal_play_mode MCP",
        complexityHint: "low",
        verification: { mcp: "unreal_play_mode" },
      },
    ]),
  },
  "unreal-physics-extraction-v1": {
    id: "unreal-physics-extraction-v1",
    label: "Physics Extraction (UE)",
    templateId: "physics-extraction",
    genre: "physics-extraction",
    engine: "unreal",
    projectType: "game-unreal",
    phases: withSteamPhase([
      {
        phase: 1,
        goal: "Verify physics grab scene via unreal_get_world_outliner + PIE",
        complexityHint: "low",
      },
      {
        phase: 2,
        goal: "Tune carry weight and Chaos physics interactions",
        complexityHint: "low",
      },
      {
        phase: 3,
        goal: "Implement extraction zone + loot value loop",
        complexityHint: "low",
      },
      {
        phase: 4,
        goal: "Wire 2-4 player co-op session skeleton",
        complexityHint: "low",
      },
      {
        phase: 5,
        goal: "Playtest extraction loop via unreal_play_mode MCP",
        complexityHint: "low",
        verification: { mcp: "unreal_play_mode" },
      },
    ]),
  },
};

function getGamePipeline(pipelineId) {
  return GAME_PIPELINE_REGISTRY[pipelineId] || null;
}

function listGamePipelines() {
  return Object.values(GAME_PIPELINE_REGISTRY).map((p) => ({
    id: p.id,
    label: p.label,
    genre: p.genre,
    templateId: p.templateId,
    projectType: p.projectType,
    phaseCount: p.phases.length,
  }));
}

const { normalizeGamedevEngine } = require("../gamedev-config");

function getDefaultPipelineId(engine = "unity") {
  const normalized = normalizeGamedevEngine(engine);
  if (normalized === "unreal") {
    return "unreal-empty-v1";
  }
  return "unity-empty-v1";
}

function resolvePipelineForTemplate(templateId, engine = "unity") {
  const normalized = normalizeGamedevEngine(engine);
  const key = String(templateId || "").trim();
  if (!key || key === "empty" || key === "custom" || key === "universal" || key === "any") {
    return getDefaultPipelineId(normalized);
  }
  const found = Object.values(GAME_PIPELINE_REGISTRY).find(
    (p) => p.templateId === key && (p.engine || "unity") === normalized,
  );
  return found?.id || getDefaultPipelineId(normalized);
}

function resolvePipelineForEngine(engine, genreResult = {}) {
  const normalized = normalizeGamedevEngine(engine);
  if (genreResult.pipelineId) {
    const pipeline = getGamePipeline(genreResult.pipelineId);
    if (pipeline && (pipeline.engine || "unity") === normalized) {
      return genreResult.pipelineId;
    }
  }
  return getDefaultPipelineId(normalized);
}

module.exports = {
  GAME_PIPELINE_REGISTRY,
  getGamePipeline,
  listGamePipelines,
  getDefaultPipelineId,
  resolvePipelineForTemplate,
  resolvePipelineForEngine,
};
