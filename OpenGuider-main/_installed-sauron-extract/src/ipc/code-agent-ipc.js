const fs = require("fs");
const path = require("path");
const {
  runCodeAgentSession,
  getCodeAgentStatus,
  cancelCodeAgentSession,
  resolveApproval,
} = require("../code-agent/code-orchestrator");
const { buildCodeIndex, getIndexStatus } = require("../code-agent/codebase-indexer");
const { detectCodeIntent } = require("../code-agent/detect-code-intent");
const { listFilesRecursive, resolveSafePath } = require("../code-agent/workspace-sandbox");

function registerCodeAgentIpc({
  ipcMain,
  debugLog,
  appLogger,
  getRuntimeSettings,
  panelWindow,
  store,
  currentAIControllerRef,
}) {
  function resolveWorkspacePath(workspacePath) {
    const fromArg = String(workspacePath || "").trim();
    if (fromArg) {
      return fromArg;
    }
    return String(store.get("workspacePath") || "").trim();
  }

  ipcMain.handle("detect-code-intent", (_event, { text } = {}) => {
    debugLog("ipc:detect-code-intent");
    return detectCodeIntent(String(text || ""));
  });

  ipcMain.handle("start-code-agent-session", async (_event, { goal, workspacePath } = {}) => {
    debugLog("ipc:start-code-agent-session");
    const resolved = resolveWorkspacePath(workspacePath);
    if (!resolved) {
      return { ok: false, error: "Workspace path is not configured." };
    }
    if (currentAIControllerRef?.current) {
      currentAIControllerRef.current.abort();
    }
    const controller = new AbortController();
    if (currentAIControllerRef) {
      currentAIControllerRef.current = controller;
    }
    try {
      const settings = await getRuntimeSettings();
      const result = await runCodeAgentSession({
        workspacePath: resolved,
        goal: String(goal || "").trim(),
        settings,
        signal: controller.signal,
        deps: { panelWindow },
      });
      return result;
    } catch (error) {
      appLogger.error("start-code-agent-session failed", { error: error?.message || error });
      return { ok: false, error: error?.message || "Code agent failed." };
    } finally {
      if (currentAIControllerRef) {
        currentAIControllerRef.current = null;
      }
    }
  });

  ipcMain.handle("get-code-agent-status", (_event, { workspacePath } = {}) => {
    const resolved = resolveWorkspacePath(workspacePath);
    if (!resolved) {
      return { ok: false, error: "Workspace path is not configured." };
    }
    return getCodeAgentStatus(resolved);
  });

  ipcMain.handle("code-agent-cancel", (_event, { workspacePath } = {}) => {
    const resolved = resolveWorkspacePath(workspacePath);
    if (!resolved) {
      return { ok: false, error: "Workspace path is not configured." };
    }
    if (currentAIControllerRef?.current) {
      currentAIControllerRef.current.abort();
    }
    return cancelCodeAgentSession(resolved);
  });

  ipcMain.handle("code-agent-approve-change", (_event, { sessionId } = {}) => {
    const ok = resolveApproval(String(sessionId || ""), true);
    return { ok };
  });

  ipcMain.handle("code-agent-reject-change", (_event, { sessionId } = {}) => {
    const ok = resolveApproval(String(sessionId || ""), false);
    return { ok };
  });

  ipcMain.handle("index-workspace-code", async (_event, { workspacePath } = {}) => {
    const resolved = resolveWorkspacePath(workspacePath);
    if (!resolved) {
      return { ok: false, error: "Workspace path is not configured." };
    }
    try {
      return await buildCodeIndex(resolved);
    } catch (error) {
      return { ok: false, error: error?.message || "Index build failed." };
    }
  });

  ipcMain.handle("get-code-index-status", (_event, { workspacePath } = {}) => {
    const resolved = resolveWorkspacePath(workspacePath);
    if (!resolved) {
      return { ok: false, error: "Workspace path is not configured." };
    }
    return getIndexStatus(resolved);
  });

  ipcMain.handle("list-workspace-files", (_event, { workspacePath, maxDepth } = {}) => {
    const resolved = resolveWorkspacePath(workspacePath);
    if (!resolved) {
      return { ok: false, error: "Workspace path is not configured." };
    }
    try {
      const files = listFilesRecursive(resolved, { maxDepth: maxDepth || 5, maxFiles: 400 });
      return { ok: true, files };
    } catch (error) {
      return { ok: false, error: error?.message || "List failed." };
    }
  });

  ipcMain.handle("read-workspace-file", (_event, { workspacePath, filePath } = {}) => {
    const resolved = resolveWorkspacePath(workspacePath);
    if (!resolved || !filePath) {
      return { ok: false, error: "Workspace path and file path required." };
    }
    try {
      const full = resolveSafePath(resolved, filePath);
      const content = fs.readFileSync(full, "utf8");
      return { ok: true, path: filePath, content };
    } catch (error) {
      return { ok: false, error: error?.message || "Read failed." };
    }
  });
}

module.exports = { registerCodeAgentIpc };
