const { getGamePipeline } = require("./game-pipeline-registry");
const { planGamePipeline } = require("./game-pipeline-planner");
const {
  readGamePipelineState,
  writeGamePipelineState,
  readTaskCompleteArtifact,
  clearTaskCompleteArtifact,
  runGameVerification,
} = require("./game-pipeline-state");
const { writeGamedevPhaseHandoff } = require("../gamedev-phase-handoff");
const { focusOrLaunchWorkspaceVSCode } = require("../gamedev-vscode-focus");

function getCurrentPhaseDef(pipelineState) {
  if (!pipelineState) {
    return null;
  }
  const template = getGamePipeline(pipelineState.templateId);
  const currentPhase = Number(pipelineState.currentPhase) || 1;
  return template?.phases?.find((p) => p.phase === currentPhase) || null;
}

function getCurrentPhaseGoal(workspacePath) {
  const state = readGamePipelineState(workspacePath);
  const template = state ? getGamePipeline(state.templateId) : null;
  const phaseDef = getCurrentPhaseDef(state);
  if (!phaseDef || !state) {
    return null;
  }
  return {
    pipeline: { ...state, label: template?.label, phases: template?.phases },
    phase: phaseDef.phase,
    goal: phaseDef.goal,
    totalPhases: state.totalPhases,
    templateId: state.templateId,
    genre: state.genre,
    templateScaffold: state.templateScaffold,
  };
}

function startGamePipeline({
  pipelineId,
  workspacePath,
  taskDescription = "",
  forceRestart = false,
} = {}) {
  const resolvedPath = String(workspacePath || "").trim();
  if (!resolvedPath) {
    return { ok: false, error: "Workspace path is required." };
  }

  const existing = readGamePipelineState(resolvedPath);
  if (existing?.status === "active" && !forceRestart) {
    const phase = getCurrentPhaseGoal(resolvedPath);
    return { ok: true, pipeline: existing, resumed: true, phase };
  }

  const planned = planGamePipeline(pipelineId, { taskDescription });
  if (!planned.ok) {
    return planned;
  }

  writeGamePipelineState(resolvedPath, planned.pipeline);
  const phase = getCurrentPhaseGoal(resolvedPath);
  return { ok: true, pipeline: planned.pipeline, resumed: false, phase };
}

function advanceGamePipeline(workspacePath, settings = {}) {
  const resolvedPath = String(workspacePath || "").trim();
  const pipelineState = readGamePipelineState(resolvedPath);
  if (!pipelineState || pipelineState.status !== "active") {
    return { ok: false, error: "No active game pipeline." };
  }

  if (settings.gamedevPipelineAutoChain === false) {
    return { ok: false, error: "Pipeline auto-chain disabled." };
  }

  const artifact = readTaskCompleteArtifact(resolvedPath);
  if (!artifact) {
    return { ok: false, error: "No task complete artifact." };
  }

  if (artifact.pipelineId && artifact.pipelineId !== pipelineState.id) {
    return { ok: false, error: "Task complete artifact does not match active game pipeline." };
  }

  clearTaskCompleteArtifact(resolvedPath);

  const currentPhase = Number(pipelineState.currentPhase) || 1;
  if (currentPhase >= pipelineState.totalPhases) {
    pipelineState.status = "completed";
    pipelineState.completedAt = new Date().toISOString();
    writeGamePipelineState(resolvedPath, pipelineState);
    return { ok: true, action: "completed", pipeline: pipelineState };
  }

  pipelineState.currentPhase = currentPhase + 1;
  writeGamePipelineState(resolvedPath, pipelineState);
  const phase = getCurrentPhaseGoal(resolvedPath);
  return { ok: true, action: "next-phase", pipeline: pipelineState, phase };
}

