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
const { seedGamedevRules, seedGamedevGenreRules } = require("./gamedev-instructions");
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
const { resolveGamedevGenre } = require("./gamedev-genre-router");
const {
  startGamePipeline,
  getCurrentPhaseGoal,
} = require("./game-pipeline");
const { scaffoldUnityTemplate } = require("./scaffold-unity-template");

const RELIABLE_VSCODE_LAUNCH_OPTIONS = {
  newWindow: false,
  force: true,
  skipRecovery: true,
  skipVerification: true,
  bypassDebounce: true,
};

function resolveWorkspacePath(workspacePath, settings = {}) {
  const fromArg = String(workspacePath || "").trim();
  if (fromArg) {
    return fromArg;
  }
  return String(settings.workspacePath || "").trim();
}

async function focusOrLaunchWorkspaceVSCode(workspacePath) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return { ok: false, error: "Workspace path is required." };
  }

  const focused = await focusVSCodeWorkspace(resolved, {
    allowLaunch: false,
    verifyTimeoutMs: 4000,
    skipPostVerifySettle: true,
  });

  const launchResult = focused?.verified
    ? focused
    : await launchVSCode(resolved, RELIABLE_VSCODE_LAUNCH_OPTIONS);

  return {
    ok: true,
    launchResult,
    action: focused?.verified ? "focus_existing" : (launchResult?.skipped ? "launch_skipped" : "launch"),
  };
}

async function activateGamedevMode(settings = {}) {
  if (settings.gamedevEnabled === false) {
    return { ok: false, error: "Game Dev modu devre dışı. Ayarlar → Eklentiler." };
  }

  const probe = probeGamedevMcpEntry(settings);
  if (!probe.ok) {
    return { ok: false, error: probe.error };
  }

  const engine = normalizeGamedevEngine(settings.gamedevActiveEngine);
  const workspacePath = resolveWorkspacePath(null, settings);
  if (!workspacePath) {
    return { ok: false, error: "Workspace path ayarlanmamış — Ayarlar → Çalışma Kısmı." };
  }

  writeGamedevMcpConfig(workspacePath, settings, engine);
  seedGamedevRules(workspacePath, engine);
  seedSauronRules(workspacePath);

  const alreadyActive = isGamedevModeActive();
  const status = await getGamedevStatus(settings, engine);
  const vscode = await focusOrLaunchWorkspaceVSCode(workspacePath);

  setGamedevModeActive(true, { engine, workspacePath });

  return {
    ok: true,
    modeActive: true,
    alreadyActive,
    engine,
    engineLabel: GAMEDEV_ENGINE_LABELS[engine],
    workspacePath,
    status,
    vscode,
    dashboardUrl: `http://127.0.0.1:${status.dashboardPort || 3100}`,
  };
}

