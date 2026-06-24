const { resolvePipelineForTemplate } = require("./game-pipeline/game-pipeline-registry");
const { detectArchetypes } = require("./gamedev-brief-analyzer");

const PRESET_GENRES = ["co-op-climb", "horror-coop", "social-deduction"];
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
};

/** Strong single-keyword hits (game name references) bypass min score */
const PRESET_STRONG_SIGNALS = {
  "co-op-climb": ["peak", "co-op climb", "coop climb"],
  "horror-coop": ["zort", "survival horror"],
  "social-deduction": ["feign", "among us", "social deduction"],
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
  return {
    genre: "empty",
    templateId: null,
    pipelineId: "unity-empty-v1",
    reason,
    adaptive: true,
    presetScaffold: false,
    ...extra,
  };
}

function resolvePresetPipeline(genre, reason, score = 0) {
  return {
    genre,
    templateId: genre,
    pipelineId: resolvePipelineForTemplate(genre),
    reason,
    score,
    adaptive: false,
    presetScaffold: true,
  };
}

function resolveConfiguredTemplate(configured) {
  if (CUSTOM_TEMPLATE_ALIASES.has(configured)) {
    return resolveCustomPipeline("configured-custom");
  }
  if (PRESET_GENRES.includes(configured)) {
    return resolvePresetPipeline(configured, "configured-preset");
  }
  return resolveCustomPipeline("configured-fallback");
}

function scoreAllPresets(text) {
  const scores = {};
  for (const genre of PRESET_GENRES) {
    scores[genre] = scoreGenre(text, GENRE_KEYWORDS[genre]);
  }
  return scores;
}

function resolveAutoGenre(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    return resolveCustomPipeline("default-empty");
  }

  const archetypes = detectArchetypes(trimmed);
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

  // Rich, multi-archetype briefs → universal custom pipeline (GTA, math+mobile, etc.)
  if (archetypes.length >= 2) {
    return resolveCustomPipeline("multi-archetype-brief", { archetypes });
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
      return resolveCustomPipeline("rich-universal-brief", { archetypes });
    }
  }

  const scores = scoreAllPresets(trimmed);
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [bestGenre, bestScore] = ranked[0];
  const secondScore = ranked[1]?.[1] || 0;
  const activeMatches = ranked.filter(([, score]) => score > 0);

  if (hasStrongPresetSignal(trimmed, bestGenre) && bestScore > 0) {
    return resolvePresetPipeline(bestGenre, "strong-preset-signal", bestScore);
  }

  if (activeMatches.length > 1 && bestScore - secondScore < AMBIGUITY_GAP) {
    return resolveCustomPipeline("ambiguous-preset-keywords", { scores });
  }

  if (bestScore < PRESET_MIN_SCORE) {
    return resolveCustomPipeline("low-preset-confidence", { scores, archetypes });
  }

  if (wordCount >= RICH_BRIEF_WORD_THRESHOLD) {
    return resolveCustomPipeline("rich-brief-prefer-custom", { scores, archetypes });
  }

  return resolvePresetPipeline(bestGenre, "keyword-match", bestScore);
}

function resolveGamedevGenre(taskText, settings = {}) {
  const configured = String(settings.gamedevDefaultTemplate || "custom").trim();

  if (configured && configured !== "auto") {
    return resolveConfiguredTemplate(configured);
  }

  return resolveAutoGenre(taskText);
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
