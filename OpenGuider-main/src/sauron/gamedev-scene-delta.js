const crypto = require("crypto");
const { readGamedevSceneCache, writeGamedevSceneCache } = require("./gamedev-scene-cache");

function hashSceneSnapshot(snapshot = {}) {
  const payload = JSON.stringify({
    engine: snapshot.engine || "",
    narrative: snapshot.narrative || "",
    rootCount: snapshot.hierarchy?.rootCount || 0,
    paths: snapshot.hierarchy?.lastPaths || [],
    actorGroups: snapshot.actorGroups || [],
  });
  return crypto.createHash("sha256").update(payload, "utf8").digest("hex");
}

function buildNarrativeSceneSummary(cache = {}, engine = "unity") {
  const resolvedEngine = cache.engine || engine;
  const parts = [`${resolvedEngine} scene`];
  if (cache.hierarchy?.rootCount) {
    parts.push(`${cache.hierarchy.rootCount} root object(s)`);
  }
  if (Array.isArray(cache.hierarchy?.lastPaths) && cache.hierarchy.lastPaths.length) {
    parts.push(`key: ${cache.hierarchy.lastPaths.slice(0, 4).join(", ")}`);
  }
  if (Array.isArray(cache.actorGroups) && cache.actorGroups.length) {
    parts.push(`groups: ${cache.actorGroups.slice(0, 3).join(", ")}`);
  }
  if (cache.lastGoal) {
    parts.push(`goal: ${String(cache.lastGoal).slice(0, 80)}`);
  }
  return parts.join(" | ");
}

function buildSceneDeltaHint(workspacePath, nextSnapshot = {}, engine = "unity") {
  const previous = readGamedevSceneCache(workspacePath) || {};
  const previousHash = previous.sceneHash || hashSceneSnapshot(previous);
  const nextHash = hashSceneSnapshot(nextSnapshot);
  const narrative = buildNarrativeSceneSummary(nextSnapshot, engine);

  if (previousHash === nextHash) {
    return {
      deltaMode: true,
      hint: `Scene delta: unchanged since last session (${narrative})`,
      sceneHash: nextHash,
      savedChars: narrative.length,
    };
  }

  const changedPaths = [];
  const prevPaths = new Set(previous.hierarchy?.lastPaths || []);
  for (const entry of nextSnapshot.hierarchy?.lastPaths || []) {
    if (!prevPaths.has(entry)) {
      changedPaths.push(entry);
    }
  }

  const hint = changedPaths.length
    ? `Scene delta: +${changedPaths.slice(0, 5).join(", ")} | ${narrative}`
    : `Scene delta: updated layout | ${narrative}`;

  return {
    deltaMode: false,
    hint,
    sceneHash: nextHash,
    savedChars: 0,
  };
}

function persistSceneSnapshot(workspacePath, snapshot = {}) {
  const sceneHash = hashSceneSnapshot(snapshot);
  const narrative = buildNarrativeSceneSummary(snapshot, snapshot.engine);
  writeGamedevSceneCache(workspacePath, {
    ...snapshot,
    sceneHash,
    narrative,
  });
  return { sceneHash, narrative };
}

module.exports = {
  hashSceneSnapshot,
  buildNarrativeSceneSummary,
  buildSceneDeltaHint,
  persistSceneSnapshot,
};
