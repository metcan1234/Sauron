const { getGamePipeline } = require("./game-pipeline-registry");
const { planGamePipeline } = require("./game-pipeline-planner");
const {
  readGamePipelineState,
  writeGamePipelineState,
  readTaskCompleteArtifact,
  clearTaskCompleteArtifact,
} = require("./game-pipeline-state");

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
  const phaseDef = getCurrentPhaseDef(state);
  if (!phaseDef) {
    return null;
  }
  return {
    pipeline: state,
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
  };
}

module.exports = {
  startGamePipeline,
  advanceGamePipeline,
  getCurrentPhaseGoal,
  getCurrentPhaseDef,
  getGamePipelineStatus,
};
