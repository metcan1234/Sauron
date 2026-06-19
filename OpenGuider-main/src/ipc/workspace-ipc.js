const fs = require("fs");

function registerWorkspaceIpc({
  ipcMain,
  dialog,
  shell,
  store,
  sessionManager,
  panelWindow,
  settingsWindow,
  debugLog,
  appLogger,
  getRuntimeSettings,
  persistActiveSession,
  getActiveChatSessionTitle,
  checkWorkspacePrerequisites,
  installWorkspaceStack,
  getHandoffStatus,
  focusVSCodeWorkspace,
  listPendingHandoffs,
  rejectPendingHandoffs,
  buildHandoffPayload,
  bootstrapWorkspace,
  writeHandoff,
  launchVSCode,
}) {
  ipcMain.handle("pick-workspace-folder", async () => {
    debugLog("ipc:pick-workspace-folder");
    const parentWindow = panelWindow && !panelWindow.isDestroyed()
      ? panelWindow
      : (settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : null);
    const result = await dialog.showOpenDialog(parentWindow, {
      properties: ["openDirectory"],
      title: "Select Workspace Folder",
    });
    if (result.canceled || !result.filePaths?.[0]) {
      return { ok: false, canceled: true };
    }
    const selectedPath = result.filePaths[0];
    store.set("workspacePath", selectedPath);
    return { ok: true, path: selectedPath };
  });

  ipcMain.handle("install-workspace-stack", async (_event, options = {}) => {
    debugLog("ipc:install-workspace-stack", options);
    try {
      const result = installWorkspaceStack({ force: Boolean(options?.force) });
      const prerequisites = checkWorkspacePrerequisites();
      return { ...result, prerequisites };
    } catch (error) {
      return {
        ok: false,
        error: error?.message || "Workspace stack installation failed.",
      };
    }
  });

  ipcMain.handle("check-workspace-prerequisites", () => {
    debugLog("ipc:check-workspace-prerequisites");
    try {
      return { ok: true, ...checkWorkspacePrerequisites() };
    } catch (error) {
      return {
        ok: false,
        error: error?.message || "Workspace prerequisite check failed.",
      };
    }
  });

  ipcMain.handle("get-handoff-status", (_event, { workspacePath, handoffFileName } = {}) => {
    const resolvedPath = String(workspacePath || store.get("workspacePath") || "").trim();
    if (!resolvedPath || !handoffFileName) {
      return { ok: false, error: "Missing workspace path or handoff file name." };
    }
    return {
      ok: true,
      workspacePath: resolvedPath,
      ...getHandoffStatus(resolvedPath, handoffFileName),
    };
  });

  ipcMain.handle("focus-workspace-vscode", async () => {
    debugLog("ipc:focus-workspace-vscode");
    try {
      const workspacePath = String(store.get("workspacePath") || "").trim();
      if (!workspacePath || !fs.existsSync(workspacePath)) {
        return { ok: false, error: "Workspace path is not configured or missing." };
      }
      await focusVSCodeWorkspace(workspacePath);
      return { ok: true, workspacePath };
    } catch (error) {
      return { ok: false, error: error?.message || "Failed to focus VS Code." };
    }
  });

  ipcMain.handle("open-workspace-handoff", async (_event, options = {}) => {
    debugLog("ipc:open-workspace-handoff", options);
    try {
      const force = Boolean(options?.force);
      let workspacePath = String(store.get("workspacePath") || "").trim();

      if (!workspacePath) {
        const parentWindow = panelWindow && !panelWindow.isDestroyed() ? panelWindow : null;
        const pickResult = await dialog.showOpenDialog(parentWindow, {
          properties: ["openDirectory"],
          title: "Select Workspace Folder for Çalışma Kısmı",
        });
        if (pickResult.canceled || !pickResult.filePaths?.[0]) {
          return { ok: false, error: "Workspace folder not selected." };
        }
        workspacePath = pickResult.filePaths[0];
        store.set("workspacePath", workspacePath);
      }

      if (!fs.existsSync(workspacePath)) {
        return { ok: false, error: `Workspace path does not exist: ${workspacePath}` };
      }

      let prerequisites = checkWorkspacePrerequisites();
      if (!prerequisites.canOpenWorkspace) {
        return {
          ok: false,
          error: "VS Code CLI (code) bulunamadı. Kurulum adımları için uyarıyı kontrol edin.",
          prerequisites,
        };
      }

      if (!prerequisites.bridgeExtension) {
        const installResult = installWorkspaceStack();
        if (!installResult.ok) {
          return {
            ok: false,
            error: installResult.error || "Sauron Bridge kurulamadı.",
            prerequisites: checkWorkspacePrerequisites(),
          };
        }
        prerequisites = checkWorkspacePrerequisites();
      }

      const pending = listPendingHandoffs(workspacePath);
      if (!force && pending.length > 0) {
        return {
          ok: false,
          needsConfirm: true,
          pendingCount: pending.length,
          message: "Önceki görev henüz VS Code tarafında işlenmedi. Yine de devam edilsin mi?",
        };
      }

      if (force && pending.length > 0) {
        rejectPendingHandoffs(workspacePath);
      }

      const snapshot = sessionManager ? sessionManager.getSnapshot() : {};
      persistActiveSession(store, snapshot);
      const runtimeSettings = await getRuntimeSettings();
      const enrichedSnapshot = {
        ...snapshot,
        chatSessionTitle: getActiveChatSessionTitle(store),
      };
      const payload = buildHandoffPayload(enrichedSnapshot, workspacePath, undefined, runtimeSettings);
      await bootstrapWorkspace(workspacePath, runtimeSettings);
      const written = writeHandoff(workspacePath, payload);
      const launchResult = await launchVSCode(workspacePath, { newWindow: true });

      return {
        ok: true,
        workspacePath,
        handoffPath: written.handoffPath,
        handoffId: written.handoffId,
        handoffFileName: written.fileName,
        launchResult,
        prerequisites,
        setupWarnings: prerequisites.warnings,
      };
    } catch (error) {
      appLogger.error("open-workspace-handoff failed", { error: error?.message || error });
      return {
        ok: false,
        error: error?.message || "Failed to open workspace.",
      };
    }
  });

  ipcMain.handle("open-external-link", async (_event, url) => {
    const target = String(url || "").trim();
    if (!/^https?:\/\//i.test(target)) {
      throw new Error("Invalid URL");
    }
    await shell.openExternal(target);
    return true;
  });
}

module.exports = { registerWorkspaceIpc };
