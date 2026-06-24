const fs = require("fs");
const path = require("path");
const {
  generateHandoffId,
  writeHandoff,
  seedSauronRules,
  launchVSCode,
  focusVSCodeWorkspace,
} = require("./handoff");
const { mergeCostOptimizerConfig } = require("./finops/cost-optimizer-config");
const { GAMEDEV_ENGINE_LABELS, normalizeGamedevEngine } = require("./gamedev-config");
const { probeGamedevMcpEntry, resolveGamedevMcpEntryPath } = require("./gamedev-path-resolver");
const { buildGamedevHandoffSummary } = require("./gamedev-task-optimizer");
const { seedGamedevRules } = require("./gamedev-instructions");
const { writeGamedevMcpConfig } = require("./gamedev-mcp-config");
const { getGamedevStatus } = require("./gamedev-status");
const {
  setGamedevModeActive,
  isGamedevModeActive,
  setLastGamedevSession,
  getLastGamedevSession,
  clearGamedevSession,
} = require("./gamedev-session-state");
const {
  buildSceneCacheHandoffHint,
  updateGamedevSceneCache,
} = require("./gamedev-scene-cache");
const {
  resolveGamedevDeltaHandoff,
  recordGamedevHandoffContext,
} = require("./gamedev-delta-handoff");
const {
  buildGameDevPlanBullets,
  resolveGamedevMode,
  resolveGamedevClineAgent,
} = require("./gamedev-router");
const { appendGamedevLedgerEvent } = require("./gamedev-finops-ledger");

function resolveWorkspacePath(workspacePath, settings = {}) {
  const fromArg = String(workspacePath || "").trim();
  if (fromArg) {
    return fromArg;
  }
  return String(settings.workspacePath || "").trim();
}

async function toggleGamedevMode(settings = {}) {
  if (settings.gamedevEnabled === false) {
    return { ok: false, error: "Game Dev modu devre dışı. Ayarlar → Eklentiler." };
  }

  const probe = probeGamedevMcpEntry(settings);
  if (!probe.ok) {
    return { ok: false, error: probe.error };
  }

  if (isGamedevModeActive()) {
    setGamedevModeActive(false);
    return {
      ok: true,
      modeActive: false,
      toggled: true,
    };
  }

  const engine = normalizeGamedevEngine(settings.gamedevActiveEngine);
  const workspacePath = resolveWorkspacePath(null, settings);
  if (workspacePath) {
    writeGamedevMcpConfig(workspacePath, settings, engine);
    seedGamedevRules(workspacePath, engine);
  }

  setGamedevModeActive(true, { engine, workspacePath });
  const status = await getGamedevStatus(settings, engine);

  return {
    ok: true,
    modeActive: true,
    toggled: true,
    engine,
    engineLabel: GAMEDEV_ENGINE_LABELS[engine],
    status,
  };
}

