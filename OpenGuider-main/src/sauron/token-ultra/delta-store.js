const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { estimateTokensLite } = require("../finops/tiktoken-estimator");

const CACHE_FILENAME = "token-ultra-cache.json";

function getCachePath(workspacePath) {
  return path.join(String(workspacePath || "").trim(), ".sauron", CACHE_FILENAME);
}

function hashText(text) {
  return crypto.createHash("sha256").update(String(text || ""), "utf8").digest("hex");
}

function readTokenUltraCache(workspacePath) {
  const cachePath = getCachePath(workspacePath);
  try {
    if (!fs.existsSync(cachePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(cachePath, "utf8"));
  } catch {
    return null;
  }
}

function writeTokenUltraCache(workspacePath, data) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return false;
  }
  const cachePath = getCachePath(resolved);
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify({
    ...data,
    updatedAt: new Date().toISOString(),
  }, null, 2), "utf8");
  return true;
}

function recordHandoffSnapshot(workspacePath, { handoffId, goal, summary, sceneHash, repoMapHash } = {}) {
  const existing = readTokenUltraCache(workspacePath) || {};
  const next = {
    ...existing,
    lastHandoffId: handoffId || existing.lastHandoffId,
    lastGoalHash: goal ? hashText(goal) : existing.lastGoalHash,
    lastSummaryHash: summary ? hashText(summary) : existing.lastSummaryHash,
    lastSceneHash: sceneHash || existing.lastSceneHash,
    lastRepoMapHash: repoMapHash || existing.lastRepoMapHash,
    savings: existing.savings || { estimatedCharsSaved: 0, handoffCount: 0 },
  };
  writeTokenUltraCache(workspacePath, next);
  return next;
}

function recordSavings(workspacePath, charsSaved = 0, settings = {}, channel = "workspace") {
  const existing = readTokenUltraCache(workspacePath) || {};
  const savings = existing.savings || { estimatedCharsSaved: 0, handoffCount: 0, byChannel: {} };
  const saved = Math.max(0, Number(charsSaved) || 0);
  const channelKey = String(channel || "workspace").trim().toLowerCase();
  const normalizedChannel = ["workspace", "goose", "gamedev"].includes(channelKey)
    ? channelKey
    : "workspace";
  const byChannel = { ...(savings.byChannel || {}) };
  const channelStats = byChannel[normalizedChannel] || { estimatedCharsSaved: 0, handoffCount: 0 };
  byChannel[normalizedChannel] = {
    estimatedCharsSaved: Number(channelStats.estimatedCharsSaved || 0) + saved,
    handoffCount: Number(channelStats.handoffCount || 0) + 1,
  };
  const next = {
    ...existing,
    savings: {
      estimatedCharsSaved: Number(savings.estimatedCharsSaved || 0) + saved,
      handoffCount: Number(savings.handoffCount || 0) + 1,
      byChannel,
    },
  };
  writeTokenUltraCache(workspacePath, next);

  if (saved > 0) {
    const tokensSaved = estimateTokensLite("x".repeat(saved));
    const { trackCall } = require("../finops/usage-tracker");
    trackCall({
      provider: "sauron",
      model: "token-ultra",
      promptTokens: 0,
      completionTokens: 0,
      costTl: 0,
      operation: "token-ultra-saved",
      latencyMs: 0,
      timestamp: new Date().toISOString(),
      channel: normalizedChannel,
      sourceNote: `Token Ultra saved ~${saved} chars (~${tokensSaved} tokens)`,
      tokenUltraSavedChars: saved,
      tokenUltraSavedTokensEst: tokensSaved,
    }, { workspacePath, ...settings });
  }

  return next.savings;
}

function shouldUseDeltaFromCache(workspacePath, goalText) {
  const cache = readTokenUltraCache(workspacePath);
  if (!cache?.lastGoalHash) {
    return { useDelta: false, deltaFrom: null };
  }
  const currentHash = hashText(goalText);
  if (currentHash === cache.lastGoalHash) {
    return { useDelta: true, deltaFrom: cache.lastHandoffId || null };
  }
  return { useDelta: false, deltaFrom: cache.lastHandoffId || null };
}

module.exports = {
  CACHE_FILENAME,
  hashText,
  readTokenUltraCache,
  writeTokenUltraCache,
  recordHandoffSnapshot,
  recordSavings,
  shouldUseDeltaFromCache,
};
