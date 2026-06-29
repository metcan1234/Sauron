import { t } from "../i18n/index.js";

const ROUTE_LABELS = {
  assistant: "Sohbet (Sauron Core)",
  plan_guide: "Rehber modu",
  micro_guide: "Mikro rehber",
  code_agent: "Yerel kod agent",
  workspace_handoff: "Çalışma Kısmı (Cline)",
  web_studio: "Web Studio",
  self_build: "Üretim hattı",
};

function inferPlanSummary(text) {
  const raw = String(text || "").trim();
  if (!raw) {
    return t("agentTraceDefaultPlan");
  }
  if (/\b(kurumsal\s+site|web\s+studio)\b/i.test(raw)) {
    return "Kurumsal site görevini planlıyorum — Web Studio veya handoff kanalına yönlendireceğim.";
  }
  if (/\b(üretim\s+hattı|self[- ]?build|pipeline)\b/i.test(raw)) {
    return "Üretim hattı görevini planlıyorum — fazlar halinde ilerleyeceğiz.";
  }
  if (/\b(workspace|çalışma\s+kısmı|handoff|cline|kod\s+yaz|projede)\b/i.test(raw)) {
    return "Çalışma Kısmı görevini planlıyorum — VS Code + Cline tarafında işlenecek.";
  }
  if (/\b(ekran|yardım\s+et|rehber|tıkla)\b/i.test(raw)) {
    return "Ekran rehberliği görevini planlıyorum — adım adım yönlendireceğim.";
  }
  const short = raw.length > 96 ? `${raw.slice(0, 93)}…` : raw;
  return t("agentTraceUserGoal", { goal: short });
}

export function isAgentTraceEnabled(settings = {}) {
  return settings.clineActivityFeedEnabled !== false;
}

export function createAgentTraceController({ ui, getSettings }) {
  let activeTrace = null;
  let thoughtStartedAt = 0;

  function enabled() {
    return isAgentTraceEnabled(typeof getSettings === "function" ? getSettings() : {});
  }

  function finalizeThought() {
    if (!activeTrace?.thoughtEl || !thoughtStartedAt) {
      return;
    }
    const seconds = Math.max(1, Math.round((Date.now() - thoughtStartedAt) / 1000));
    activeTrace.thoughtEl.textContent = t("agentTraceThought", { seconds });
  }

  function startTrace(userText) {
    if (!enabled() || !ui.beginAgentTrace) {
      return null;
    }
    if (activeTrace?.shell?.isConnected) {
      ui.setAgentTracePlan(activeTrace, inferPlanSummary(userText));
      return activeTrace;
    }
    thoughtStartedAt = Date.now();
    activeTrace = ui.beginAgentTrace();
    if (!activeTrace) {
      return null;
    }
    ui.setAgentTracePlan(activeTrace, inferPlanSummary(userText));
    return activeTrace;
  }

  function addTodo(text, done = false) {
    if (!activeTrace) {
      return;
    }
    finalizeThought();
    ui.appendAgentTraceTodo(activeTrace, text, done);
  }

  function addStep(label, detail = "", { indent = false } = {}) {
    if (!activeTrace) {
      return;
    }
    finalizeThought();
    ui.appendAgentTraceStep(activeTrace, label, detail, { indent });
  }

  function addQuestion(text) {
    if (!enabled()) {
      return;
    }
    finalizeThought();
    if (activeTrace) {
      ui.appendAgentTraceQuestion(activeTrace, text);
    } else if (ui.appendClineFeedMessage) {
      ui.appendClineFeedMessage({
        kind: "question",
        title: t("clineFeedQuestion"),
        body: text,
        eventId: `question-${Date.now()}`,
      });
    }
  }

  function addReport(text) {
    if (!enabled()) {
      return;
    }
    finalizeThought();
    if (ui.appendClineFeedMessage) {
      ui.appendClineFeedMessage({
        kind: "report",
        title: t("clineFeedReport"),
        body: text,
        eventId: `report-${Date.now()}`,
      });
    }
  }

  function addRouteStep(route) {
    const label = ROUTE_LABELS[route] || route;
    addStep(t("agentTraceRouting"), label, { indent: true });
  }

  function endTrace() {
    finalizeThought();
    activeTrace = null;
    thoughtStartedAt = 0;
  }

  return {
    startTrace,
    addTodo,
    addStep,
    addQuestion,
    addReport,
    addRouteStep,
    endTrace,
    enabled,
  };
}