async function toggleGamedevMode(settings = {}) {
  return activateGamedevMode(settings);
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

  const genre = resolveGamedevGenre(rawTask, settings);
  const pipelineId = String(settings.gamedevPipelineId || genre.pipelineId || "unity-empty-v1").trim();
  const pipelineStart = startGamePipeline({
    pipelineId,
    workspacePath: resolvedWorkspace,
    taskDescription: rawTask,
  });
  if (!pipelineStart.ok) {
    return { ok: false, error: pipelineStart.error };
  }

  const phaseInfo = getCurrentPhaseGoal(resolvedWorkspace);
  if (phaseInfo?.phase === 1 && genre.templateId) {
    const scaffold = scaffoldUnityTemplate(resolvedWorkspace, genre.templateId);
    if (scaffold.ok) {
      notices.push(`Template scaffold: ${scaffold.label}`);
      seedGamedevGenreRules(resolvedWorkspace, genre.genre, engine);
    }
  }

  const effectiveTask = phaseInfo?.goal || rawTask;
  const delta = resolveGamedevDeltaHandoff(settings, resolvedWorkspace, effectiveTask);
  const planBullets = buildGameDevPlanBullets(effectiveTask);

  const mcpWrite = writeGamedevMcpConfig(resolvedWorkspace, settings, engine);
  if (!mcpWrite.ok) {
    return { ok: false, error: mcpWrite.error };
  }
  notices.push(`MCP config: ${mcpWrite.writtenPaths.length} dosya`);

  seedSauronRules(resolvedWorkspace);
  seedGamedevRules(resolvedWorkspace, engine);

  const sceneHint = buildSceneCacheHandoffHint(resolvedWorkspace, engine);
  const handoffMeta = buildGamedevHandoffSummary({
    taskText: effectiveTask,
    engine,
    workspacePath: resolvedWorkspace,
    settings,
    mcpEntryPath,
    notices: [
      ...notices,
      ...(phaseInfo
        ? [`Pipeline: ${phaseInfo.pipeline.label} — Faz ${phaseInfo.phase}/${phaseInfo.totalPhases}`]
        : []),
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
    autoChain: settings.gamedevPipelineAutoChain !== false,
    complexityHint: "low",
    projectType: "game-unity",
    pipelineId: phaseInfo?.pipeline?.id || null,
    pipelinePhase: phaseInfo?.phase || null,
    pipelineTotalPhases: phaseInfo?.totalPhases || null,
    gamedev: {
      engine,
      mcpServerId: mcpWrite.serverId,
      mcpEntryPath,
      tokenPolicy: handoffMeta.tokenPolicy,
      mcpTools: "full",
      mode: routing.mode,
      planBullets,
      genre: genre.genre,
      templateId: genre.templateId,
      pipelineTemplateId: phaseInfo?.pipeline?.templateId || pipelineId,
      pipelineRunId: phaseInfo?.pipeline?.id || null,
      phase: phaseInfo?.phase || null,
      totalPhases: phaseInfo?.totalPhases || null,
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
  const vscodeLaunch = await focusOrLaunchWorkspaceVSCode(resolvedWorkspace);
  const launchResult = vscodeLaunch.launchResult || null;
  const status = await getGamedevStatus(settings, engine);

  updateGamedevSceneCache(resolvedWorkspace, {
    engine,
    goal: handoffMeta.optimizedTask,
    connectorConnected: status?.connector?.connected === true,
    status,
  });
  recordGamedevHandoffContext(
    resolvedWorkspace,
    handoffMeta.optimizedTask,
    phaseInfo ? `Game dev phase ${phaseInfo.phase}/${phaseInfo.totalPhases}` : "",
  );
  appendGamedevLedgerEvent(resolvedWorkspace, {
    type: "session-start",
    engine,
    handoffId: written.handoffId,
    mode: routing.mode,
    deltaHandoff: delta.deltaMode,
    handoffChars: handoffMeta.summary.length,
    mcpTools: "full",
    pipelineId: phaseInfo?.pipeline?.id,
    phase: phaseInfo?.phase,
  });
  if (phaseInfo?.pipeline?.phases) {
    const phaseDef = phaseInfo.pipeline.phases.find((p) => p.phase === phaseInfo.phase);
    if (phaseDef?.verification?.mcp === "unity_play_mode") {
      appendGamedevLedgerEvent(resolvedWorkspace, {
        type: "mcp-tool",
        tool: "unity_play_mode",
        phase: phaseInfo.phase,
      });
    }
  }

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
    vscode: vscodeLaunch,
    launchResult,
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
    genre,
    pipeline: phaseInfo?.pipeline || pipelineStart.pipeline,
    phase: phaseInfo,
    status,
    vscode: vscodeLaunch,
    launchResult,
    focus: await focusVSCodeWorkspace(resolvedWorkspace, {
      allowLaunch: false,
      verifyTimeoutMs: 4000,
    }).catch(() => ({ ok: false })),
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
  activateGamedevMode,
  toggleGamedevMode,
  focusOrLaunchWorkspaceVSCode,
  launchGamedevSession,
  getGamedevSessionInfo,
  deactivateGamedevMode,
  clearGamedevSession,
  isGamedevModeActive,
};
