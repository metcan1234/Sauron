const { bootstrapWorkspace } = require("../workspace-bootstrap");
const { prepareHandoffPayloadAsync, writeHandoff } = require("../handoff");
const { planPipeline } = require("./pipeline-planner");
const { getPipeline } = require("./pipeline-registry");
const {
  readPipelineState,
  writePipelineState,
  readTaskCompleteArtifact,
  clearTaskCompleteArtifact,
  runVerification,
} = require("./pipeline-state");

function buildPhaseHandoffOverrides({
  pipelineState,
  phaseDef,
  parentHandoffId,
  settings,
}) {
  const taskSummary = [
    `Goal: ${phaseDef.goal}`,
    "",
    "Plan steps:",
    `1. ${phaseDef.goal}`,
    "",
    `Acceptance: Complete phase ${phaseDef.phase} of pipeline ${pipelineState.templateId}`,
  ].join("\n");

  return {
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
  };
}

async function writePhaseHandoff({
  pipelineState,
  phaseDef,
  workspacePath,
  settings,
  parentHandoffId,
  sessionSnapshot = {},
  streamAIResponse,
  appLogger,
}) {
  const finopsEnriched = await prepareHandoffPayloadAsync({
    sessionSnapshot: { ...sessionSnapshot, goalIntent: phaseDef.goal },
    workspacePath,
    settings,
    streamAIResponse,
    appLogger,
    overrides: buildPhaseHandoffOverrides({
      pipelineState,
      phaseDef,
      parentHandoffId,
      settings,
    }),
  });
  return writeHandoff(workspacePath, finopsEnriched.payload);
}

async function startBuildPipeline({
  pipelineId,
  workspacePath,
  settings = {},
  options = {},
  streamAIResponse,
  appLogger,
  panelWindow,
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

  if (settings.codeAgentNativeEnabled === true) {
    const { runPhaseNativeCodeAgent } = require("../../code-agent/code-orchestrator");
    const codeResult = await runPhaseNativeCodeAgent({
      workspacePath: resolvedPath,
      phaseGoal: firstPhase.goal,
      settings,
      deps: { panelWindow },
    });
    return {
      ok: codeResult.ok,
      pipeline: planned.pipeline,
      native: true,
      codeAgentResult: codeResult,
      error: codeResult.error,
    };
  }

  const written = await writePhaseHandoff({
    pipelineState: planned.pipeline,
    phaseDef: firstPhase,
    workspacePath: resolvedPath,
    settings,
    streamAIResponse,
    appLogger,
  });

  return {
    ok: true,
    pipeline: planned.pipeline,
    handoffPath: written.handoffPath,
    handoffId: written.handoffId,
    handoffFileName: written.fileName,
  };
}

async function advancePipelineAfterComplete(workspacePath, settings = {}, deps = {}) {
  const { streamAIResponse, appLogger, panelWindow } = deps;
  const resolvedPath = String(workspacePath || "").trim();
  const pipelineState = readPipelineState(resolvedPath);
  if (!pipelineState || pipelineState.status !== "active") {
    return { ok: false, error: "No active pipeline." };
  }

  if (settings.codeAgentNativeEnabled === true) {
    const currentPhase = Number(pipelineState.currentPhase) || 1;
    const template = getPipeline(pipelineState.templateId);
    const phaseDef = template?.phases?.find((p) => p.phase === currentPhase);

    let verificationResult = { ok: true, skipped: true };
    if (phaseDef?.verification) {
      verificationResult = await runVerification(resolvedPath, phaseDef.verification);
    }
    if (!verificationResult.ok) {
      const { runPhaseNativeCodeAgent } = require("../../code-agent/code-orchestrator");
      const fixResult = await runPhaseNativeCodeAgent({
        workspacePath: resolvedPath,
        phaseGoal: `Fix verification failure for phase ${currentPhase}: ${verificationResult.error || verificationResult.stderr}`,
        settings,
        deps: { panelWindow },
      });
      return { ok: fixResult.ok, action: "native-fix", verification: verificationResult, codeAgentResult: fixResult };
    }

    if (currentPhase >= pipelineState.totalPhases) {
      pipelineState.status = "completed";
      pipelineState.completedAt = new Date().toISOString();
      writePipelineState(resolvedPath, pipelineState);
      return { ok: true, action: "completed", pipeline: pipelineState, native: true };
    }

    const nextPhase = currentPhase + 1;
    const nextPhaseDef = template.phases.find((p) => p.phase === nextPhase);
    pipelineState.currentPhase = nextPhase;
    writePipelineState(resolvedPath, pipelineState);

    const { runPhaseNativeCodeAgent } = require("../../code-agent/code-orchestrator");
    const codeResult = await runPhaseNativeCodeAgent({
      workspacePath: resolvedPath,
      phaseGoal: nextPhaseDef.goal,
      settings,
      deps: { panelWindow },
    });
    return { ok: codeResult.ok, action: "native-next-phase", pipeline: pipelineState, codeAgentResult: codeResult };
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
    const written = await writePhaseHandoff({
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
      streamAIResponse,
      appLogger,
    });
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

  const written = await writePhaseHandoff({
    pipelineState,
    phaseDef: nextPhaseDef,
    workspacePath: resolvedPath,
    settings,
    parentHandoffId: artifact.handoffId,
    streamAIResponse,
    appLogger,
  });

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
  writePhaseHandoff,
  buildPhaseHandoffOverrides,
};