async function launchGamedevSession({
  workspacePath,
  taskText,
  settings = {},
  engineOverride = null,
} = {}) {
  if (settings.gamedevEnabled === false) {
    return { ok: false, error: "Game Dev modu devre dışı. Ayarlar → Eklentiler." };
  }

  const resolvedWorkspace = resolveWorkspacePath(workspacePath, settings);
  if (!resolvedWorkspace) {
    return { ok: false, error: "Workspace path ayarlanmamış — Ayarlar → Çalışma Kısmı." };
  }

  const rawTask = String(taskText || "").trim();
  if (!rawTask) {
    return { ok: false, error: "Game Dev için görev metni gerekli." };
  }

  const probe = probeGamedevMcpEntry(settings);
  if (!probe.ok) {
    return { ok: false, error: probe.error };
  }

  const engine = normalizeGamedevEngine(engineOverride || settings.gamedevActiveEngine);
  const mcpEntryPath = resolveGamedevMcpEntryPath(settings);
  const notices = [];
  const routing = resolveGamedevMode(settings);
  const delta = resolveGamedevDeltaHandoff(settings, resolvedWorkspace, rawTask);
  const planBullets = buildGameDevPlanBullets(rawTask);

  const mcpWrite = writeGamedevMcpConfig(resolvedWorkspace, settings, engine);
  if (!mcpWrite.ok) {
    return { ok: false, error: mcpWrite.error };
  }
  notices.push(`MCP config: ${mcpWrite.writtenPaths.length} dosya`);

  seedSauronRules(resolvedWorkspace);
  seedGamedevRules(resolvedWorkspace, engine);

  const sceneHint = buildSceneCacheHandoffHint(resolvedWorkspace, engine);
  const handoffMeta = buildGamedevHandoffSummary({
    taskText: rawTask,
    engine,
    workspacePath: resolvedWorkspace,
    settings,
    mcpEntryPath,
    notices: [
      ...notices,
      ...(delta.hint ? [delta.hint] : []),
      ...(sceneHint ? [sceneHint] : []),
      ...(planBullets ? [`Plan (0-token):\n${planBullets}`] : []),
    ],
  });

  const optimizer = mergeCostOptimizerConfig(settings);
  const suggestedClineAgent = resolveGamedevClineAgent(settings);

  const handoffId = generateHandoffId();
  const payload = {
    version: 2,
    id: handoffId,
    source: "sauron-gamedev",
    channel: "gamedev",
    workspacePath: resolvedWorkspace,
    taskSummary: handoffMeta.summary,
    goal: handoffMeta.optimizedTask,
    createdAt: new Date().toISOString(),
    autoStart: true,
    autoChain: false,
    complexityHint: "low",
    projectType: "game-unity",
    gamedev: {
      engine,
      mcpServerId: mcpWrite.serverId,
      mcpEntryPath,
      tokenPolicy: handoffMeta.tokenPolicy,
      mcpTools: "full",
      mode: routing.mode,
      planBullets,
    },
    costContext: {
      coreModelTier: optimizer.coreModelTier,
      optimizerEnabled: optimizer.enabled,
      mode: optimizer.mode,
      budgetGovernorActive: false,
      deltaHandoff: delta.deltaMode,
      suggestedClineAgent,
    },
  };

  const written = writeHandoff(resolvedWorkspace, payload);
  const launchResult = await launchVSCode(resolvedWorkspace, settings);
  const status = await getGamedevStatus(settings, engine);

  updateGamedevSceneCache(resolvedWorkspace, {
    engine,
    goal: handoffMeta.optimizedTask,
    connectorConnected: status?.connector?.connected === true,
    status,
  });
  recordGamedevHandoffContext(resolvedWorkspace, handoffMeta.optimizedTask);
  appendGamedevLedgerEvent(resolvedWorkspace, {
    type: "session-start",
    engine,
    handoffId: written.handoffId,
    mode: routing.mode,
    deltaHandoff: delta.deltaMode,
    handoffChars: handoffMeta.summary.length,
    mcpTools: "full",
  });

  setGamedevModeActive(true, {
    engine,
    workspacePath: resolvedWorkspace,
    handoffId: written.handoffId,
    handoffFileName: written.fileName,
  });

  const session = {
    sessionId: `gamedev-${Date.now()}`,
    modeActive: true,
    engine,
    workspacePath: resolvedWorkspace,
    handoffId: written.handoffId,
    handoffFileName: written.fileName,
    handoffPath: written.handoffPath,
    mcpEntryPath,
    tokenPolicy: handoffMeta.tokenPolicy,
    truncated: handoffMeta.truncated,
    routing,
    vscode: launchResult,
    status,
  };
  setLastGamedevSession(session);

  return {
    ok: true,
    modeActive: true,
    engine,
    engineLabel: GAMEDEV_ENGINE_LABELS[engine],
    workspacePath: resolvedWorkspace,
    handoffId: written.handoffId,
    handoffFileName: written.fileName,
    handoffPath: written.handoffPath,
    mcpEntryPath,
    writtenPaths: mcpWrite.writtenPaths,
    tokenPolicy: handoffMeta.tokenPolicy,
    truncated: handoffMeta.truncated,
    notices,
    routing,
    deltaHandoff: delta.deltaMode,
    planBullets,
    status,
    vscode: launchResult,
    focus: await focusVSCodeWorkspace(resolvedWorkspace, settings).catch(() => ({ ok: false })),
  };
}

function getGamedevSessionInfo() {
  return {
    modeActive: isGamedevModeActive(),
    session: getLastGamedevSession(),
  };
}

function deactivateGamedevMode() {
  setGamedevModeActive(false);
  return { ok: true, modeActive: false };
}

module.exports = {
  toggleGamedevMode,
  launchGamedevSession,
  getGamedevSessionInfo,
  deactivateGamedevMode,
  clearGamedevSession,
  isGamedevModeActive,
};
