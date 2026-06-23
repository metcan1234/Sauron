const HIGH_KEYWORDS = [
  "refactor",
  "mimari",
  "architecture",
  "tüm proje",
  "bütün dosyalar",
  "güvenlik",
  "security",
  "database",
  "schema",
  "deploy",
  "production",
  "migrate",
];

const LOW_KEYWORDS = [
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
  "rename",
  "fix typo",
  "typo",
];

function detectGooseComplexity(taskText) {
  const text = String(taskText || "").toLowerCase().trim();
  if (!text) {
    return "balanced";
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const highHit = HIGH_KEYWORDS.some((keyword) => text.includes(keyword));
  const lowHit = LOW_KEYWORDS.some((keyword) => text.includes(keyword));

  if (highHit || wordCount > 100) {
    return "premium";
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
  detectGooseComplexity,
  complexityToMode,
};
