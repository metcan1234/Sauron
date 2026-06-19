const { bootstrapWorkspace } = require("../workspace-bootstrap");
const { buildHandoffPayload, writeHandoff, generateHandoffId } = require("../handoff");
const { planPipeline } = require("./pipeline-planner");
const { getPipeline } = require("./pipeline-registry");
const {
  readPipelineState,
  writePipelineState,
  readTaskCompleteArtifact,
  clearTaskCompleteArtifact,
  runVerification,
} = require("./pipeline-state");

function buildPhaseHandoffPayload({
  pipelineState,
  phaseDef,
  workspacePath,
  settings,
  parentHandoffId,
  sessionSnapshot = {},
}) {
  const handoffId = generateHandoffId();
  const taskSummary = [
    `Goal: ${phaseDef.goal}`,
    "",
    `Plan steps:`,
    `1. ${phaseDef.goal}`,
    "",
    `Acceptance: Complete phase ${phaseDef.phase} of pipeline ${pipelineState.templateId}`,
  ].join("\n");

  return buildHandoffPayload(
    { ...sessionSnapshot, goalIntent: phaseDef.goal },
    workspacePath,
    handoffId,
    settings,
    {
      goal: phaseDef.goal,
      taskSummary,
      projectType: pipelineState.projectType,
      pipelineId: pipelineState.id,
      pipelinePhase: phaseDef.phase,
      pipelineTotalPhases: pipelineState.totalPhases,
      parentHandoffId,
      complexityHint: phaseDef.complexityHint,
      verification: phaseDef.verification,
      autoChain: settings.pipelineAutoChain !== false,
      autoStart: true,
      sessionId: pipelineState.id,
    },
  );
}

async function startBuildPipeline({
  pipelineId,
  workspacePath,
  settings = {},
  options = {},
}) {
  const resolvedPath = String(workspacePath || "").trim();
  if (!resolvedPath) {
    return { ok: false, error: "Workspace path is required." };
  }

  const planned = planPipeline(pipelineId, options);
  if (!planned.ok) {
    return planned;
  }

  await bootstrapWorkspace(resolvedPath, {
    ...settings,
    projectType: planned.pipeline.projectType,
  });

  writePipelineState(resolvedPath, planned.pipeline);

  const template = getPipeline(pipelineId);
  const firstPhase = template.phases[0];
  const payload = buildPhaseHandoffPayload({
    pipelineState: planned.pipeline,
    phaseDef: firstPhase,
    workspacePath: resolvedPath,
    settings,
  });
  const written = writeHandoff(resolvedPath, payload);

  return {
    ok: true,
    pipeline: planned.pipeline,
    handoffPath: written.handoffPath,
    handoffId: written.handoffId,
    handoffFileName: written.fileName,
  };
}

async function advancePipelineAfterComplete(workspacePath, settings = {}) {
  const resolvedPath = String(workspacePath || "").trim();
  const pipelineState = readPipelineState(resolvedPath);
  if (!pipelineState || pipelineState.status !== "active") {
    return { ok: false, error: "No active pipeline." };
  }

  const artifact = readTaskCompleteArtifact(resolvedPath);
  if (!artifact) {
    return { ok: false, error: "No task complete artifact." };
  }

  if (artifact.pipelineId && artifact.pipelineId !== pipelineState.id) {
    return { ok: false, error: "Task complete artifact does not match active pipeline." };
  }

  const currentPhase = Number(pipelineState.currentPhase) || 1;
  const template = getPipeline(pipelineState.templateId);
  const phaseDef = template?.phases?.find((p) => p.phase === currentPhase);

  let verificationResult = { ok: true, skipped: true };
  if (phaseDef?.verification) {
    verificationResult = await runVerification(resolvedPath, phaseDef.verification);
  }

  if (!verificationResult.ok) {
    const fixPayload = buildPhaseHandoffPayload({
      pipelineState,
      phaseDef: {
        phase: currentPhase,
        goal: `Fix verification failure for phase ${currentPhase}: ${verificationResult.error}`,
        complexityHint: "medium",
        verification: phaseDef?.verification,
      },
      workspacePath: resolvedPath,
      settings,
      parentHandoffId: artifact.handoffId,
    });
    const written = writeHandoff(resolvedPath, fixPayload);
    clearTaskCompleteArtifact(resolvedPath);
    return {
      ok: true,
      action: "fix-handoff",
      verification: verificationResult,
      handoffPath: written.handoffPath,
      handoffFileName: written.fileName,
    };
  }

  clearTaskCompleteArtifact(resolvedPath);

  if (currentPhase >= pipelineState.totalPhases) {
    pipelineState.status = "completed";
    pipelineState.completedAt = new Date().toISOString();
    writePipelineState(resolvedPath, pipelineState);
    return { ok: true, action: "completed", pipeline: pipelineState };
  }

  const nextPhase = currentPhase + 1;
  const nextPhaseDef = template.phases.find((p) => p.phase === nextPhase);
  pipelineState.currentPhase = nextPhase;
  writePipelineState(resolvedPath, pipelineState);

  const payload = buildPhaseHandoffPayload({
    pipelineState,
    phaseDef: nextPhaseDef,
    workspacePath: resolvedPath,
    settings,
    parentHandoffId: artifact.handoffId,
  });
  const written = writeHandoff(resolvedPath, payload);

  return {
    ok: true,
    action: "next-phase",
    pipeline: pipelineState,
    handoffPath: written.handoffPath,
    handoffFileName: written.fileName,
  };
}

function getBuildPipelineStatus(workspacePath) {
  const state = readPipelineState(workspacePath);
  const artifact = readTaskCompleteArtifact(workspacePath);
  return {
    ok: true,
    pipeline: state,
    pendingComplete: Boolean(artifact),
    taskComplete: artifact,
  };
}

module.exports = {
  startBuildPipeline,
  advancePipelineAfterComplete,
  getBuildPipelineStatus,
  buildPhaseHandoffPayload,
};
