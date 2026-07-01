export function createLunaRelationshipBadgeController({ api, doc, log }) {
  const badgeEl = doc.getElementById("luna-relationship-badge");

  function render(state = {}) {
    if (!badgeEl) {
      return;
    }
    if (!state.enabled) {
      badgeEl.classList.add("hidden");
      return;
    }
    const label = state.label || state.stage || "Tanışıyoruz";
    const count = Number(state.messageCount) || 0;
    badgeEl.textContent = label;
    badgeEl.title = `Luna tanışıklık: ${label} (${count} mesaj)`;
    badgeEl.dataset.stage = state.stage || "new";
    badgeEl.classList.toggle("is-warming", state.stage === "warming");
    badgeEl.classList.toggle("is-close", state.stage === "close");
    badgeEl.classList.toggle("is-deep", state.stage === "deep");
    badgeEl.classList.remove("hidden");
  }

  async function refresh() {
    try {
      const state = await api.invoke("get-luna-relationship-state");
      render(state || {});
      return state;
    } catch (error) {
      log?.("get-luna-relationship-state error", error);
      return null;
    }
  }

  return {
    render,
    refresh,
  };
}
