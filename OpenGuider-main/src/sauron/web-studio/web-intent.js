const BUILD_PATTERNS = [
  /\b(yap|yapmak|oluştur|olustur|tasarla|geliştir|gelistir|kur|inşa|insa)\b/i,
  /\b(kurumsal\s+site|web\s+sitesi|website\s+build|landing\s+page|portfolyo|portfolio)\b/i,
  /\b(next\.?js|tailwind|react\s+site|frontend\s+projesi)\b/i,
  /\b(site\s+yap|web\s+uygulama\s+yap|sayfa\s+oluştur)\b/i,
];

const BROWSE_PATTERNS = [
  /\b(aç|ac|git|navigate|ziyaret|visit|browse)\b/i,
  /\b(google|youtube|amazon|facebook|twitter|linkedin)\b/i,
  /\b(login|sign\s+in|checkout|sepet|cart)\b/i,
  /https?:\/\//i,
  /\b(ara|search|bul)\s+(web|internet|google)/i,
];

const BUILD_STRONG = [
  /\b(kurumsal|corporate|enterprise)\b.*\b(site|web)/i,
  /\b(web\s+studio|brief\s+hazırla)\b/i,
];

function scorePatterns(text, patterns) {
  let score = 0;
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      score += 1;
    }
  }
  return score;
}

function detectWebIntent(message = "") {
  const text = String(message || "").trim();
  if (!text) {
    return { mode: "unknown", confidence: 0, suggestWebStudio: false };
  }

  const buildScore = scorePatterns(text, BUILD_PATTERNS) + scorePatterns(text, BUILD_STRONG) * 2;
  const browseScore = scorePatterns(text, BROWSE_PATTERNS);

  if (buildScore > browseScore && buildScore >= 1) {
    return {
      mode: "build",
      confidence: Math.min(1, buildScore / 3),
      suggestWebStudio: true,
    };
  }

  if (browseScore > buildScore && browseScore >= 1) {
    return {
      mode: "browse",
      confidence: Math.min(1, browseScore / 2),
      suggestWebStudio: false,
    };
  }

  return { mode: "unknown", confidence: 0, suggestWebStudio: false };
}

module.exports = {
  detectWebIntent,
};
