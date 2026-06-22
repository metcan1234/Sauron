const CODING_KEYWORDS = [
  "kod", "code", "implement", "refactor", "fix", "bug", "test", "npm", "git",
  "dosya", "file", "function", "class", "api", "endpoint", "component",
  "ekle", "yaz", "düzelt", "oluştur", "build", "deploy", "typescript", "javascript",
];

function detectCodeIntent(text = "") {
  const normalized = String(text).toLowerCase();
  if (!normalized.trim()) {
    return { shouldSuggest: false, reason: "empty" };
  }
  const hits = CODING_KEYWORDS.filter((kw) => normalized.includes(kw));
  if (hits.length >= 1) {
    return { shouldSuggest: true, reason: "coding_keywords", confidence: Math.min(0.95, 0.4 + hits.length * 0.15) };
  }
  if (/\b(src\/|\.js|\.ts|\.tsx|package\.json)\b/i.test(text)) {
    return { shouldSuggest: true, reason: "path_or_extension", confidence: 0.7 };
  }
  return { shouldSuggest: false, reason: "no_match" };
}

module.exports = { detectCodeIntent, CODING_KEYWORDS };
