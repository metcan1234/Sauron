const GAME_PIPELINE_REGISTRY = {
  "unity-empty-v1": {
    id: "unity-empty-v1",
    label: "Boş Unity",
    templateId: null,
    genre: "empty",
    projectType: "game-unity",
    phases: [
      {
        phase: 1,
        goal: "Verify URP scene and enter play mode via unity_play_mode MCP",
        complexityHint: "low",
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
    ],
  },
  "unity-co-op-climb-v1": {
    id: "unity-co-op-climb-v1",
    label: "Co-op Climb",
    templateId: "co-op-climb",
    genre: "co-op-climb",
    projectType: "game-unity",
    phases: [
      {
        phase: 1,
        goal: "Scaffold co-op-climb template + URP scene",
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
    ],
  },
  "unity-horror-coop-v1": {
    id: "unity-horror-coop-v1",
    label: "Horror Co-op",
    templateId: "horror-coop",
    genre: "horror-coop",
    projectType: "game-unity",
    phases: [
      {
        phase: 1,
        goal: "Scaffold horror-coop template + first-person setup",
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
    ],
  },
  "unity-social-deduction-v1": {
    id: "unity-social-deduction-v1",
    label: "Social Deduction",
    templateId: "social-deduction",
    genre: "social-deduction",
    projectType: "game-unity",
    phases: [
      {
        phase: 1,
        goal: "Scaffold social-deduction template + lobby UI stub",
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
    ],
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

function resolvePipelineForTemplate(templateId) {
  const key = String(templateId || "").trim();
  if (!key || key === "empty") {
    return "unity-empty-v1";
  }
  const found = Object.values(GAME_PIPELINE_REGISTRY).find((p) => p.templateId === key);
  return found?.id || "unity-empty-v1";
}

module.exports = {
  GAME_PIPELINE_REGISTRY,
  getGamePipeline,
  listGamePipelines,
  resolvePipelineForTemplate,
};
