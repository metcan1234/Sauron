const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { prepareLlmCall, recordLlmUsage } = require("./finops/llm-tracker");
const { estimateTokens } = require("./finops/token-counter");
const { analyzeGameBrief, buildUniversalPhaseGoal } = require("./gamedev-brief-analyzer");

const BRIEF_FILENAME = "game-design-brief.json";
const BRIEF_POINTER = `.sauron/${BRIEF_FILENAME}`;
const DEFAULT_BRIEF_MAX_CHARS = 8000;
const LLM_PLAN_WORD_THRESHOLD = 80;
const PHASE_GOAL_MAX_CHARS = 280;

const GENRE_PHASE_HINTS = {
  "co-op-climb": [
    "Verify playable scaffold scene and play mode",
    "Wire character controller and stamina from brief",
    "Add climb, grab, and rope mechanics per brief",
    "Enable 4-player Netcode host/client skeleton",
    "Add procedural chunk or biome block from brief",
    "Playtest co-op climb loop via unity_play_mode",
  ],
  "horror-coop": [
    "Verify horror base scene and first-person setup",
    "Build map layout and exit win condition from brief",
    "Add creature patrol and proximity audio",
    "Wire 4-player Netcode lobby skeleton",
    "Playtest horror loop via unity_play_mode",
  ],
  "social-deduction": [
    "Verify social-deduction base scene and lobby UI",
    "Implement role assignment from brief",
    "Add day/night state machine",
    "Add vote UI and elimination flow",
    "Wire 8-12 player Netcode lobby skeleton",
    "Playtest social loop via unity_play_mode",
  ],
  empty: [
    "Verify URP scene and enter play mode",
    "Add player capsule and follow camera",
    "Implement core mechanic from brief",
    "Playtest, fix errors, update scene cache",
  ],
};

function getBriefPath(workspacePath) {
  return path.join(String(workspacePath || "").trim(), ".sauron", BRIEF_FILENAME);
}

function hashBriefText(text) {
  return crypto.createHash("sha256").update(String(text || "")).digest("hex").slice(0, 16);
}

function readGameDesignBrief(workspacePath) {
  const briefPath = getBriefPath(workspacePath);
  try {
    if (!fs.existsSync(briefPath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(briefPath, "utf8"));
  } catch {
    return null;
  }
}

function writeGameDesignBrief(workspacePath, {
  masterPrompt,
  genre = "empty",
  pipelineId = "",
  taskText = "",
  phaseGoals = [],
  compiledBy = "heuristic",
} = {}) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return { ok: false, error: "Workspace path required." };
  }

  const maxChars = DEFAULT_BRIEF_MAX_CHARS;
  const fullPrompt = String(masterPrompt || taskText || "").trim();
  const truncated = fullPrompt.length > maxChars;
  const storedPrompt = fullPrompt.slice(0, maxChars);

  const brief = {
    version: 2,
    masterPrompt: storedPrompt,
    taskText: String(taskText || "").trim().slice(0, 600),
    genre,
    pipelineId,
    phaseGoals: Array.isArray(phaseGoals) ? phaseGoals : [],
    compiledBy,
    briefHash: hashBriefText(storedPrompt),
    archetypes: analyzeGameBrief(storedPrompt).archetypes,
    truncated,
    updatedAt: new Date().toISOString(),
  };

  fs.mkdirSync(path.dirname(getBriefPath(resolved)), { recursive: true });
  fs.writeFileSync(getBriefPath(resolved), JSON.stringify(brief, null, 2), "utf8");

  return {
    ok: true,
    brief,
    briefPath: getBriefPath(resolved),
    briefPointer: BRIEF_POINTER,
    briefSummary: storedPrompt.slice(0, 120),
  };
}

function buildBriefHandoffHint(briefSummary) {
  const summary = String(briefSummary || "").trim().slice(0, 120);
  if (!summary) {
    return `Game design brief: ${BRIEF_POINTER}`;
  }
  return `Game design brief: ${BRIEF_POINTER} — ${summary}`;
}

function extractBriefKeywords(text) {
  const lower = String(text || "").toLowerCase();
  const keywords = [];
  const patterns = [
    "multiplayer", "co-op", "coop", "climb", "horror", "flashlight", "vote",
    "impostor", "netcode", "stamina", "rope", "procedural", "lobby", "4 player",
    "8 player", "fps", "survival",
  ];
  for (const p of patterns) {
    if (lower.includes(p)) {
      keywords.push(p);
    }
  }
  return keywords.slice(0, 8);
}

