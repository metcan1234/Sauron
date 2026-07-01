const { buildPluginProfileState } = require("../routing/effective-settings");
const {
  resolvePluginProfile,
  commitPluginProfile,
} = require("../routing/resolve-plugin-profile");
const { normalizeProfileId, listPluginProfiles } = require("../routing/plugin-profiles");

function registerPluginProfileIpc({
  ipcMain,
  store,
  debugLog,
  getRuntimeSettings,
}) {
  ipcMain.handle("get-plugin-profile-state", async () => {
    debugLog("ipc:get-plugin-profile-state");
    const baseSettings = await getRuntimeSettings({ includePersona: false });
    return buildPluginProfileState(baseSettings);
  });

  ipcMain.handle("resolve-and-set-plugin-profile", async (_event, params = {}) => {
    debugLog("ipc:resolve-and-set-plugin-profile", params?.source || "auto");
    const baseSettings = await getRuntimeSettings({ includePersona: false });
    if (baseSettings.smartPluginProfileEnabled === false && !params.forceProfile) {
      return {
        ok: true,
        profile: normalizeProfileId(baseSettings.activePluginProfile),
        switched: false,
        disabled: true,
        ...buildPluginProfileState(baseSettings),
      };
    }

    const resolution = resolvePluginProfile({
      text: params.text || "",
      workspacePath: params.workspacePath || baseSettings.workspacePath || "",
      source: params.source || "auto",
      forceProfile: params.forceProfile || null,
      channel: params.channel || null,
      currentProfile: baseSettings.activePluginProfile,
      pluginProfileMode: baseSettings.pluginProfileMode,
      lastSwitchAt: baseSettings.pluginProfileLastSwitchAt,
    });

    const commit = commitPluginProfile(store, resolution, baseSettings);
    const nextSettings = await getRuntimeSettings({ includePersona: false });
    const state = buildPluginProfileState(nextSettings);
    return {
      ...commit,
      ...state,
      effectiveSettings: state.effectiveSettings,
    };
  });

  ipcMain.handle("set-plugin-profile-manual", async (_event, { profile } = {}) => {
    debugLog("ipc:set-plugin-profile-manual", profile);
    const baseSettings = await getRuntimeSettings({ includePersona: false });
    const resolution = resolvePluginProfile({
      forceProfile: profile,
      source: "manual",
      currentProfile: baseSettings.activePluginProfile,
      pluginProfileMode: "manual",
    });
    const commit = commitPluginProfile(store, resolution, baseSettings);
    const nextSettings = await getRuntimeSettings({ includePersona: false });
    const state = buildPluginProfileState(nextSettings);
    return {
      ...commit,
      ...state,
      effectiveSettings: state.effectiveSettings,
    };
  });

  ipcMain.handle("list-plugin-profiles", async () => {
    debugLog("ipc:list-plugin-profiles");
    return listPluginProfiles();
  });
}

module.exports = { registerPluginProfileIpc };
