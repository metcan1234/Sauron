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
const channelRuntime = require("./channel-runtime");
const {
  setGamedevModeActive,
  isGamedevModeActive,
  setGamedevLaunchInProgress,
  setLastGamedevSession,
  getLastGamedevSession,
  clearGamedevSession,
} = require("./gamedev-session-state");
const {
  buildSceneCacheHandoffHint,
  updateGamedevSceneCache,
  readGamedevSceneCache,
} = require("./gamedev-scene-cache");
const {
  buildSceneDeltaHint,
  persistSceneSnapshot,
} = require("./gamedev-scene-delta");
const { resolvePreferredEngine } = require("./gamedev-engine-probe");
const { applyTokenUltraToHandoff } = require("./token-ultra");
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
const { bootstrapWorkspace } = require("./workspace-bootstrap");
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

  const engineChoice = resolvePreferredEngine(settings);
  const engine = normalizeGamedevEngine(engineChoice.engine || settings.gamedevActiveEngine);
  const workspacePath = resolveWorkspacePath(null, settings);
  if (!workspacePath) {
    return { ok: false, error: "Workspace path ayarlanmamış — Ayarlar → Çalışma Kısmı." };
  }
  if (!fs.existsSync(workspacePath)) {
    return { ok: false, error: "Workspace klasörü bulunamadı — Ayarlar → Çalışma Kısmı yolunu kontrol edin." };
  }

  const projectType = engine === "unreal" ? "game-unreal" : "game-unity";
  await bootstrapWorkspace(workspacePath, { ...settings, projectType });

  writeGamedevMcpConfig(workspacePath, settings, engine);
  seedGamedevRules(workspacePath, engine);
  seedSauronRules(workspacePath);

  const alreadyActive = isGamedevModeActive();
  setGamedevModeActive(true, { engine, workspacePath });
  setGamedevLaunchInProgress(true);
  let status;
  let vscode;
  try {
    status = await getGamedevStatus(settings, engine);
    vscode = await focusOrLaunchWorkspaceVSCode(workspacePath, {
      engine,
      engineLabel: GAMEDEV_ENGINE_LABELS[engine],
    });
    if (!vscode?.ok) {
      setGamedevModeActive(false);
      return { ok: false, error: vscode?.error || "VS Code başlatılamadı." };
    }
  } catch (error) {
    setGamedevModeActive(false);
    return { ok: false, error: error?.message || "VS Code başlatılamadı." };
  } finally {
    setGamedevLaunchInProgress(false);
  }

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
  if (isGamedevModeActive()) {
    return deactivateGamedevMode();
  }
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
  if (!fs.existsSync(resolvedWorkspace)) {
    return { ok: false, error: "Workspace klasörü bulunamadı — Ayarlar → Çalışma Kısmı yolunu kontrol edin." };
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

  const engineChoice = resolvePreferredEngine(settings);
  const engine = normalizeGamedevEngine(engineOverride || engineChoice.engine || settings.gamedevActiveEngine);
  let projectType = engine === "unreal" ? "game-unreal" : "game-unity";
  await bootstrapWorkspace(resolvedWorkspace, { ...settings, projectType });

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
  projectType = activePipeline?.projectType || projectType;

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
  const sceneDelta = buildSceneDeltaHint(resolvedWorkspace, {
    engine,
    lastGoal: effectiveTask,
    hierarchy: readGamedevSceneCache(resolvedWorkspace)?.hierarchy,
  }, engine);
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
      ...(sceneDelta.hint ? [sceneDelta.hint] : []),
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
      mcpTools: settings.gamedevToolProfile === "full" ? "full" : "core",
      mode: routing.mode,
      engineDetectSource: engineChoice.source,
      checkpointHint: "Use editor checkpoint/rollback before destructive scene edits when available.",
      ...(engine === "unreal" ? { executePythonPointer: ".sauron/cache/unreal-script.py" } : {}),
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

  const ultra = applyTokenUltraToHandoff(payload, settings, {
    workspacePath: resolvedWorkspace,
    sceneHash: sceneDelta.sceneHash,
    channel: "gamedev",
  });
  if (phaseInfo?.phase && phaseInfo?.totalPhases) {
    const { compactPhaseBoundary } = require("./token-ultra/session-compactor");
    const phaseSummary = compactPhaseBoundary({
      phase: phaseInfo.phase,
      totalPhases: phaseInfo.totalPhases,
      goal: phaseInfo.goal,
      lastSummary: handoffMeta.summary.slice(0, 200),
    });
    ultra.payload.tokenUltra = {
      ...(ultra.payload.tokenUltra || {}),
      phaseSummary,
    };
    if (phaseSummary && !String(ultra.payload.taskSummary || "").includes("Phase")) {
      ultra.payload.taskSummary = `${phaseSummary}\n\n${ultra.payload.taskSummary || ""}`.trim();
    }
  }
  const written = writeHandoff(resolvedWorkspace, ultra.payload);
  setGamedevModeActive(true, {
    engine,
    workspacePath: resolvedWorkspace,
    handoffId: written.handoffId,
    handoffFileName: written.fileName,
  });
  setGamedevLaunchInProgress(true);
  let vscodeLaunch;
  try {
    vscodeLaunch = await focusOrLaunchWorkspaceVSCode(resolvedWorkspace, {
      engine,
      engineLabel: GAMEDEV_ENGINE_LABELS[engine],
    });
    if (!vscodeLaunch?.ok) {
      setGamedevModeActive(false);
      return { ok: false, error: vscodeLaunch?.error || "VS Code başlatılamadı." };
    }
  } catch (error) {
    setGamedevModeActive(false);
    return { ok: false, error: error?.message || "VS Code başlatılamadı." };
  } finally {
    setGamedevLaunchInProgress(false);
  }
  const launchResult = vscodeLaunch.launchResult || null;
  const status = await getGamedevStatus(settings, engine);

  persistSceneSnapshot(resolvedWorkspace, {
    engine,
    lastGoal: handoffMeta.optimizedTask,
    hierarchy: readGamedevSceneCache(resolvedWorkspace)?.hierarchy,
    connectorConnected: status?.connector?.connected === true,
  });
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
    goal: handoffMeta.optimizedTask,
  }, settings);

  setLastGamedevSession({
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
  });

  const session = getLastGamedevSession();

  try {
    const { recordTask } = require("./project-memory");
    recordTask(resolvedWorkspace, {
      summary: String(handoffMeta.optimizedTask || taskText || "").slice(0, 160),
      handoffId: written.handoffId,
      channel: "gamedev",
    }, settings);
  } catch {
    // project memory is best-effort
  }

  // Register VS Code PID with channel-runtime
  const vscodePid = vscodeLaunch?.pid || launchResult?.pid || vscodeLaunch?.launchResult?.pid;
  if (vscodePid && typeof vscodePid === 'number' && vscodePid > 0) {
    channelRuntime.registerProcess('gamedev', vscodePid, {
      sessionId: session.sessionId,
      workspacePath: resolvedWorkspace,
      label: `Game Dev VS Code (${engine})`,
      dependencyPath: mcpEntryPath,
    });
  }

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
