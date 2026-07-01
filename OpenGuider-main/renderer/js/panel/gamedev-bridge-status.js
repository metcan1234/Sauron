export function createGamedevBridgeStatusController({ api, doc, state, log }) {
  const badgeEl = doc.getElementById("gamedev-bridge-badge");

  async function refresh() {
    if (!badgeEl) {
      return;
    }
    const settings = state.getSettings?.() || {};
    if (settings.gamedevBridgeMonitorEnabled === false || settings.gamedevEnabled === false) {
      badgeEl.classList.add("hidden");
      return;
    }
    try {
      const status = await api.invoke("get-gamedev-bridge-status");
      if (status?.disabled) {
        badgeEl.classList.add("hidden");
        return;
      }
      const open = status?.ok === true;
      badgeEl.textContent = open ? "Unity bridge ●" : "Unity bridge ○";
      badgeEl.title = status?.summary || "Game Dev TCP bridge";
      badgeEl.classList.toggle("is-ready", open);
      badgeEl.classList.toggle("is-blocked", !open);
      badgeEl.classList.remove("hidden");
    } catch (error) {
      log?.("gamedev-bridge-status error", error);
      badgeEl.classList.add("hidden");
    }
  }

  return { refresh };
}
