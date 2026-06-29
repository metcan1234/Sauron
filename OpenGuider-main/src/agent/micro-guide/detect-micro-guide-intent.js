const { detectWebIntent } = require("../../sauron/web-studio/web-intent");

const POSITIVE_PATTERNS = [
  /\bnasıl\s+aç/i,
  /\bnereden\s+aç/i,
  /\bnerede\s+(bul|aç|tıkla|yaz)/i,
  /\bbulamıyorum\b/i,
  /\byardım\s+et\b/i,
  /\bbana\s+yardım\b/i,
  /\b(açmamda|açmemde|bulmamda|bulmamde)\b/i,
  /\bgöster(ir)?\b/i,
  /\btıklayacağım\b/i,
  /\bnereye\s+tıkla/i,
  /\bnasıl\s+yap(a|ı)rım\b/i,
  /\bhow\s+do\s+i\s+open\b/i,
  /\bcan'?t\s+find\b/i,
  /\bwhere\s+is\b/i,
  /\bhelp\s+me\s+(open|find|click)\b/i,
  /\bshow\s+me\s+where\b/i,
];

const NEGATIVE_PATTERNS = [
  /\b(commit|git|github|pull\s+request|vscode|vs\s*code|cline|çalışma\s+kısmı|workspace)\b/i,
  /\b(dosya|file|kod|code|refactor|terminal|npm|build|deploy)\b/i,
  /\b(handoff|api\s+key|finops)\b/i,
];

function detectMicroGuideIntent(message = "") {
  const text = String(message || "").trim();
  if (!text) {
    return { shouldSuggest: false, confidence: 0, reason: "empty" };
  }

  const webIntent = detectWebIntent(text);
  if (webIntent.mode === "build") {
    return { shouldSuggest: false, confidence: 0, reason: "web_studio_build" };
  }

  if (NEGATIVE_PATTERNS.some((pattern) => pattern.test(text))) {
    return { shouldSuggest: false, confidence: 0, reason: "coding_or_workspace" };
  }

  const hits = POSITIVE_PATTERNS.filter((pattern) => pattern.test(text)).length;
  if (hits === 0) {
    return { shouldSuggest: false, confidence: 0, reason: "no_match" };
  }

  return {
    shouldSuggest: true,
    confidence: Math.min(1, hits / 2),
    reason: "screen_guidance",
  };
}

module.exports = {
  detectMicroGuideIntent,
};
