const PLUGIN_PROFILE_IDS = ["general", "web", "game", "code", "browser"];

const PLUGIN_PROFILES = {
  general: {
    id: "general",
    label: "Genel",
    enable: [],
    suppress: [],
    notifyFeatures: [],
  },
  web: {
    id: "web",
    label: "Web",
    enable: ["webStudioEnabled", "selfBuildEnabled", "webDeployHintEnabled"],
    suppress: ["gamedevBridgeMonitorEnabled", "gamedevPlayLoopEnabled", "gamedevAutoScaffoldEnabled"],
    notifyFeatures: ["Web Studio", "Self-Build"],
  },
  game: {
    id: "game",
    label: "Oyun",
    enable: ["gamedevEnabled", "gamedevBridgeMonitorEnabled"],
    suppress: ["webStudioEnabled", "selfBuildEnabled", "webDeployHintEnabled"],
    notifyFeatures: ["Game Dev", "Unity bridge"],
  },
  code: {
    id: "code",
    label: "Kod",
    enable: ["codeReadinessBadgeEnabled", "codeSemanticSearchEnabled"],
    suppress: ["webStudioEnabled", "gamedevBridgeMonitorEnabled"],
    notifyFeatures: ["Kod agent", "Code Studio"],
  },
  browser: {
    id: "browser",
    label: "Tarayici",
    enable: ["browserAgentEnabled"],
    suppress: ["webStudioEnabled", "gamedevEnabled"],
    notifyFeatures: ["Browser Agent"],
  },
};

const UI_ONLY_KEYS = new Set(["gamedevSceneViewEnabled"]);

function normalizeProfileId(profileId) {
  const normalized = String(profileId || "general").trim().toLowerCase();
  return PLUGIN_PROFILE_IDS.includes(normalized) ? normalized : "general";
}

function getPluginProfile(profileId) {
  return PLUGIN_PROFILES[normalizeProfileId(profileId)];
}

function listPluginProfiles() {
  return PLUGIN_PROFILE_IDS.map((id) => PLUGIN_PROFILES[id]);
}

function buildProfileNotification(profileId) {
  const profile = getPluginProfile(profileId);
  if (!profile || profile.id === "general") {
    return "Genel profil aktif";
  }
  const features = profile.notifyFeatures?.length
    ? profile.notifyFeatures.join(", ")
    : profile.label;
  return `${profile.label} profili aktif — ${features}`;
}

module.exports = {
  PLUGIN_PROFILE_IDS,
  PLUGIN_PROFILES,
  UI_ONLY_KEYS,
  normalizeProfileId,
  getPluginProfile,
  listPluginProfiles,
  buildProfileNotification,
};
