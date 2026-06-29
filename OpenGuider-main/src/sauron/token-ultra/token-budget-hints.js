function buildTokenBudgetHints(settings = {}, context = {}) {
  const enabled = settings.tokenUltraEnabled !== false;
  if (!enabled) {
    return null;
  }

  return {
    enabled: true,
    maxHandoffChars: Number(settings.tokenUltraMaxHandoffChars) || 6000,
    useDeltaHandoff: settings.tokenUltraUseDeltaHandoff !== false,
    useSceneCache: settings.tokenUltraUseSceneCache !== false,
    useRepoMap: settings.tokenUltraUseRepoMap !== false,
    sandboxToolOutput: settings.tokenUltraSandboxToolOutput !== false,
    deltaFrom: context.deltaFrom || null,
    repoMapPointer: context.repoMapPointer || null,
    sceneCachePointer: context.sceneCachePointer || ".sauron/gamedev-scene-cache.json",
    cacheBreakpoint: context.cacheBreakpoint || "handoff-summary",
  };
}

module.exports = {
  buildTokenBudgetHints,
};
