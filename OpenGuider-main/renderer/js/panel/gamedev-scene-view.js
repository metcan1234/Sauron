export function createGamedevSceneViewController({ api, doc, state, log }) {
  const wrapEl = doc.getElementById("gamedev-scene-view");

  async function refresh() {
    if (!wrapEl) {
      return;
    }
    const settings = state.getSettings?.() || {};
    if (settings.gamedevEnabled === false || settings.gamedevSceneViewEnabled === false) {
      wrapEl.classList.add("hidden");
      return;
    }
    try {
      const status = await api.invoke("get-gamedev-status");
      const cache = status?.sceneCache;
      const paths = cache?.hierarchy?.lastPaths;
      if (Array.isArray(paths) && paths.length > 0) {
        wrapEl.textContent = paths.slice(0, 24).join("\n");
        wrapEl.classList.remove("hidden");
        return;
      }
      const hierarchy = cache?.hierarchySnapshot
        || cache?.hierarchyPreview
        || cache?.hierarchy
        || null;
      if (!hierarchy) {
        wrapEl.classList.add("hidden");
        return;
      }
      const lines = Array.isArray(hierarchy)
        ? hierarchy.slice(0, 24).map((node) => `${" ".repeat((node.depth || 0) * 2)}${node.name || node}`)
        : String(hierarchy).split("\n").slice(0, 24);
      wrapEl.textContent = lines.join("\n");
      wrapEl.classList.remove("hidden");
    } catch (error) {
      log?.("gamedev-scene-view error", error);
      wrapEl.classList.add("hidden");
    }
  }

  return { refresh };
}
