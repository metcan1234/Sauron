export function createPluginProfileController({ api, doc, state, ui, log, onProfileApplied }) {
  function applyProfileState(result = {}, { notify = false } = {}) {
    const rawSettings = state.getRawSettings?.() || state.getSettings?.() || {};
    const effectiveSettings = result.effectiveSettings || rawSettings;
    state.setProfileMeta?.({
      profile: result.profile || "general",
      label: result.label || "Genel",
      mode: result.mode || rawSettings.pluginProfileMode || "auto",
      smartEnabled: result.smartEnabled !== false,
      notifyEnabled: result.notifyEnabled !== false,
      activated: result.activated || [],
      deactivated: result.deactivated || [],
    });
    state.setSettings(effectiveSettings);

    if (notify && result.switched && result.notification && result.notifyEnabled !== false) {
      ui.showToast(result.notification, false);
    }

    if (typeof onProfileApplied === "function") {
      onProfileApplied(state.getProfileMeta?.(), effectiveSettings);
    }

    return result;
  }

  async function refreshProfileState({ notify = false } = {}) {
    try {
      const result = await api.invoke("get-plugin-profile-state");
      return applyProfileState(result, { notify });
    } catch (error) {
      log?.("get-plugin-profile-state error", error);
      return null;
    }
  }

  async function resolveProfile(params = {}, options = {}) {
    try {
      const result = await api.invoke("resolve-and-set-plugin-profile", params);
      return applyProfileState(result, { notify: options.notify !== false && result?.switched });
    } catch (error) {
      log?.("resolve-and-set-plugin-profile error", error);
      return null;
    }
  }

  async function setManualProfile(profile) {
    try {
      const result = await api.invoke("set-plugin-profile-manual", { profile });
      return applyProfileState(result, { notify: true });
    } catch (error) {
      log?.("set-plugin-profile-manual error", error);
      return null;
    }
  }

  function bindEvents() {
    // Profile UI lives in Settings; panel only runs backend overlay resolution.
  }

  return {
    bindEvents,
    refreshProfileState,
    resolveProfile,
    setManualProfile,
    applyProfileState,
  };
}
