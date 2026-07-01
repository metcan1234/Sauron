const fs = require("fs");
const path = require("path");
const { detectCodeIntent } = require("../code-agent/detect-code-intent");
const { detectWebIntent } = require("../sauron/web-studio/web-intent");
const { detectGameIntent } = require("./channel-hints");
const { detectWorkspaceLayout } = require("../sauron/workspace-detector");
const { normalizeProfileId, getPluginProfile } = require("./plugin-profiles");

const COOLDOWN_MS = 30_000;
const HYSTERESIS = 0.15;

const CHANNEL_PROFILE_MAP = {
  gamedev: "game",
  workspace: "code",
  goose: "code",
  browser: "browser",
  web: "web",
};

function scoreWebIntent(text = "") {
  const intent = detectWebIntent(text);
  if (intent.mode === "build") {
    return { profile: "web", score: 0.55 + (intent.confidence || 0) * 0.35, reason: "web_build" };
  }
  if (intent.mode === "browse") {
    return { profile: "browser", score: 0.45 + (intent.confidence || 0) * 0.25, reason: "web_browse" };
  }
  return { profile: "general", score: 0, reason: "web_none" };
}

function scoreGameIntent(text = "") {
  const intent = detectGameIntent(text);
  if (intent.shouldSuggest) {
    return { profile: "game", score: 0.5 + (intent.confidence || 0) * 0.35, reason: intent.reason || "game_keywords" };
  }
  return { profile: "general", score: 0, reason: "game_none" };
}

function scoreCodeIntent(text = "") {
  const intent = detectCodeIntent(text);
  if (intent.shouldSuggest) {
    return { profile: "code", score: 0.42 + (intent.confidence || 0) * 0.3, reason: intent.reason || "coding_keywords" };
  }
  return { profile: "general", score: 0, reason: "code_none" };
}

function detectUnityWorkspace(workspacePath = "") {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return { profile: "general", score: 0, reason: "no_workspace" };
  }
  const assets = path.join(resolved, "Assets");
  const manifest = path.join(resolved, "Packages", "manifest.json");
  if (fs.existsSync(assets) && fs.existsSync(manifest)) {
    return { profile: "game", score: 0.72, reason: "unity_workspace" };
  }
  return { profile: "general", score: 0, reason: "not_unity" };
}

function detectWebWorkspace(workspacePath = "") {
  const layout = detectWorkspaceLayout(workspacePath);
  if (layout.isNextWeb || layout.suggestedProjectType === "corporate-web") {
    return { profile: "web", score: 0.68, reason: "web_workspace" };
  }
  return { profile: "general", score: 0, reason: "not_web_workspace" };
}

function pickBestCandidate(candidates = []) {
  const ranked = candidates
    .filter((entry) => entry && entry.profile !== "general" && entry.score > 0)
    .sort((a, b) => b.score - a.score);
  if (ranked.length === 0) {
    return { profile: "general", score: 0, reason: "no_match" };
  }
  return ranked[0];
}

function shouldSwitchProfile({
  currentProfile = "general",
  nextProfile = "general",
  nextScore = 0,
  currentScore = 0,
  lastSwitchAt = "",
  force = false,
} = {}) {
  if (force) {
    return true;
  }
  if (nextProfile === currentProfile) {
    return false;
  }
  if (nextProfile === "general") {
    return currentProfile !== "general" && nextScore <= 0;
  }
  if (nextScore - currentScore < HYSTERESIS) {
    return false;
  }
  if (lastSwitchAt) {
    const elapsed = Date.now() - Date.parse(lastSwitchAt);
    if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < COOLDOWN_MS && nextScore < 0.75) {
      return false;
    }
  }
  return true;
}

function resolvePluginProfile({
  text = "",
  workspacePath = "",
  source = "auto",
  forceProfile = null,
  channel = null,
  currentProfile = "general",
  pluginProfileMode = "auto",
  lastSwitchAt = "",
} = {}) {
  const normalizedCurrent = normalizeProfileId(currentProfile);

  if (forceProfile) {
    const forced = normalizeProfileId(forceProfile);
    return {
      profile: forced,
      previousProfile: normalizedCurrent,
      switched: forced !== normalizedCurrent,
      reason: `forced:${source}`,
      confidence: 1,
      source,
    };
  }

  if (pluginProfileMode === "manual" && source !== "manual" && source !== "channel") {
    return {
      profile: normalizedCurrent,
      previousProfile: normalizedCurrent,
      switched: false,
      reason: "manual_mode",
      confidence: 0,
      source,
    };
  }

  const trimmed = String(text || "").trim();
  const candidates = [
    scoreWebIntent(trimmed),
    scoreGameIntent(trimmed),
    scoreCodeIntent(trimmed),
    detectUnityWorkspace(workspacePath),
    detectWebWorkspace(workspacePath),
  ];

  if (source === "channel" && channel) {
    const channelProfile = CHANNEL_PROFILE_MAP[channel];
    if (channelProfile) {
      candidates.push({ profile: channelProfile, score: 0.95, reason: `channel:${channel}` });
    }
  }

  const best = pickBestCandidate(candidates);
  const currentCandidate = candidates.find((entry) => entry.profile === normalizedCurrent) || { score: 0 };
  const nextProfile = best.profile;
  const switched = shouldSwitchProfile({
    currentProfile: normalizedCurrent,
    nextProfile,
    nextScore: best.score,
    currentScore: currentCandidate.score || 0,
    lastSwitchAt,
    force: source === "manual" || source === "channel",
  });

  return {
    profile: switched ? nextProfile : normalizedCurrent,
    previousProfile: normalizedCurrent,
    switched,
    reason: switched ? best.reason : "unchanged",
    confidence: best.score,
    source,
    candidate: best,
  };
}

function commitPluginProfile(store, resolution, baseSettings = {}) {
  const profile = normalizeProfileId(resolution?.profile || baseSettings.activePluginProfile || "general");
  const previousProfile = normalizeProfileId(resolution?.previousProfile || baseSettings.activePluginProfile || "general");
  const switched = Boolean(resolution?.switched) && profile !== previousProfile;

  if (store && switched) {
    store.set("activePluginProfile", profile);
    store.set("pluginProfileLastSwitchAt", new Date().toISOString());
  }

  const profileDef = getPluginProfile(profile);
  return {
    ok: true,
    profile,
    previousProfile,
    switched,
    label: profileDef.label,
    reason: resolution?.reason || "unchanged",
    confidence: resolution?.confidence || 0,
    source: resolution?.source || "auto",
    notification: switched ? require("./plugin-profiles").buildProfileNotification(profile) : "",
  };
}

module.exports = {
  COOLDOWN_MS,
  HYSTERESIS,
  CHANNEL_PROFILE_MAP,
  resolvePluginProfile,
  commitPluginProfile,
  scoreWebIntent,
  scoreGameIntent,
  scoreCodeIntent,
  detectUnityWorkspace,
  detectWebWorkspace,
};
