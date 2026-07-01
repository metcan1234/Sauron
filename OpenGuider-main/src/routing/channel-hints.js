const { detectCodeIntent } = require("../code-agent/detect-code-intent");
const { detectWebIntent } = require("../sauron/web-studio/web-intent");

function detectGameIntent(text = "") {
  const normalized = String(text || "").toLowerCase();
  if (!normalized.trim()) {
    return { shouldSuggest: false };
  }
  const keywords = [
    "oyun", "game", "unity", "unreal", "roblox", "gamedev", "level", "multiplayer",
    "steam", "prefab", "scene", "netcode",
  ];
  const hits = keywords.filter((kw) => normalized.includes(kw));
  if (hits.length >= 1) {
    return { shouldSuggest: true, reason: "game_keywords", confidence: Math.min(0.9, 0.35 + hits.length * 0.12) };
  }
  return { shouldSuggest: false };
}

function resolveChannelHints({
  text = "",
  settings = {},
  microIntent = null,
  codeIntent = null,
  webIntent = null,
  gameIntent = null,
} = {}) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    return { hints: [] };
  }

  const resolvedCodeIntent = codeIntent || detectCodeIntent(trimmed);
  const resolvedWebIntent = webIntent || detectWebIntent(trimmed);
  const resolvedGameIntent = gameIntent || detectGameIntent(trimmed);
  const hints = [];

  if (resolvedCodeIntent?.shouldSuggest && settings.codeAgentNativeEnabled === true && settings.workspacePath) {
    hints.push({
      id: "code_agent",
      label: "Yerel Kod Agent",
      icon: "</>",
      action: "route_code_agent",
    });
  } else if (resolvedCodeIntent?.shouldSuggest) {
    hints.push({
      id: "workspace",
      label: "⌘ Çalışma Kısmı",
      icon: "⌘",
      action: "open_workspace",
    });
  }

  if (resolvedWebIntent?.suggestWebStudio && settings.webStudioEnabled !== false) {
    hints.push({
      id: "web_studio",
      label: "Web Studio",
      icon: "🌐",
      action: "open_web_studio",
    });
  }

  if (resolvedGameIntent?.shouldSuggest && settings.gamedevEnabled !== false) {
    hints.push({
      id: "gamedev",
      label: "🎮 Game Dev",
      icon: "🎮",
      action: "open_gamedev",
    });
  }

  if (microIntent?.shouldSuggest) {
    hints.push({
      id: "micro_guide",
      label: "Ekran rehberi",
      icon: "🎯",
      action: "route_micro_guide",
    });
  }

  if (/terminal|shell|komut|npm run|goose/i.test(trimmed) && settings.gooseEnabled !== false) {
    hints.push({
      id: "goose",
      label: "🪿 Goose",
      icon: "🪿",
      action: "open_goose",
    });
  }

  const seen = new Set();
  const deduped = hints.filter((hint) => {
    if (seen.has(hint.id)) {
      return false;
    }
    seen.add(hint.id);
    return true;
  });

  return {
    hints: deduped.slice(0, 4),
    codeIntent: resolvedCodeIntent,
    webIntent: resolvedWebIntent,
    gameIntent: resolvedGameIntent,
  };
}

module.exports = {
  detectGameIntent,
  resolveChannelHints,
};
