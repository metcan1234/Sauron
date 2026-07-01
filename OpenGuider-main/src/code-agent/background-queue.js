const fs = require("fs");
const path = require("path");
const { readSession, writeSession } = require("./code-session-state");
const { runCodeAgentSession } = require("./code-orchestrator");

const queueState = new Map();

function getQueueKey(workspacePath) {
  return String(workspacePath || "").trim();
}

function enqueueBackgroundSession(workspacePath, goal, settings = {}, deps = {}) {
  if (settings.codeAgentBackgroundEnabled !== true) {
    return { ok: false, skipped: true, reason: "background_disabled" };
  }
  const key = getQueueKey(workspacePath);
  if (!key) {
    return { ok: false, error: "Workspace path required." };
  }
  if (queueState.get(key)?.running) {
    return { ok: false, error: "Background session already running." };
  }

  const controller = new AbortController();
  const entry = {
    goal: String(goal || "").trim(),
    running: true,
    startedAt: new Date().toISOString(),
    controller,
  };
  queueState.set(key, entry);

  void runCodeAgentSession({
    workspacePath: key,
    goal: entry.goal,
    settings,
    signal: controller.signal,
    deps,
  }).finally(() => {
    const current = queueState.get(key);
    if (current) {
      current.running = false;
      current.finishedAt = new Date().toISOString();
    }
  });

  return { ok: true, queued: true, workspacePath: key };
}

function cancelBackgroundSession(workspacePath) {
  const key = getQueueKey(workspacePath);
  const entry = queueState.get(key);
  if (!entry) {
    return { ok: false, error: "No background session." };
  }
  entry.controller?.abort();
  entry.running = false;
  return { ok: true };
}

function getBackgroundSessionStatus(workspacePath) {
  const key = getQueueKey(workspacePath);
  const entry = queueState.get(key);
  const session = key ? readSession(key) : null;
  return {
    ok: true,
    queue: entry || null,
    session: session || null,
  };
}

module.exports = {
  enqueueBackgroundSession,
  cancelBackgroundSession,
  getBackgroundSessionStatus,
};
