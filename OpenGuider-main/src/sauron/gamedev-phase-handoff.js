const { generateHandoffId, writeHandoff, seedSauronRules } = require("./handoff");
const { applyTokenUltraToHandoff } = require("./token-ultra");
const { mergeCostOptimizerConfig } = require("./finops/cost-optimizer-config");
const { buildGamedevHandoffSummary } = require("./gamedev-task-optimizer");
const { seedGamedevRules, seedGamedevGenreRules } = require("./gamedev-instructions");
const { writeGamedevMcpConfig } = require("./gamedev-mcp-config");
const { resolveGamedevMcpEntryPath } = require("./gamedev-path-resolver");
const { GAMEDEV_ENGINE_LABELS, normalizeGamedevEngine } = require("./gamedev-config");
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
const { resolveWireRecipePointer } = require("./unity-wire-recipes");
const { buildBriefHandoffHint, BRIEF_POINTER, readGameDesignBrief, hashBriefText } = require("./gamedev-prompt-compiler");
const { getGamedevStatus } = require("./gamedev-status");
const { scaffoldUnityTemplate } = require("./scaffold-unity-template");

function buildGamePhaseHandoffOverrides({
  pipelineState,
  phaseDef,
  parentHandoffId,
  settings,
  wireRecipePointer,
}) {
  const planBullets = buildGameDevPlanBullets(phaseDef.goal);
  const taskSummary = [
    `Goal: ${phaseDef.goal}`,
    "",
    "Plan steps:",
    ...(planBullets ? planBullets.split("\n").map((line) => line.trim()).filter(Boolean) : [`1. ${phaseDef.goal}`]),
    "",
    `Acceptance: Complete phase ${phaseDef.phase} of pipeline ${pipelineState.templateId}`,
    ...(wireRecipePointer ? [`Wire recipe: ${wireRecipePointer}`] : []),
  ].join("\n");

  return {
    goal: phaseDef.goal,
    taskSummary,
    projectType: pipelineState.projectType || "game-unity",
    pipelineId: pipelineState.id,
    pipelinePhase: phaseDef.phase,
    pipelineTotalPhases: pipelineState.totalPhases,
    parentHandoffId,
    complexityHint: phaseDef.complexityHint || "low",
    verification: phaseDef.verification,
    autoChain: settings.gamedevPipelineAutoChain !== false,
    autoStart: true,
    sessionId: pipelineState.id,
    wireRecipe: wireRecipePointer || null,
  };
}

async function writeGamedevPhaseHandoff({
  workspacePath,
  settings = {},
  pipelineState,
  phaseDef,
  parentHandoffId = null,
  engineOverride = null,
  scaffoldOnPhaseOne = true,
}) {
  const resolvedWorkspace = String(workspacePath || "").trim();
  if (!resolvedWorkspace || !pipelineState || !phaseDef) {
    return { ok: false, error: "workspacePath, pipelineState, and phaseDef are required." };
  }

  const engine = normalizeGamedevEngine(engineOverride || settings.gamedevActiveEngine);
  const mcpEntryPath = resolveGamedevMcpEntryPath(settings);
  const routing = resolveGamedevMode(settings);
  const notices = [];

  if (scaffoldOnPhaseOne && phaseDef.phase === 1 && pipelineState.templateScaffold) {
    const scaffold = scaffoldUnityTemplate(resolvedWorkspace, pipelineState.templateScaffold);
    if (scaffold.ok) {
      notices.push(`Template scaffold: ${scaffold.label}`);
      seedGamedevGenreRules(resolvedWorkspace, pipelineState.genre, engine);
    }
  }

  const wireRecipePointer = resolveWireRecipePointer(pipelineState.genre, phaseDef.phase);
  const brief = readGameDesignBrief(resolvedWorkspace);
  const briefHint = buildBriefHandoffHint(brief?.masterPrompt?.slice(0, 120) || pipelineState.masterPrompt?.slice(0, 120));
  const overrides = buildGamePhaseHandoffOverrides({
    pipelineState,
    phaseDef,
    parentHandoffId,
    settings,
    wireRecipePointer,
  });
  const effectiveTask = overrides.goal;
  const delta = resolveGamedevDeltaHandoff(
    settings,
    resolvedWorkspace,
    effectiveTask,
    brief?.briefHash || hashBriefText(brief?.masterPrompt || pipelineState.masterPrompt || effectiveTask),
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
  const handoffMeta = buildGamedevHandoffSummary({
    taskText: effectiveTask,
    engine,
    workspacePath: resolvedWorkspace,
    settings,
    mcpEntryPath,
    notices: [
      ...notices,
      `Pipeline: ${pipelineState.label || pipelineState.templateId} — Faz ${phaseDef.phase}/${pipelineState.totalPhases}`,
      ...(delta.hint ? [delta.hint] : []),
      ...(sceneHint ? [sceneHint] : []),
      ...(planBullets ? [`Plan (0-token):\n${planBullets}`] : []),
      ...(wireRecipePointer ? [`Wire recipe pointer: ${wireRecipePointer}`] : []),
      briefHint,
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
    complexityHint: overrides.complexityHint,
    projectType: overrides.projectType,
    pipelineId: pipelineState.id,
    pipelinePhase: phaseDef.phase,
    pipelineTotalPhases: pipelineState.totalPhases,
    parentHandoffId,
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
      genre: pipelineState.genre,
      templateId: pipelineState.templateScaffold,
      pipelineTemplateId: pipelineState.templateId,
      pipelineRunId: pipelineState.id,
      phase: phaseDef.phase,
      totalPhases: pipelineState.totalPhases,
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
    goal: handoffMeta.optimizedTask,
    handoffId,
  });
  const written = writeHandoff(resolvedWorkspace, ultra.payload);
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
    `Game dev phase ${phaseDef.phase}/${pipelineState.totalPhases}`,
  );
  appendGamedevLedgerEvent(resolvedWorkspace, {
    type: "session-start",
    engine,
    handoffId: written.handoffId,
    mode: routing.mode,
    deltaHandoff: delta.deltaMode,
    handoffChars: handoffMeta.summary.length,
    mcpTools: "full",
    pipelineId: pipelineState.id,
    phase: phaseDef.phase,
    source: "phase-handoff",
  });

  return {
    ok: true,
    handoffId: written.handoffId,
    handoffPath: written.handoffPath,
    handoffFileName: written.fileName,
    engine,
    engineLabel: GAMEDEV_ENGINE_LABELS[engine],
    tokenPolicy: handoffMeta.tokenPolicy,
    wireRecipe: wireRecipePointer,
    status,
  };
}

module.exports = {
  buildGamePhaseHandoffOverrides,
  writeGamedevPhaseHandoff,
};
