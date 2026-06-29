const crypto = require("crypto");
const { getPipeline } = require("./pipeline-registry");
const { estimateTokens } = require("../finops/token-counter");

const DEFAULT_PRICE_PER_MILLION_TL = 8;

function buildPipelineId() {
  return `pipeline-${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomUUID().slice(0, 8)}`;
}

function planPipeline(pipelineId, options = {}) {
  const template = getPipeline(pipelineId);
  if (!template) {
    return { ok: false, error: `Unknown pipeline: ${pipelineId}` };
  }

  const taskDescription = String(options.taskDescription || "").trim();
  const costProfile = options.costProfile || "balanced";

  const phases = template.phases.map((phase) => {
    const goalText = taskDescription && phase.phase === 2
      ? `${phase.goal}\n\nUser task: ${taskDescription}`
      : phase.goal;
    const tokens = estimateTokens(goalText);
    const estimatedCostTl = (tokens / 1_000_000) * DEFAULT_PRICE_PER_MILLION_TL * 3;
    return {
      ...phase,
      goal: goalText,
      estimatedTokens: tokens,
      estimatedCostTl: Math.round(estimatedCostTl * 100) / 100,
    };
  });

  const totalEstimatedCostTl = phases.reduce((sum, p) => sum + (p.estimatedCostTl || 0), 0);

  return {
    ok: true,
    pipeline: {
      id: buildPipelineId(),
      templateId: template.id,
      label: template.label,
      projectType: template.projectType,
      costProfile,
      taskDescription,
      totalPhases: phases.length,
      currentPhase: 1,
      status: "active",
      phases,
      totalEstimatedCostTl: Math.round(totalEstimatedCostTl * 100) / 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}

module.exports = {
  buildPipelineId,
  planPipeline,
};
