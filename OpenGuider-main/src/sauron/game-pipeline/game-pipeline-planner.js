const crypto = require("crypto");
const { getGamePipeline } = require("./game-pipeline-registry");
const { compileGamedevBrief, readGameDesignBrief } = require("../gamedev-prompt-compiler");
const { estimateTokens } = require("../finops/token-counter");

function buildGamePipelineId() {
  return `game-pipeline-${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomUUID().slice(0, 8)}`;
}

async function planGamePipeline(pipelineId, options = {}) {
  const template = getGamePipeline(pipelineId);
  if (!template) {
    return { ok: false, error: `Unknown game pipeline: ${pipelineId}` };
  }

  const taskDescription = String(options.taskDescription || "").trim();
  const masterPrompt = String(options.masterPrompt || taskDescription).trim();
  const workspacePath = String(options.workspacePath || "").trim();
  const settings = options.settings || {};
  const streamAIResponse = options.streamAIResponse || null;

  let phases = template.phases.map((phase) => ({
    ...phase,
    goal: phase.goal,
    estimatedTokens: estimateTokens(phase.goal),
  }));
  let briefMeta = null;

  if (workspacePath && masterPrompt) {
    const compiled = await compileGamedevBrief({
      workspacePath,
      masterPrompt,
      taskText: taskDescription,
      genre: template.genre,
      pipelineId: template.id,
      templatePhases: template.phases,
      settings,
      streamAIResponse,
    });
    if (compiled.ok && Array.isArray(compiled.phases)) {
      phases = compiled.phases;
      briefMeta = {
        briefPointer: compiled.briefPointer,
        briefSummary: compiled.briefSummary,
        compiledBy: compiled.compiledBy,
      };
    }
  } else if (taskDescription) {
    phases = template.phases.map((phase) => {
      const injectPhase = template.id === "unity-empty-v1" ? 3 : 2;
      const goalText = phase.phase >= injectPhase
        ? `${phase.goal} (brief: ${taskDescription.slice(0, 120)})`
        : phase.goal;
      return {
        ...phase,
        goal: goalText.slice(0, 280),
        estimatedTokens: estimateTokens(goalText),
      };
    });
  }

  const totalEstimatedTokens = phases.reduce((sum, p) => sum + (p.estimatedTokens || 0), 0);

  return {
    ok: true,
    pipeline: {
      id: buildGamePipelineId(),
      templateId: template.id,
      label: template.label,
      genre: template.genre,
      templateScaffold: template.templateId,
      projectType: template.projectType,
      taskDescription,
      masterPrompt: masterPrompt.slice(0, 8000),
      briefMeta,
      totalPhases: phases.length,
      currentPhase: 1,
      status: "active",
      phases,
      totalEstimatedTokens,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}

function getPhasesFromPipelineState(pipelineState) {
  if (!pipelineState) {
    return [];
  }
  if (Array.isArray(pipelineState.phases) && pipelineState.phases.length > 0) {
    return pipelineState.phases;
  }
  const template = getGamePipeline(pipelineState.templateId);
  return template?.phases || [];
}

module.exports = {
  buildGamePipelineId,
  planGamePipeline,
  getPhasesFromPipelineState,
};
