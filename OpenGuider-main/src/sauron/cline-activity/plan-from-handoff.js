function basenameOnly(filePath) {
  const parts = String(filePath || "").split(/[/\\]/);
  return parts[parts.length - 1] || filePath;
}

function buildPlanFromHandoff(handoff = {}) {
  const goal = String(
    handoff.goal
    || handoff.taskSummary
    || handoff.userIntent
    || "",
  ).trim();

  if (!goal) {
    return { title: "Cline görevi", body: "" };
  }

  const steps = [];
  let stepIndex = 1;

  if (Array.isArray(handoff.relevantFiles) && handoff.relevantFiles.length) {
    const files = handoff.relevantFiles.slice(0, 4).map(basenameOnly).join(", ");
    steps.push(`${stepIndex}. İlgili dosyaları incele (${files})`);
    stepIndex += 1;
  }

  if (handoff.pipelineId && handoff.pipelinePhase) {
    const total = handoff.pipelineTotalPhases ? ` / ${handoff.pipelineTotalPhases}` : "";
    const label = handoff.pipelineLabel || handoff.pipelineId;
    steps.push(`${stepIndex}. Üretim hattı faz ${handoff.pipelinePhase}${total} — ${label}`);
    stepIndex += 1;
  } else if (handoff.projectType) {
    steps.push(`${stepIndex}. Proje türü: ${handoff.projectType}`);
    stepIndex += 1;
  }

  if (Array.isArray(handoff.batchScope) && handoff.batchScope.length) {
    const scope = handoff.batchScope.slice(0, 4).join(", ");
    steps.push(`${stepIndex}. Kapsam: ${scope}`);
    stepIndex += 1;
  }

  if (handoff.verification?.command) {
    steps.push(`${stepIndex}. Bitince doğrula: ${handoff.verification.command}`);
  } else {
    steps.push(`${stepIndex}. Görevi tamamla ve sonucu raporla`);
  }

  const body = [
    `Hedef: ${goal}`,
    "",
    "Adımlar:",
    ...steps,
  ].join("\n");

  return {
    title: goal.length > 72 ? `${goal.slice(0, 69)}…` : goal,
    body,
  };
}

module.exports = {
  basenameOnly,
  buildPlanFromHandoff,
};
