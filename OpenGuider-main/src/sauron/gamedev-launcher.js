const fs = require("fs");
const path = require("path");
const {
  generateHandoffId,
  writeHandoff,
  seedSauronRules,
  focusVSCodeWorkspace,
} = require("./handoff");
const { focusOrLaunchWorkspaceVSCode } = require("./gamedev-vscode-focus");
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
const { resolveWireRecipePointer } = require("./unity-wire-recipes");
const { buildBriefHandoffHint, BRIEF_POINTER, readGameDesignBrief, hashBriefText } = require("./gamedev-prompt-compiler");
const { tryExecuteWireRecipe } = require("./gamedev-wire-executor");
const {
  startGamePipeline,
  getCurrentPhaseGoal,
} = require("./game-pipeline");
const { scaffoldUnityTemplate } = require("./scaffold-unity-template");

function resolveWorkspacePath(workspacePath, settings = {}) {
  const fromArg = String(workspacePath || "").trim();
  if (fromArg) {
    return fromArg;
  }
  return String(settings.workspacePath || "").trim();
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
    launchResult: vscode?.launchResult || null,
    dashboardUrl: `http://127.0.0.1:${status.dashboardPort || 3100}`,
  };
}

async function toggleGamedevMode(settings = {}) {
  return activateGamedevMode(settings);
}

async function launchGamedevSession({
  workspacePath,
  taskText,
  masterPrompt = "",
  settings = {},
  engineOverride = null,
  streamAIResponse = null,
} = {}) {
  if (settings.gamedevEnabled === false) {
    return { ok: false, error: "Game Dev modu devre dışı. Ayarlar → Eklentiler." };
  }

  const resolvedWorkspace = resolveWorkspacePath(workspacePath, settings);
  if (!resolvedWorkspace) {
    return { ok: false, error: "Workspace path ayarlanmamış — Ayarlar → Çalışma Kısmı." };
  }

  const rawTask = String(taskText || "").trim();
  const rawMaster = String(masterPrompt || settings.gamedevMasterPrompt || "").trim();
  const effectiveMaster = rawMaster || rawTask;
  if (!effectiveMaster) {
    return { ok: false, error: "Game Dev için görev veya oyun planı gerekli." };
  }

  const probe = probeGamedevMcpEntry(settings);
  if (!probe.ok) {
    return { ok: false, error: probe.error };
  }

  const engine = normalizeGamedevEngine(engineOverride || settings.gamedevActiveEngine);
  const mcpEntryPath = resolveGamedevMcpEntryPath(settings);
  const notices = [];
  const routing = resolveGamedevMode(settings);

  const genre = resolveGamedevGenre(effectiveMaster, settings);
  const pipelineId = String(genre.pipelineId || settings.gamedevPipelineId || "unity-empty-v1").trim();
  const pipelineStart = await startGamePipeline({
    pipelineId,
    workspacePath: resolvedWorkspace,
    taskDescription: rawTask || effectiveMaster.slice(0, 200),
    masterPrompt: effectiveMaster,
    settings: { ...settings, _gamedevAdaptive: genre.adaptive === true },
    streamAIResponse,
    adaptive: genre.adaptive === true,
  });
  if (!pipelineStart.ok) {
    return { ok: false, error: pipelineStart.error };
  }

  const phaseInfo = getCurrentPhaseGoal(resolvedWorkspace);
  const activePipeline = phaseInfo?.pipeline || pipelineStart.pipeline;
  const projectType = activePipeline?.projectType || (engine === "unreal" ? "game-unreal" : "game-unity");

  if (phaseInfo?.phase === 1 && genre.presetScaffold && genre.templateId && engine === "unity") {
    const scaffold = scaffoldUnityTemplate(resolvedWorkspace, genre.templateId);
    if (scaffold.ok) {
      notices.push(`Template scaffold: ${scaffold.label}`);
      seedGamedevGenreRules(resolvedWorkspace, genre.genre, engine);
    }
  }

  const effectiveTask = phaseInfo?.goal || rawTask;
  const brief = readGameDesignBrief(resolvedWorkspace);
  const wireRecipePointer = phaseInfo ? resolveWireRecipePointer(phaseInfo.genre || genre.genre, phaseInfo.phase) : null;
  if (wireRecipePointer) {
    const wireRun = await tryExecuteWireRecipe(wireRecipePointer);
    if (wireRun.ok && !wireRun.skipped) {
      notices.push(`Wire recipe executed: ${wireRecipePointer} (${wireRun.stepsRun || 0} steps)`);
      appendGamedevLedgerEvent(resolvedWorkspace, {
        type: "mcp-tool",
        count: wireRun.stepsRun || 0,
        source: "wire-executor",
        recipeId: wireRecipePointer,
      });
    } else if (wireRun.skipped) {
      notices.push(`Wire recipe deferred: ${wireRecipePointer}`);
    }
  }
  const delta = resolveGamedevDeltaHandoff(
    settings,
    resolvedWorkspace,
    effectiveTask,
    brief?.briefHash || hashBriefText(effectiveMaster),
  );
  const planBullets = buildGameDevPlanBullets(effectiveTask);

  const mcpWrite = writeGamedevMcpConfig(resolvedWorkspace, settings, engine);
  if (!mcpWrite.ok) {
    return { ok: false, error: mcpWrite.error };
  }
  notices.push(`MCP config: ${mcpWrite.writtenPaths.length} dosya`);

  seedSauronRules(resolvedWorkspace);
  seedGamedevRules(resolvedWorkspace, engine);

  const sceneHint = buildSceneCacheHandoffHint(resolvedWorkspace, engine);
  const briefHint = buildBriefHandoffHint(pipelineStart.pipeline?.briefMeta?.briefSummary || effectiveMaster.slice(0, 120));
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
      briefHint,
      ...(delta.hint ? [delta.hint] : []),
      ...(sceneHint ? [sceneHint] : []),
      ...(planBullets ? [`Plan (0-token):\n${planBullets}`] : []),
      ...(wireRecipePointer ? [`Wire recipe pointer: ${wireRecipePointer}`] : []),
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
    projectType,
    pipelineId: phaseInfo?.pipeline?.id || null,
    pipelinePhase: phaseInfo?.phase || null,
    pipelineTotalPhases: phaseInfo?.totalPhases || null,
    wireRecipe: wireRecipePointer,
    briefPointer: BRIEF_POINTER,
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
      wireRecipe: wireRecipePointer,
      briefPointer: BRIEF_POINTER,
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
  void require("./gamedev-scene-cache").tryCaptureHierarchySnapshot(resolvedWorkspace);
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
