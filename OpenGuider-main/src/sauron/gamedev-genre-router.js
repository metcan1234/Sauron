const { resolvePipelineForTemplate } = require("./game-pipeline/game-pipeline-registry");
const { detectArchetypes } = require("./gamedev-brief-analyzer");
const { normalizeGamedevEngine } = require("./gamedev-config");

const PRESET_GENRES = ["co-op-climb", "horror-coop", "social-deduction", "physics-extraction", "arena-pvp"];
const CUSTOM_TEMPLATE_ALIASES = new Set(["empty", "custom", "universal", "any", ""]);

const GENRE_KEYWORDS = {
  "co-op-climb": [
    "peak", "tırman", "tirman", "climb", "climbing", "dağ", "dag", "mountain",
    "rope", "stamina", "co-op climb", "coop climb",
  ],
  "horror-coop": [
    "zort", "korku", "horror", "scary", "creature", "escape", "kaçış", "kacis",
    "flashlight", "survival horror",
  ],
  "social-deduction": [
    "feign", "among us", "impostor", "imposter", "social deduction", "rol oyun",
    "vote", "oylama", "werewolf", "mafia",
  ],
  "physics-extraction": [
    "repo", "extraction", "loot", "carry", "physics co-op", "weight", "garbage",
    "salvage", "haul", "co-op horror extraction",
  ],
  "arena-pvp": [
    "arena", "pvp", "battle royale", "deathmatch", "duel", "fighter", "brawl",
    "team deathmatch", "round-based combat",
  ],
};

/** Strong single-keyword hits (game name references) bypass min score */
const PRESET_STRONG_SIGNALS = {
  "co-op-climb": ["peak", "co-op climb", "coop climb"],
  "horror-coop": ["zort", "survival horror"],
  "social-deduction": ["feign", "among us", "social deduction"],
  "physics-extraction": ["extraction", "repo-style", "physics extraction"],
  "arena-pvp": ["arena pvp", "deathmatch", "battle royale"],
};

const PRESET_MIN_SCORE = 4;
const AMBIGUITY_GAP = 2;
const RICH_BRIEF_WORD_THRESHOLD = 22;

function scoreGenre(text, keywords) {
  const lower = String(text || "").toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (lower.includes(kw)) {
      score += kw.length > 4 ? 2 : 1;
    }
  }
  return score;
}

function hasStrongPresetSignal(text, genre) {
  const lower = String(text || "").toLowerCase();
  const signals = PRESET_STRONG_SIGNALS[genre] || [];
  return signals.some((sig) => lower.includes(sig));
}

function resolveCustomPipeline(reason, extra = {}) {
  const engine = normalizeGamedevEngine(extra.engine || "unity");
  const pipelineId = engine === "unreal" ? "unreal-empty-v1" : "unity-empty-v1";
  return {
    genre: "empty",
    engine,
    templateId: null,
    pipelineId,
    reason,
    adaptive: true,
    presetScaffold: false,
    ...extra,
  };
}

function resolvePresetPipeline(genre, reason, score = 0, engine = "unity") {
  const normalizedEngine = normalizeGamedevEngine(engine);
  return {
    genre,
    engine: normalizedEngine,
    templateId: genre,
    pipelineId: resolvePipelineForTemplate(genre, normalizedEngine),
    reason,
    score,
    adaptive: false,
    presetScaffold: normalizedEngine === "unity",
  };
}

function resolveConfiguredTemplate(configured, engine = "unity") {
  const normalizedEngine = normalizeGamedevEngine(engine);
  if (normalizedEngine === "unreal") {
    return resolveCustomPipeline("configured-unreal", { engine: "unreal" });
  }
  if (CUSTOM_TEMPLATE_ALIASES.has(configured)) {
    return resolveCustomPipeline("configured-custom", { engine: normalizedEngine });
  }
  if (PRESET_GENRES.includes(configured)) {
    return resolvePresetPipeline(configured, "configured-preset", 0, normalizedEngine);
  }
  return resolveCustomPipeline("configured-fallback", { engine: normalizedEngine });
}

function scoreAllPresets(text) {
  const scores = {};
  for (const genre of PRESET_GENRES) {
    scores[genre] = scoreGenre(text, GENRE_KEYWORDS[genre]);
  }
  return scores;
}

function resolveAutoGenre(text, engine = "unity") {
  const normalizedEngine = normalizeGamedevEngine(engine);
  const trimmed = String(text || "").trim();

  if (normalizedEngine === "unreal") {
    return resolveCustomPipeline("unreal-engine-default", {
      engine: "unreal",
      archetypes: trimmed ? detectArchetypes(trimmed) : [],
    });
  }

  if (!trimmed) {
    return resolveCustomPipeline("default-empty", { engine: normalizedEngine });
  }

  const archetypes = detectArchetypes(trimmed);
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

  // Rich, multi-archetype briefs → universal custom pipeline (GTA, math+mobile, etc.)
  if (archetypes.length >= 2) {
    return resolveCustomPipeline("multi-archetype-brief", { archetypes, engine: normalizedEngine });
  }

  if (wordCount >= RICH_BRIEF_WORD_THRESHOLD && archetypes.length === 1) {
    const archetype = archetypes[0];
    const presetOverlap = PRESET_GENRES.find((genre) => {
      if (genre === "horror-coop" && archetype === "horror") {
        return true;
      }
      if (genre === "social-deduction" && archetype === "social") {
        return true;
      }
      return false;
    });
    if (!presetOverlap) {
      return resolveCustomPipeline("rich-universal-brief", { archetypes, engine: normalizedEngine });
    }
  }

  const scores = scoreAllPresets(trimmed);
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [bestGenre, bestScore] = ranked[0];
  const secondScore = ranked[1]?.[1] || 0;
  const activeMatches = ranked.filter(([, score]) => score > 0);

  if (hasStrongPresetSignal(trimmed, bestGenre) && bestScore > 0) {
    return resolvePresetPipeline(bestGenre, "strong-preset-signal", bestScore, normalizedEngine);
  }

  if (activeMatches.length > 1 && bestScore - secondScore < AMBIGUITY_GAP) {
    return resolveCustomPipeline("ambiguous-preset-keywords", { scores, engine: normalizedEngine });
  }

  if (bestScore < PRESET_MIN_SCORE) {
    return resolveCustomPipeline("low-preset-confidence", { scores, archetypes, engine: normalizedEngine });
  }

  if (wordCount >= RICH_BRIEF_WORD_THRESHOLD) {
    return resolveCustomPipeline("rich-brief-prefer-custom", { scores, archetypes, engine: normalizedEngine });
  }

  return resolvePresetPipeline(bestGenre, "keyword-match", bestScore, normalizedEngine);
}

function resolveGamedevGenre(taskText, settings = {}) {
  const engine = normalizeGamedevEngine(settings.gamedevActiveEngine);
  const configured = String(settings.gamedevDefaultTemplate || "custom").trim();

  if (configured && configured !== "auto") {
    return resolveConfiguredTemplate(configured, engine);
  }

  return resolveAutoGenre(taskText, engine);
}

function isAdaptivePipeline(genreResult) {
  return genreResult?.adaptive === true || genreResult?.genre === "empty";
}

module.exports = {
  PRESET_GENRES,
  CUSTOM_TEMPLATE_ALIASES,
  GENRE_KEYWORDS,
  PRESET_MIN_SCORE,
  resolveGamedevGenre,
  isAdaptivePipeline,
  resolveAutoGenre,
};
