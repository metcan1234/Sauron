const {
  LOW_COMPLEXITY_KEYWORDS,
  HIGH_COMPLEXITY_KEYWORDS,
  MEDIUM_COMPLEXITY_KEYWORDS,
} = require("./finops/cost-optimizer-config");

const HIGH_KEYWORDS = [
  ...HIGH_COMPLEXITY_KEYWORDS,
  "refactor",
  "mimari",
  "tüm proje",
  "bütün dosyalar",
  "güvenlik",
  "deploy",
  "production",
];

const LOW_KEYWORDS = [
  ...LOW_COMPLEXITY_KEYWORDS,
  "aç",
  "open",
  "göster",
  "show",
  "bul",
  "find",
  "listele",
  "list",
  "kopyala",
  "copy",
  "taşı",
  "move",
  "sil",
  "delete",
  "yeniden adlandır",
  "fix typo",
  "typo",
];

const MEDIUM_KEYWORDS = [
  ...MEDIUM_COMPLEXITY_KEYWORDS,
];

function detectGooseComplexity(taskText) {
  const text = String(taskText || "").toLowerCase().trim();
  if (!text) {
    return "balanced";
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const highHit = HIGH_KEYWORDS.some((keyword) => text.includes(keyword));
  const mediumHit = MEDIUM_KEYWORDS.some((keyword) => text.includes(keyword));
  const lowHit = LOW_KEYWORDS.some((keyword) => text.includes(keyword));

  if (highHit || wordCount > 100) {
    return "premium";
  }
  if (mediumHit) {
    return "balanced";
  }
  if (lowHit && wordCount < 30) {
    return "economy";
  }
  return "balanced";
}

function complexityToMode(complexity) {
  if (complexity === "premium" || complexity === "economy" || complexity === "balanced") {
    return complexity;
  }
  return "balanced";
}

module.exports = {
  HIGH_KEYWORDS,
  LOW_KEYWORDS,
  MEDIUM_KEYWORDS,
  detectGooseComplexity,
  complexityToMode,
};
