const ARCHETYPE_PATTERNS = {
  "open-world": [
    "gta", "open world", "open-world", "sandbox", "açık dünya", "acik dunya", "free roam",
  ],
  "action": ["action", "aksiyon", "shooter", "fps", "third person", "combat", "dövüş", "dovus"],
  "rpg": ["rpg", "role playing", "quest", "inventory", "level up", "karakter gelişim"],
  "strategy": ["strategy", "strateji", "rts", "turn-based", "tower defense", "city builder"],
  "puzzle": ["puzzle", "bulmaca", "match-3", "match 3", "sudoku", "tetris", "block"],
  "educational": [
    "math", "matematik", "quiz", "learn", "eğitim", "egitim", "educational", "trivia", "soru",
  ],
  "racing": ["racing", "yarış", "yaris", "driving", "araba", "car game"],
  "platformer": ["platformer", "jump", "zıpla", "ziplay", "side scroll", "metroidvania"],
  "simulation": ["simulation", "simülasyon", "simulasyon", "tycoon", "management", "farming", "çiftlik"],
  "sports": ["sports", "spor", "football", "futbol", "basketball", "soccer"],
  "horror": ["horror", "korku", "scary", "survival horror"],
  "social": ["social", "party game", "lobby", "multiplayer lobby"],
  "mobile": ["mobile", "mobil", "android", "ios", "touch", "hypercasual", "casual"],
  "multiplayer": ["multiplayer", "co-op", "coop", "pvp", "online", "netcode", "mmo", "battle royale"],
  "narrative": ["story", "hikaye", "visual novel", "dialogue", "narrative"],
  "idle": ["idle", "clicker", "incremental", "afk"],
};

const MECHANIC_PATTERNS = [
  "open world", "driving", "shooting", "crafting", "building", "trading", "stealth",
  "procedural", "roguelike", "roguelite", "card", "deck", "turn-based", "real-time",
  "physics", "puzzle", "timer", "score", "leaderboard", "progression", "upgrade",
  "inventory", "dialogue", "cutscene", "minigame", "tutorial",
];

function patternMatchesText(text, pattern) {
  const lower = String(text || "").toLowerCase();
  const token = String(pattern || "").trim().toLowerCase();
  if (!token) {
    return false;
  }
  if (token.includes(" ")) {
    return lower.includes(token);
  }
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i").test(lower);
}

function detectArchetypes(text) {
  const found = [];
  for (const [archetype, patterns] of Object.entries(ARCHETYPE_PATTERNS)) {
    if (patterns.some((p) => patternMatchesText(text, p))) {
      found.push(archetype);
    }
  }
  return found.slice(0, 6);
}

function detectMechanics(text) {
  const found = [];
  for (const pattern of MECHANIC_PATTERNS) {
    if (patternMatchesText(text, pattern)) {
      found.push(pattern);
    }
  }
  return found.slice(0, 8);
}

function analyzeGameBrief(masterPrompt) {
  const text = String(masterPrompt || "").trim();
  const archetypes = detectArchetypes(text);
  const mechanics = detectMechanics(text);
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  return {
    text,
    snippet: text.slice(0, 120),
    phaseSnippet: text.slice(0, 100),
    archetypes,
    mechanics,
    wordCount,
    archetypeLabel: archetypes.length > 0 ? archetypes.slice(0, 2).join(" + ") : "custom",
    mechanicLabel: mechanics.length > 0 ? mechanics.slice(0, 3).join(", ") : "",
    isRichBrief: wordCount >= 20,
  };
}

function buildUniversalPhaseGoal(phase, totalPhases, analysis) {
  const { phaseSnippet, archetypeLabel, mechanicLabel, snippet } = analysis;
  const mechSuffix = mechanicLabel ? ` (${mechanicLabel})` : "";
  const isLast = phase >= totalPhases;

  if (phase === 1) {
    return `Verify playable URP scene + play mode. Brief archetype: ${archetypeLabel}. ${snippet.slice(0, 90)}`;
  }
  if (phase === 2) {
    return `Build core loop foundation for ${archetypeLabel}: player/input/camera/UI per brief${mechSuffix}`;
  }
  if (isLast) {
    return `Playtest ${archetypeLabel} loop, fix errors, polish per brief: ${phaseSnippet}`;
  }
  if (phase === 3) {
    return `Implement main mechanic from brief: ${phaseSnippet}${mechSuffix}`;
  }
  if (phase === totalPhases - 1) {
    return `Add secondary systems + content pass for ${archetypeLabel}: ${phaseSnippet.slice(0, 80)}`;
  }
  return `Expand ${archetypeLabel} features (phase ${phase}/${totalPhases}): ${phaseSnippet.slice(0, 100)}`;
}

module.exports = {
  ARCHETYPE_PATTERNS,
  analyzeGameBrief,
  buildUniversalPhaseGoal,
  detectArchetypes,
  detectMechanics,
};
