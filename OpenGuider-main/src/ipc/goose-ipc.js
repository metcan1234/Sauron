const { launchGoose, cancelGooseSession, getGooseStatus } = require("../sauron/goose-launcher");
const { discoverGooseBinaryAsync, getGooseVersion } = require("../sauron/goose-binary-resolver");
const { getGooseTodaySpentTl, summarizeGooseUsage } = require("../sauron/goose-finops");
const { resolveGooseMode } = require("../sauron/goose-router");
const { detectGooseComplexity } = require("../sauron/goose-complexity");

function registerGooseIpc({
  ipcMain,
  debugLog,
  appLogger,
  getRuntimeSettings,
  panelWindow,
  store,
}) {
  function resolveWorkspacePath(workspacePath) {
    const fromArg = String(workspacePath || "").trim();
    if (fromArg) {
      return fromArg;
    }
    return String(store.get("workspacePath") || "").trim();
  }

  function broadcastGooseEvent(event, payload) {
    if (panelWindow && !panelWindow.isDestroyed()) {
      panelWindow.webContents.send(event, payload);
    }
  }

  ipcMain.handle("start-goose-session", async (_event, { taskText, workspacePath, mode } = {}) => {
    debugLog("ipc:start-goose-session");
    try {
      const settings = await getRuntimeSettings();
      if (settings.gooseEnabled === false) {
        return { ok: false, error: "Goose Kısmı devre dışı. Ayarlar → AI Ajanları." };
      }

      const resolved = resolveWorkspacePath(workspacePath);
      const goal = String(taskText || "").trim();
      if (!goal) {
        return { ok: false, error: "Görev metni gerekli." };
      }

      const result = await launchGoose({
        workspacePath: resolved,
        taskText: goal,
        settings,
        modeOverride: mode || null,
      });

      if (result.ok) {
        broadcastGooseEvent("goose-session-started", {
          sessionId: result.sessionId,
          mode: result.mode,
          provider: result.provider,
          model: result.model,
        });
      }
      return result;
    } catch (error) {
      appLogger?.error?.("start-goose-session-failed", { error: error?.message || error });
      return { ok: false, error: error?.message || "Goose başlatılamadı." };
    }
  });

  ipcMain.handle("get-goose-status", async () => {
    const settings = await getRuntimeSettings();
    const status = getGooseStatus();
    const binaryPath = await discoverGooseBinaryAsync(settings);
    const version = binaryPath ? await getGooseVersion(binaryPath) : null;
    return {
      ...status,
      binaryPath,
      version,
      enabled: settings.gooseEnabled !== false,
    };
  });

  ipcMain.handle("cancel-goose-session", async () => {
    const result = cancelGooseSession();
    if (result.ok) {
      broadcastGooseEvent("goose-session-cancelled", { sessionId: result.sessionId });
    }
    return result;
  });

  ipcMain.handle("get-goose-daily-spend", async () => {
    const settings = await getRuntimeSettings();
    const spentTl = await getGooseTodaySpentTl(settings);
    const summary = await summarizeGooseUsage(settings);
    const dailyBudgetTl = Number(settings.gooseDailyBudgetTl) || 0;
    return {
      ok: true,
      spentTl,
      dailyBudgetTl,
      remainingTl: dailyBudgetTl > 0 ? Math.max(0, dailyBudgetTl - spentTl) : null,
      summary,
    };
  });

  ipcMain.handle("preview-goose-mode", async (_event, { taskText } = {}) => {
    const settings = await getRuntimeSettings();
    const routing = await resolveGooseMode(String(taskText || ""), settings);
    return {
      ok: true,
      mode: routing.mode,
      reason: routing.reason,
      notices: routing.notices,
      complexity: detectGooseComplexity(String(taskText || "")),
    };
  });

  ipcMain.handle("probe-goose-binary", async () => {
    const settings = await getRuntimeSettings();
    const binaryPath = await discoverGooseBinaryAsync(settings);
    const version = binaryPath ? await getGooseVersion(binaryPath) : null;
    return { ok: Boolean(binaryPath), binaryPath, version };
  });
}

module.exports = {
  registerGooseIpc,
};
