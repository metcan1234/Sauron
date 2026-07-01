const { launchGoose, cancelGooseSession, getGooseStatus } = require("../sauron/goose-launcher");
const { probeGooseBinary, clearGooseBinaryCache } = require("../sauron/goose-binary-resolver");
const { getGooseDailySpendSummary } = require("../sauron/goose-finops");
const { resolveGooseMode } = require("../sauron/goose-router");
const { detectGooseComplexity } = require("../sauron/goose-complexity");
const { getBlockersForChannel } = require("../sauron/doctor");

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
      const settings = await getRuntimeSettings({ includePersona: false });
      if (settings.gooseEnabled === false) {
        return { ok: false, error: "Goose Kısmı devre dışı. Ayarlar → AI Ajanları." };
      }

      // Preflight: Goose bloker kontrolü
      const blockers = getBlockersForChannel('goose', store, { settings });
      if (blockers.length > 0) {
        return { ok: false, error: `🪿 Goose başlatılamadı:\n${blockers.join('\n')}`, blockers };
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

      if (result.ok && result.binaryPath && !settings.gooseBinaryPath) {
        store.set("gooseBinaryPath", result.binaryPath);
      }

      if (result.ok) {
        broadcastGooseEvent("goose-session-started", {
          sessionId: result.sessionId,
          mode: result.mode,
          provider: result.provider,
          model: result.model,
          terminal: result.terminal || null,
        });
      }
      return result;
    } catch (error) {
      appLogger?.error?.("start-goose-session-failed", { error: error?.message || error });
      return { ok: false, error: error?.message || "Goose başlatılamadı." };
    }
  });

  ipcMain.handle("get-goose-status", async () => {
    const settings = await getRuntimeSettings({ includePersona: false });
    const status = getGooseStatus();
    const probe = await probeGooseBinary(settings);
    return {
      ...status,
      runtimeAlive: status.runtimeAlive === true,
      binaryPath: probe.binaryPath,
      version: probe.version || null,
      cliCapable: probe.cliCapable === true,
      kind: probe.kind || "missing",
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
    const settings = await getRuntimeSettings({ includePersona: false });
    return getGooseDailySpendSummary(settings);
  });

  ipcMain.handle("preview-goose-mode", async (_event, { taskText } = {}) => {
    const settings = await getRuntimeSettings({ includePersona: false });
    const routing = await resolveGooseMode(String(taskText || ""), settings);
    return {
      ok: true,
      mode: routing.mode,
      reason: routing.reason,
      notices: routing.notices,
      complexity: detectGooseComplexity(String(taskText || "")),
    };
  });

  ipcMain.handle("probe-goose-binary", async (_event, options = {}) => {
    const settings = await getRuntimeSettings({ includePersona: false });
    const gooseBinaryPath = String(
      options.gooseBinaryPath ?? settings.gooseBinaryPath ?? "",
    ).trim();
    clearGooseBinaryCache();
    return probeGooseBinary({
      ...settings,
      gooseBinaryPath,
    });
  });
}

module.exports = {
  registerGooseIpc,
};
