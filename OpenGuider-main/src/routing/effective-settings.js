const {
  normalizeProfileId,
  getPluginProfile,
} = require("./plugin-profiles");

function isFeatureAllowed(baseSettings, key) {
  return baseSettings?.[key] !== false;
}

function applyPluginProfileOverlay(baseSettings = {}, profileId = "general", options = {}) {
  const settings = { ...baseSettings };
  const smartEnabled = options.smartPluginProfileEnabled ?? settings.smartPluginProfileEnabled;
  if (smartEnabled === false) {
    return {
      settings,
      profile: "general",
      overlay: {},
      activated: [],
      deactivated: [],
      changed: false,
    };
  }

  const profile = getPluginProfile(normalizeProfileId(profileId));
  const overlay = {};
  const activated = [];
  const deactivated = [];

  for (const key of profile.enable || []) {
    if (!isFeatureAllowed(baseSettings, key)) {
      overlay[key] = false;
      settings[key] = false;
      deactivated.push(key);
    }
  }

  for (const key of profile.suppress || []) {
    if (settings[key] !== false) {
      overlay[key] = false;
      settings[key] = false;
      deactivated.push(key);
    }
  }

  if (profile.id === "game") {
    overlay.gamedevSceneViewEnabled = true;
    settings.gamedevSceneViewEnabled = true;
    activated.push("gamedevSceneViewEnabled");
  } else if (profile.id !== "general") {
    overlay.gamedevSceneViewEnabled = false;
    settings.gamedevSceneViewEnabled = false;
    if (baseSettings.gamedevSceneViewEnabled !== false) {
      deactivated.push("gamedevSceneViewEnabled");
    }
  }

  return {
    settings,
    profile: profile.id,
    overlay,
    activated,
    deactivated,
    changed: activated.length > 0 || deactivated.length > 0,
  };
}

function buildPluginProfileState(baseSettings = {}) {
  const profileId = normalizeProfileId(baseSettings.activePluginProfile);
  const applied = applyPluginProfileOverlay(baseSettings, profileId, {
    smartPluginProfileEnabled: baseSettings.smartPluginProfileEnabled,
  });
  const profile = getPluginProfile(applied.profile);
  return {
    profile: applied.profile,
    label: profile.label,
    mode: baseSettings.pluginProfileMode === "manual" ? "manual" : "auto",
    smartEnabled: baseSettings.smartPluginProfileEnabled !== false,
    notifyEnabled: baseSettings.pluginProfileNotifyEnabled !== false,
    activated: applied.activated,
    deactivated: applied.deactivated,
    effectiveSettings: applied.settings,
    overlay: applied.overlay,
    lastSwitchAt: baseSettings.pluginProfileLastSwitchAt || "",
  };
}

module.exports = {
  applyPluginProfileOverlay,
  buildPluginProfileState,
  isFeatureAllowed,
};
