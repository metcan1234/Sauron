const { EventEmitter } = require("events");

const {
  cloneBrowserExecution,
  cloneStep,
  createEmptySession,
  getCurrentStep,
  normalizeBrowserExecution,
  normalizeBrowserExecutionSubstep,
  normalizePlan,
} = require("./session-schema");
const { MICRO_GUIDE_MAX_TURNS } = require("../agent/micro-guide/micro-guide-constants");

class SessionManager extends EventEmitter {
  constructor() {
    super();
    this.session = createEmptySession();
  }

  getSession() {
    return this.session;
  }

  getSnapshot() {
    const session = this.session;
    return {
      sessionId: session.sessionId,
      messages: session.messages.slice(),
      goalIntent: session.goalIntent || "",
      activePlan: session.activePlan
        ? {
            ...session.activePlan,
            steps: session.activePlan.steps.map((step, index) => cloneStep(step, index)),
          }
        : null,
      browserExecution: session.browserExecution
        ? cloneBrowserExecution(session.browserExecution)
        : null,
      currentStepId: session.currentStepId,
      manualConfirmation: session.manualConfirmation,
      lastScreenshots: session.lastScreenshots.slice(),
      evaluationHistory: session.evaluationHistory.slice(),
      status: session.status,
      lastPointer: session.lastPointer,
      microGuideSession: session.microGuideSession
        ? { ...session.microGuideSession }
        : null,
      updatedAt: session.updatedAt,
    };
  }

  emitUpdate() {
    this.session.updatedAt = new Date().toISOString();
    this.emit("updated", this.getSnapshot());
  }

  setStatus(status) {
    this.session.status = status;
    this.emitUpdate();
  }

  setGoalIntent(goalIntent) {
    this.session.goalIntent = String(goalIntent || "").trim();
    this.emitUpdate();
  }

  addMessage(message) {
    if (!message || !message.role || !message.content) {
      return;
    }

    this.session.messages.push({
      role: message.role,
      content: String(message.content),
      createdAt: message.createdAt || new Date().toISOString(),
    });

    this.emitUpdate();
  }

  removeLastAssistantMessage() {
    for (let index = this.session.messages.length - 1; index >= 0; index -= 1) {
      if (this.session.messages[index]?.role === "assistant") {
        this.session.messages.splice(index, 1);
        this.emitUpdate();
        return true;
      }
    }
    return false;
  }

  applyMemoryCompression({ summaryText, removeCount }) {
    const trimmedSummary = String(summaryText || "").trim();
    const count = Number(removeCount);
    if (!trimmedSummary || !Number.isFinite(count) || count <= 0) {
      return false;
    }

    const messages = this.session.messages;
    const existingSummary = messages.find((entry) => entry.role === "memory-summary");
    const mergedSummary = existingSummary?.content
      ? `${trimmedSummary}\n\n${String(existingSummary.content).trim()}`.trim()
      : trimmedSummary;

    const nextMessages = [{
      role: "memory-summary",
      content: mergedSummary,
      createdAt: new Date().toISOString(),
    }];

    let remaining = count;
    for (const entry of messages) {
      if (entry?.role === "memory-summary") {
        continue;
      }
      if ((entry?.role === "user" || entry?.role === "assistant") && remaining > 0) {
        remaining -= 1;
        continue;
      }
      nextMessages.push({
        role: entry.role,
        content: String(entry.content || ""),
        createdAt: entry.createdAt || new Date().toISOString(),
      });
    }

    if (remaining > 0) {
      return false;
    }

    this.session.messages = nextMessages;
    this.emitUpdate();
    return true;
  }

  trimMessages(maxCount) {
    const limit = Number(maxCount);
    if (!Number.isFinite(limit) || limit <= 0) {
      return;
    }
    if (this.session.messages.length > limit) {
      this.session.messages = this.session.messages.slice(-limit);
      this.emitUpdate();
    }
  }

  updateMessage(index, content) {
    const targetIndex = Number(index);
    const message = this.session.messages[targetIndex];
    if (!message || !content) {
      return false;
    }
    message.content = String(content);
    this.emitUpdate();
    return true;
  }

  deleteMessage(index) {
    const targetIndex = Number(index);
    if (targetIndex < 0 || targetIndex >= this.session.messages.length) {
      return false;
    }
    this.session.messages.splice(targetIndex, 1);
    this.emitUpdate();
    return true;
  }

  truncateAfter(index) {
    const targetIndex = Number(index);
    if (targetIndex < 0 || targetIndex >= this.session.messages.length) {
      return false;
    }
    this.session.messages = this.session.messages.slice(0, targetIndex + 1);
    this.emitUpdate();
    return true;
  }

