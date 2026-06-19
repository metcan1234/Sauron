const fs = require("fs");
const path = require("path");

function registerChatSessionsIpc({
  ipcMain,
  dialog,
  store,
  sessionManager,
  taskOrchestrator,
  hideCursorOverlay,
  debugLog,
  broadcastSessionSnapshot,
  persistActiveSession,
  panelWindow,
  createChatFolder,
  createEphemeralChatSession,
  createNewChatSession,
  deleteChatFolder,
  deleteChatSession,
  duplicateChatSession,
  exportAllSessionsJson,
  formatChatExportMarkdown,
  getChatSessionById,
  importChatSessionsFromJson,
  listChatFolders,
  listChatSessionSummaries,
  loadChatSession,
  moveChatSession,
  renameChatFolder,
  renameChatSession,
  sanitizeExportFilename,
  toggleChatSessionPin,
}) {
  ipcMain.handle("get-active-session", () => {
    debugLog("ipc:get-active-session");
    return sessionManager.getSnapshot();
  });

  ipcMain.handle("reset-session", () => {
    debugLog("ipc:reset-session");
    hideCursorOverlay();
    const result = taskOrchestrator.resetSession();
    persistActiveSession(store, sessionManager.getSnapshot());
    return result;
  });

  ipcMain.handle("list-chat-sessions", (_event, { query } = {}) => {
    debugLog("ipc:list-chat-sessions", { query: query || "" });
    return {
      ok: true,
      activeSessionId: store.get("chatSessionsV1")?.activeSessionId || null,
      folders: listChatFolders(store),
      sessions: listChatSessionSummaries(store, { query }),
    };
  });

  ipcMain.handle("create-chat-session", () => {
    debugLog("ipc:create-chat-session");
    const created = createNewChatSession(store, sessionManager);
    const snapshot = sessionManager.getSnapshot();
    broadcastSessionSnapshot(snapshot);
    return { ok: true, ...created, snapshot };
  });

  ipcMain.handle("create-ephemeral-chat-session", () => {
    debugLog("ipc:create-ephemeral-chat-session");
    const created = createEphemeralChatSession(store, sessionManager);
    const snapshot = sessionManager.getSnapshot();
    broadcastSessionSnapshot(snapshot);
    return { ok: true, ...created, snapshot };
  });

  ipcMain.handle("remove-last-assistant-message", () => {
    debugLog("ipc:remove-last-assistant-message");
    const removed = sessionManager.removeLastAssistantMessage();
    persistActiveSession(store, sessionManager.getSnapshot());
    const snapshot = sessionManager.getSnapshot();
    broadcastSessionSnapshot(snapshot);
    return { ok: removed, snapshot };
  });

  ipcMain.handle("edit-chat-message", (_event, { index, content } = {}) => {
    debugLog("ipc:edit-chat-message", { index, contentLength: content?.length || 0 });
    const updated = sessionManager.updateMessage(index, content);
    if (!updated) {
      return { ok: false, error: "Mesaj güncellenemedi." };
    }
    sessionManager.truncateAfter(index);
    persistActiveSession(store, sessionManager.getSnapshot());
    const snapshot = sessionManager.getSnapshot();
    broadcastSessionSnapshot(snapshot);
    return { ok: true, snapshot };
  });

  ipcMain.handle("delete-chat-message", (_event, { index } = {}) => {
    debugLog("ipc:delete-chat-message", { index });
    const removed = sessionManager.deleteMessage(index);
    if (!removed) {
      return { ok: false, error: "Mesaj silinemedi." };
    }
    persistActiveSession(store, sessionManager.getSnapshot());
    const snapshot = sessionManager.getSnapshot();
    broadcastSessionSnapshot(snapshot);
    return { ok: true, snapshot };
  });

  ipcMain.handle("create-chat-folder", (_event, { name } = {}) => {
    return createChatFolder(store, name);
  });

  ipcMain.handle("rename-chat-folder", (_event, { folderId, name } = {}) => {
    return renameChatFolder(store, folderId, name);
  });

  ipcMain.handle("delete-chat-folder", (_event, { folderId } = {}) => {
    return deleteChatFolder(store, folderId);
  });

  ipcMain.handle("move-chat-session", (_event, { sessionId, folderId } = {}) => {
    return moveChatSession(store, sessionId, folderId);
  });

  ipcMain.handle("load-chat-session", (_event, { sessionId } = {}) => {
    debugLog("ipc:load-chat-session", { sessionId });
    const loaded = loadChatSession(store, sessionManager, sessionId);
    if (!loaded.ok) {
      return loaded;
    }
    broadcastSessionSnapshot(loaded.snapshot);
    return loaded;
  });

  ipcMain.handle("delete-chat-session", (_event, { sessionId } = {}) => {
    debugLog("ipc:delete-chat-session", { sessionId });
    const deleted = deleteChatSession(store, sessionManager, sessionId);
    if (deleted.ok && deleted.snapshot) {
      broadcastSessionSnapshot(deleted.snapshot);
    }
    return deleted;
  });

  ipcMain.handle("toggle-pin-chat-session", (_event, { sessionId } = {}) => {
    debugLog("ipc:toggle-pin-chat-session", { sessionId });
    return toggleChatSessionPin(store, sessionId);
  });

  ipcMain.handle("rename-chat-session", (_event, { sessionId, title } = {}) => {
    debugLog("ipc:rename-chat-session", { sessionId });
    return renameChatSession(store, sessionId, title);
  });

  ipcMain.handle("duplicate-chat-session", (_event, { sessionId } = {}) => {
    debugLog("ipc:duplicate-chat-session", { sessionId });
    const duplicated = duplicateChatSession(store, sessionManager, sessionId);
    if (duplicated.ok && duplicated.snapshot) {
      broadcastSessionSnapshot(duplicated.snapshot);
    }
    return duplicated;
  });

  ipcMain.handle("export-chat-session", async (_event, { sessionId } = {}) => {
    debugLog("ipc:export-chat-session", { sessionId });
    try {
      const session = getChatSessionById(store, sessionId);
      if (!session) {
        return { ok: false, error: "Chat session not found." };
      }
      if (session.ephemeral) {
        return { ok: false, error: "Geçici sohbetler dışa aktarılamaz." };
      }

      const markdown = formatChatExportMarkdown(session);
      const parentWindow = panelWindow && !panelWindow.isDestroyed() ? panelWindow : null;
      const saveResult = await dialog.showSaveDialog(parentWindow, {
        title: "Sohbeti dışa aktar",
        defaultPath: `${sanitizeExportFilename(session.title)}.md`,
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });

      if (saveResult.canceled || !saveResult.filePath) {
        return { ok: false, canceled: true };
      }

      fs.writeFileSync(saveResult.filePath, markdown, "utf8");
      return { ok: true, path: saveResult.filePath };
    } catch (error) {
      return { ok: false, error: error?.message || "Export failed." };
    }
  });

  ipcMain.handle("pick-chat-backup-folder", async () => {
    debugLog("ipc:pick-chat-backup-folder");
    const parentWindow = panelWindow && !panelWindow.isDestroyed() ? panelWindow : null;
    const result = await dialog.showOpenDialog(parentWindow, {
      properties: ["openDirectory", "createDirectory"],
      title: "Select Chat Backup Folder",
    });
    if (result.canceled || !result.filePaths?.[0]) {
      return { ok: false, canceled: true };
    }
    const selectedPath = result.filePaths[0];
    store.set("chatBackupPath", selectedPath);
    return { ok: true, path: selectedPath };
  });

  ipcMain.handle("backup-chat-sessions", async (_event, { folderPath } = {}) => {
    debugLog("ipc:backup-chat-sessions");
    try {
      const targetDir = String(folderPath || store.get("chatBackupPath") || "").trim();
      if (!targetDir) {
        return { ok: false, error: "Yedek klasörü seçilmedi." };
      }
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      const payload = exportAllSessionsJson(store);
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filePath = path.join(targetDir, `sauron-chats-${stamp}.json`);
      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
      return { ok: true, path: filePath };
    } catch (error) {
      return { ok: false, error: error?.message || "Backup failed." };
    }
  });

  ipcMain.handle("import-chat-sessions", async (_event, { mode = "merge" } = {}) => {
    debugLog("ipc:import-chat-sessions", { mode });
    try {
      const parentWindow = panelWindow && !panelWindow.isDestroyed() ? panelWindow : null;
      const pickResult = await dialog.showOpenDialog(parentWindow, {
        properties: ["openFile"],
        title: "Import Chat Sessions",
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (pickResult.canceled || !pickResult.filePaths?.[0]) {
        return { ok: false, canceled: true };
      }
      const raw = fs.readFileSync(pickResult.filePaths[0], "utf8");
      const payload = JSON.parse(raw);
      const imported = importChatSessionsFromJson(store, payload, { mode });
      if (!imported.ok) {
        return imported;
      }
      const activeId = store.get("chatSessionsV1")?.activeSessionId;
      if (activeId) {
        const loaded = loadChatSession(store, sessionManager, activeId);
        if (loaded.ok && loaded.snapshot) {
          broadcastSessionSnapshot(loaded.snapshot);
        }
      }
      return imported;
    } catch (error) {
      return { ok: false, error: error?.message || "Import failed." };
    }
  });
}

module.exports = { registerChatSessionsIpc };
