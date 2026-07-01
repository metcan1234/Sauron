export function createPluginProfileController({ api, doc, state, ui, log, onProfileApplied }) {
  const badgeEl = doc.getElementById("plugin-profile-badge");
  const menuEl = doc.getElementById("plugin-profile-menu");
  let menuOpen = false;

  function hideMenu() {
    menuEl?.classList.add("hidden");
    menuOpen = false;
  }

  function showMenu() {
    if (!menuEl || !badgeEl) {
      return;
    }
    menuEl.classList.remove("hidden");
    menuOpen = true;
  }

  function renderBadge(profileMeta = {}) {
    if (!badgeEl) {
      return;
    }
    if (profileMeta.smartEnabled === false) {
      badgeEl.classList.add("hidden");
      hideMenu();
      return;
    }
    const label = profileMeta.label || "Genel";
    badgeEl.textContent = label;
    badgeEl.title = `Calisma profili: ${label}${profileMeta.mode === "manual" ? " (manuel)" : " (otomatik)"}`;
    badgeEl.dataset.profile = profileMeta.profile || "general";
    badgeEl.classList.toggle("is-web", profileMeta.profile === "web");
    badgeEl.classList.toggle("is-game", profileMeta.profile === "game");
    badgeEl.classList.toggle("is-code", profileMeta.profile === "code");
    badgeEl.classList.toggle("is-browser", profileMeta.profile === "browser");
    badgeEl.classList.remove("hidden");
  }

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

    renderBadge(state.getProfileMeta?.() || {});

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
    badgeEl?.addEventListener("click", (event) => {
      event.stopPropagation();
      if (menuOpen) {
        hideMenu();
      } else {
        showMenu();
      }
    });

    doc.addEventListener("click", () => {
      hideMenu();
    });

    menuEl?.querySelectorAll("[data-profile-choice]").forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.stopPropagation();
        hideMenu();
        const profile = button.getAttribute("data-profile-choice");
        await setManualProfile(profile);
      });
    });

    doc.getElementById("plugin-profile-mode-auto")?.addEventListener("click", async (event) => {
      event.stopPropagation();
      hideMenu();
      await api.invoke("save-settings", { pluginProfileMode: "auto" });
      const raw = state.getRawSettings?.() || {};
      state.setRawSettings?.({ ...raw, pluginProfileMode: "auto" });
      await refreshProfileState();
      ui.showToast("Otomatik profil modu acik", false);
    });

    doc.getElementById("plugin-profile-mode-manual")?.addEventListener("click", async (event) => {
      event.stopPropagation();
      hideMenu();
      await api.invoke("save-settings", { pluginProfileMode: "manual" });
      const raw = state.getRawSettings?.() || {};
      state.setRawSettings?.({ ...raw, pluginProfileMode: "manual" });
      await refreshProfileState();
      ui.showToast("Manuel profil modu acik", false);
    });
  }

  return {
    bindEvents,
    refreshProfileState,
    resolveProfile,
    setManualProfile,
    renderBadge,
    applyProfileState,
  };
}