  setMessages(messages) {
    this.session.messages = Array.isArray(messages) ? messages.slice() : [];
    this.emitUpdate();
  }

  setLastScreenshots(screenshots) {
    this.session.lastScreenshots = Array.isArray(screenshots) ? screenshots.slice() : [];
    this.emitUpdate();
  }

  setActivePlan(plan) {
    this.session.activePlan = plan ? normalizePlan(plan) : null;
    this.session.currentStepId = getCurrentStep(this.session.activePlan)?.id || null;
    this.session.manualConfirmation = null;
    this.emitUpdate();
  }

  startBrowserExecution(execution) {
    this.session.browserExecution = normalizeBrowserExecution(execution);
    this.emitUpdate();
    return this.session.browserExecution;
  }

  upsertBrowserExecutionSubstepStart(substep) {
    if (!this.session.browserExecution) {
      return null;
    }

    const nextSubstep = normalizeBrowserExecutionSubstep({
      ...substep,
      status: "running",
      finishedAt: null,
    });
    const matchIndex = this.session.browserExecution.substeps.findIndex((entry) => (
      (nextSubstep.id && entry.id === nextSubstep.id) ||
      String(entry.stepNumber) === String(nextSubstep.stepNumber)
    ));

    if (matchIndex >= 0) {
      this.session.browserExecution.substeps[matchIndex] = {
        ...this.session.browserExecution.substeps[matchIndex],
        ...nextSubstep,
        status: "running",
        finishedAt: null,
      };
    } else {
      this.session.browserExecution.substeps.push(nextSubstep);
    }

    this.emitUpdate();
    return nextSubstep;
  }

  upsertBrowserExecutionSubstepEnd(substep) {
    if (!this.session.browserExecution) {
      return null;
    }

    const nextStatus = substep?.status === "failed" ? "failed" : "done";
    const nextSubstep = normalizeBrowserExecutionSubstep({
      ...substep,
      status: nextStatus,
      finishedAt: substep?.finishedAt || new Date().toISOString(),
    });
    const matchIndex = this.session.browserExecution.substeps.findIndex((entry) => (
      (nextSubstep.id && entry.id === nextSubstep.id) ||
      String(entry.stepNumber) === String(nextSubstep.stepNumber)
    ));

    if (matchIndex >= 0) {
      this.session.browserExecution.substeps[matchIndex] = {
        ...this.session.browserExecution.substeps[matchIndex],
        ...nextSubstep,
        status: nextStatus,
      };
    } else {
      this.session.browserExecution.substeps.push(nextSubstep);
    }

    this.emitUpdate();
    return nextSubstep;
  }

  finishBrowserExecution({ status, finalMessage, finishedAt } = {}) {
    if (!this.session.browserExecution) {
      return null;
    }

    this.session.browserExecution = {
      ...this.session.browserExecution,
      status: status || this.session.browserExecution.status || "success",
      finalMessage: finalMessage || "",
      finishedAt: finishedAt || new Date().toISOString(),
    };
    this.emitUpdate();
    return this.session.browserExecution;
  }

  emitBrowserExecutionSubstepProgress(progress) {
    this.emit("browser-execution-substep-progress", progress || null);
  }

  clearBrowserExecution() {
    this.session.browserExecution = null;
    this.emitUpdate();
  }

  updateActivePlan(mutator) {
    if (!this.session.activePlan || typeof mutator !== "function") {
      return this.session.activePlan;
    }

    const nextPlan = normalizePlan(mutator(this.getSnapshot().activePlan) || this.session.activePlan);
    this.session.activePlan = nextPlan;
    this.session.currentStepId = getCurrentStep(nextPlan)?.id || null;
    this.emitUpdate();
    return nextPlan;
  }

  setCurrentPointer(pointer) {
    this.session.lastPointer = pointer || null;

    if (this.session.activePlan) {
      const currentStep = getCurrentStep(this.session.activePlan);
      if (currentStep) {
        currentStep.coordinate = pointer?.coordinate || null;
        currentStep.label = pointer?.label || null;
        currentStep.explanation = pointer?.explanation || "";
      }
    }

    this.emitUpdate();
  }

  setManualConfirmation(manualConfirmation) {
    this.session.manualConfirmation = manualConfirmation || null;
    this.emitUpdate();
  }

  appendEvaluation(evaluation) {
    if (!evaluation) {
      return;
    }

    this.session.evaluationHistory.push({
      ...evaluation,
      createdAt: evaluation.createdAt || new Date().toISOString(),
    });
    this.emitUpdate();
  }