async function advanceGamePipelineAfterComplete(workspacePath, settings = {}, deps = {}) {
  const resolvedPath = String(workspacePath || "").trim();
  const pipelineState = readGamePipelineState(resolvedPath);
  if (!pipelineState || pipelineState.status !== "active") {
    return { ok: false, error: "No active game pipeline." };
  }

  if (settings.gamedevPipelineAutoChain === false) {
    return { ok: false, error: "Pipeline auto-chain disabled." };
  }

  const artifact = readTaskCompleteArtifact(resolvedPath);
  if (!artifact) {
    return { ok: false, error: "No task complete artifact." };
  }

  if (artifact.pipelineId && artifact.pipelineId !== pipelineState.id) {
    return { ok: false, error: "Task complete artifact does not match active game pipeline." };
  }

  const currentPhase = Number(pipelineState.currentPhase) || 1;
  const template = getGamePipeline(pipelineState.templateId);
  const phaseDef = template?.phases?.find((p) => p.phase === currentPhase);

  let verificationResult = { ok: true, skipped: true };
  if (phaseDef?.verification) {
    verificationResult = await runGameVerification(resolvedPath, phaseDef.verification);
  }

  if (!verificationResult.ok) {
    const written = await writeGamedevPhaseHandoff({
      workspacePath: resolvedPath,
      settings,
      pipelineState,
      phaseDef: {
        phase: currentPhase,
        goal: `Fix verification failure for phase ${currentPhase}: ${verificationResult.error || "verification failed"}`,
        complexityHint: "medium",
        verification: phaseDef?.verification,
      },
      parentHandoffId: artifact.handoffId,
      scaffoldOnPhaseOne: false,
    });
    clearTaskCompleteArtifact(resolvedPath);
    if (deps.launchVSCode !== false) {
      await focusOrLaunchWorkspaceVSCode(resolvedPath).catch(() => null);
    }
    return {
      ok: true,
      action: "fix-handoff",
      verification: verificationResult,
      handoffPath: written.handoffPath,
      handoffFileName: written.handoffFileName,
    };
  }

  clearTaskCompleteArtifact(resolvedPath);

  if (currentPhase >= pipelineState.totalPhases) {
    pipelineState.status = "completed";
    pipelineState.completedAt = new Date().toISOString();
    writeGamePipelineState(resolvedPath, pipelineState);
    return { ok: true, action: "completed", pipeline: pipelineState, verification: verificationResult };
  }

  const nextPhase = currentPhase + 1;
  const nextPhaseDef = template.phases.find((p) => p.phase === nextPhase);
  pipelineState.currentPhase = nextPhase;
  writeGamePipelineState(resolvedPath, pipelineState);

  const written = await writeGamedevPhaseHandoff({
    workspacePath: resolvedPath,
    settings,
    pipelineState,
    phaseDef: nextPhaseDef,
    parentHandoffId: artifact.handoffId,
    scaffoldOnPhaseOne: nextPhase === 1,
  });

  if (deps.launchVSCode !== false) {
    await focusOrLaunchWorkspaceVSCode(resolvedPath).catch(() => null);
  }

  return {
    ok: true,
    action: "next-phase",
    pipeline: pipelineState,
    phase: nextPhaseDef,
    verification: verificationResult,
    handoffPath: written.handoffPath,
    handoffFileName: written.handoffFileName,
  };
}

function getGamePipelineStatus(workspacePath) {
  const state = readGamePipelineState(workspacePath);
  const artifact = readTaskCompleteArtifact(workspacePath);
  const phase = getCurrentPhaseGoal(workspacePath);
  return {
    ok: true,
    pipeline: state,
    phase,
    pendingComplete: Boolean(artifact),
    taskComplete: artifact,
    statusLabel: state?.status === "completed"
      ? "completed"
      : (artifact ? "pending-advance" : "active"),
  };
}

module.exports = {
  startGamePipeline,
  advanceGamePipeline,
  advanceGamePipelineAfterComplete,
  getCurrentPhaseGoal,
  getCurrentPhaseDef,
  getGamePipelineStatus,
};