function compilePhaseGoalsHeuristic({ masterPrompt, templatePhases, genre, adaptive = false }) {
  const genreKey = String(genre || "empty").trim();
  const useUniversal = adaptive === true || genreKey === "empty";
  const analysis = analyzeGameBrief(masterPrompt);
  const keywords = extractBriefKeywords(masterPrompt);
  const keywordSuffix = keywords.length > 0 ? ` (brief: ${keywords.slice(0, 3).join(", ")})` : "";
  const promptSnippet = analysis.phaseSnippet;

  if (useUniversal) {
    const totalPhases = (templatePhases || []).length;
    return (templatePhases || []).map((phase) => {
      const goal = buildUniversalPhaseGoal(phase.phase, totalPhases, analysis);
      return {
        ...phase,
        goal: goal.slice(0, PHASE_GOAL_MAX_CHARS),
        estimatedTokens: estimateTokens(goal),
        compiledMode: "universal",
      };
    });
  }

  const hints = GENRE_PHASE_HINTS[genreKey] || GENRE_PHASE_HINTS.empty;

  return (templatePhases || []).map((phase, index) => {
    const hint = hints[index] || phase.goal;
    let goal = hint;
    if (phase.phase >= 2 && promptSnippet) {
      goal = `${hint}${keywordSuffix}. Brief: ${promptSnippet.slice(0, 80)}`;
    }
    return {
      ...phase,
      goal: goal.slice(0, PHASE_GOAL_MAX_CHARS),
      estimatedTokens: estimateTokens(goal),
      compiledMode: "preset",
    };
  });
}

async function compilePhaseGoalsWithLlm({
  masterPrompt,
  templatePhases,
  genre,
  settings = {},
  streamAIResponse,
}) {
  if (typeof streamAIResponse !== "function") {
    return null;
  }

  const llmSettings = await prepareLlmCall(settings, { operation: "game-dev-plan", complexityHint: "low" });
  const phaseList = (templatePhases || []).map((p) => `Phase ${p.phase}: ${p.goal}`).join("\n");

  const prompt = [
    "You are a game dev planner. Given the master game design brief, customize each pipeline phase goal.",
    "Return ONLY a JSON array of strings, one goal per phase, max 200 chars each.",
    `Genre: ${genre}`,
    `Master brief:\n${String(masterPrompt || "").slice(0, 2000)}`,
    `Template phases:\n${phaseList}`,
  ].join("\n\n");

  const completion = await streamAIResponse({
    text: prompt,
    settings: llmSettings,
    operation: "game-dev-plan",
    complexityHint: "low",
  });

  recordLlmUsage({
    settings: llmSettings,
    operation: "game-dev-plan",
    provider: llmSettings.aiProvider,
    model: llmSettings.aiModel,
    promptText: prompt,
    completionText: String(completion || ""),
  });

  let parsed = null;
  try {
    const match = String(completion || "").match(/\[[\s\S]*\]/);
    parsed = match ? JSON.parse(match[0]) : null;
  } catch {
    parsed = null;
  }

  if (!Array.isArray(parsed) || parsed.length !== templatePhases.length) {
    return null;
  }

  return templatePhases.map((phase, index) => ({
    ...phase,
    goal: String(parsed[index] || phase.goal).slice(0, PHASE_GOAL_MAX_CHARS),
    estimatedTokens: estimateTokens(String(parsed[index] || "")),
  }));
}

async function compileGamedevBrief({
  workspacePath,
  masterPrompt,
  taskText = "",
  genre = "empty",
  pipelineId = "",
  templatePhases = [],
  settings = {},
  streamAIResponse = null,
}) {
  const resolved = String(workspacePath || "").trim();
  const combined = String(masterPrompt || taskText || "").trim();
  const wordCount = combined.split(/\s+/).filter(Boolean).length;
  const useLlm = settings.gamedevUseLlmPlan === true
    || (wordCount >= LLM_PLAN_WORD_THRESHOLD && settings.gamedevUseLlmPlan !== false && String(settings.ollamaUrl || "").trim());

  let phases = compilePhaseGoalsHeuristic({
    masterPrompt: combined,
    templatePhases,
    genre,
    adaptive: settings._gamedevAdaptive === true || genre === "empty",
  });
  let compiledBy = "heuristic";

  if (useLlm && streamAIResponse) {
    const llmPhases = await compilePhaseGoalsWithLlm({
      masterPrompt: combined,
      templatePhases,
      genre,
      settings,
      streamAIResponse,
    });
    if (llmPhases) {
      phases = llmPhases;
      compiledBy = String(settings.ollamaUrl || "").trim() ? "ollama-plan" : "llm-plan";
      appendGamedevLedgerEvent(resolved, {
        type: "llm-usage",
        operation: "game-dev-plan",
        tokens: phases.reduce((sum, p) => sum + (p.estimatedTokens || 0), 0),
        source: compiledBy,
      });
    }
  }

  const briefWrite = writeGameDesignBrief(resolved, {
    masterPrompt: combined,
    genre,
    pipelineId,
    taskText,
    phaseGoals: phases.map((p) => ({ phase: p.phase, goal: p.goal })),
    compiledBy,
  });

  return {
    ...briefWrite,
    phases,
    compiledBy,
  };
}

function shouldRecompileBrief(workspacePath, masterPrompt) {
  const existing = readGameDesignBrief(workspacePath);
  if (!existing) {
    return true;
  }
  return existing.briefHash !== hashBriefText(masterPrompt);
}

module.exports = {
  BRIEF_FILENAME,
  BRIEF_POINTER,
  PHASE_GOAL_MAX_CHARS,
  getBriefPath,
  readGameDesignBrief,
  writeGameDesignBrief,
  buildBriefHandoffHint,
  compilePhaseGoalsHeuristic,
  compileGamedevBrief,
  shouldRecompileBrief,
  hashBriefText,
  analyzeGameBrief,
};
