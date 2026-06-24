const { resolvePipelineForTemplate } = require("./game-pipeline/game-pipeline-registry");

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

function resolveGamedevGenre(taskText, settings = {}) {
  const configured = String(settings.gamedevDefaultTemplate || "").trim();
  if (configured && configured !== "auto") {
    const pipelineId = resolvePipelineForTemplate(configured === "empty" ? null : configured);
    return {
      genre: configured,
      templateId: configured === "empty" ? null : configured,
      pipelineId,
      reason: "configured-template",
    };
  }

  const text = String(taskText || "").trim();
  let bestGenre = "empty";
  let bestScore = 0;

  for (const [genre, keywords] of Object.entries(GENRE_KEYWORDS)) {
    const score = scoreGenre(text, keywords);
    if (score > bestScore) {
      bestScore = score;
      bestGenre = genre;
    }
  }

  const templateId = bestGenre === "empty" ? null : bestGenre;
  const pipelineId = resolvePipelineForTemplate(templateId);

  return {
    genre: bestGenre,
    templateId,
    pipelineId,
    reason: bestScore > 0 ? "keyword-match" : "default-empty",
    score: bestScore,
  };
}

module.exports = {
  GENRE_KEYWORDS,
  resolveGamedevGenre,
};
