const crypto = require("crypto");
const { getGamePipeline } = require("./game-pipeline-registry");

function buildGamePipelineId() {
  return `game-pipeline-${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomUUID().slice(0, 8)}`;
}

function planGamePipeline(pipelineId, options = {}) {
  const template = getGamePipeline(pipelineId);
  if (!template) {
    return { ok: false, error: `Unknown game pipeline: ${pipelineId}` };
  }

  const taskDescription = String(options.taskDescription || "").trim();

  const phases = template.phases.map((phase) => {
    const goalText = taskDescription && phase.phase === 3 && template.id === "unity-empty-v1"
      ? `${phase.goal}\n\nUser task: ${taskDescription.slice(0, 200)}`
      : phase.goal;
    return {
      ...phase,
      goal: goalText.slice(0, 280),
    };
  });

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
      totalPhases: phases.length,
      currentPhase: 1,
      status: "active",
      phases,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}

module.exports = {
  buildGamePipelineId,
  planGamePipeline,
};