  completeCurrentStep() {
    if (!this.session.activePlan) {
      return null;
    }

    const plan = this.session.activePlan;
    const currentStep = getCurrentStep(plan);
    if (!currentStep) {
      return null;
    }

    currentStep.status = "completed";

    const nextIndex = plan.currentStepIndex + 1;
    if (nextIndex < plan.steps.length) {
      plan.currentStepIndex = nextIndex;
      plan.steps[nextIndex].status = "active";
      plan.status = "active";
      this.session.currentStepId = plan.steps[nextIndex].id;
    } else {
      plan.status = "completed";
      this.session.currentStepId = null;
    }

    this.session.manualConfirmation = null;
    plan.updatedAt = new Date().toISOString();
    this.emitUpdate();
    return plan;
  }

  clearSession() {
    this.session = createEmptySession();
    this.emitUpdate();
  }

  getMicroGuideSession() {
    return this.session.microGuideSession;
  }

  startMicroGuideSession({ goal, maxTurns = MICRO_GUIDE_MAX_TURNS } = {}) {
    const now = new Date().toISOString();
    this.session.microGuideSession = {
      active: true,
      goal: String(goal || "").trim(),
      turnCount: 0,
      maxTurns: Number.isFinite(maxTurns) && maxTurns > 0 ? maxTurns : MICRO_GUIDE_MAX_TURNS,
      lastInstruction: "",
      lastActivityAt: now,
      status: "thinking",
    };
    this.emitUpdate();
    return this.session.microGuideSession;
  }

  clearMicroGuideSession() {
    this.session.microGuideSession = null;
    this.emitUpdate();
  }

  incrementMicroGuideTurn() {
    if (!this.session.microGuideSession?.active) {
      return null;
    }
    this.session.microGuideSession.turnCount += 1;
    this.emitUpdate();
    return this.session.microGuideSession.turnCount;
  }

  resetMicroGuideTurnCount() {
    if (!this.session.microGuideSession?.active) {
      return null;
    }
    this.session.microGuideSession.turnCount = 0;
    this.emitUpdate();
    return 0;
  }

  touchMicroGuideActivity() {
    if (!this.session.microGuideSession?.active) {
      return;
    }
    this.session.microGuideSession.lastActivityAt = new Date().toISOString();
    this.emitUpdate();
  }

  setMicroGuideStatus(status) {
    if (!this.session.microGuideSession?.active) {
      return;
    }
    this.session.microGuideSession.status = status;
    this.emitUpdate();
  }

  setMicroGuideLastInstruction(instruction) {
    if (!this.session.microGuideSession?.active) {
      return;
    }
    this.session.microGuideSession.lastInstruction = String(instruction || "").trim();
    this.emitUpdate();
  }

  hydrateSession(snapshot) {
    if (!snapshot || typeof snapshot !== "object") {
      this.session = createEmptySession();
      this.emitUpdate();
      return;
    }

    const baseSession = createEmptySession();
    this.session = {
      ...baseSession,
      sessionId: snapshot.sessionId || baseSession.sessionId,
      messages: Array.isArray(snapshot.messages) ? snapshot.messages.slice() : [],
      goalIntent: snapshot.goalIntent || "",
      activePlan: snapshot.activePlan ? normalizePlan(snapshot.activePlan) : null,
      browserExecution: snapshot.browserExecution ? normalizeBrowserExecution(snapshot.browserExecution) : null,
      currentStepId: snapshot.currentStepId || null,
      manualConfirmation: snapshot.manualConfirmation || null,
      lastScreenshots: Array.isArray(snapshot.lastScreenshots) ? snapshot.lastScreenshots.slice() : [],
      evaluationHistory: Array.isArray(snapshot.evaluationHistory) ? snapshot.evaluationHistory.slice() : [],
      status: snapshot.status || "idle",
      lastPointer: snapshot.lastPointer || null,
      microGuideSession: snapshot.microGuideSession
        ? { ...snapshot.microGuideSession }
        : null,
      updatedAt: snapshot.updatedAt || new Date().toISOString(),
    };
    this.emitUpdate();
  }

  goToPreviousStep() {
    if (!this.session.activePlan) {
      return null;
    }

    const plan = this.session.activePlan;
    if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
      return null;
    }

    const previousIndex = Math.max(0, plan.currentStepIndex - 1);
    plan.currentStepIndex = previousIndex;
    plan.steps.forEach((step, index) => {
      if (index < previousIndex) {
        step.status = "completed";
      } else if (index === previousIndex) {
        step.status = "active";
      } else {
        step.status = "pending";
      }
    });

    plan.status = "active";
    this.session.currentStepId = plan.steps[previousIndex]?.id || null;
    this.session.manualConfirmation = null;
    plan.updatedAt = new Date().toISOString();
    this.emitUpdate();
    return plan;
  }
}

module.exports = {
  SessionManager,
};
