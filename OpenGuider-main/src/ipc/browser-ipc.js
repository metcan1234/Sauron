function registerBrowserIpc({
  ipcMain,
  debugLog,
  appLogger,
  getRuntimeSettings,
  syncBrowserPluginWithRuntimeSettings,
  registry,
  resolveChildProcessAssetPath,
  getBrowserRuntimeInstallDir,
  process,
}) {
  const channelRuntime = require("../sauron/channel-runtime");
  const { getBlockersForChannel } = require("../sauron/doctor");
  ipcMain.handle("restart-browser-agent", async () => {
    debugLog("ipc:restart-browser-agent");
    try {
      const runtimeSettings = await getRuntimeSettings({ includePersona: false });

      // Preflight: Browser bloker kontrolü
      const blockers = getBlockersForChannel('browser', null, { settings: runtimeSettings });
      if (blockers.length > 0) {
        return { ok: false, error: `Browser Agent başlatılamadı:\n${blockers.join('\n')}`, blockers };
      }

      const plugin = registry.getPlugin("browser");
      await plugin.shutdown();
      await syncBrowserPluginWithRuntimeSettings(runtimeSettings, { forceRestart: false });
      return { ok: true };
    } catch (err) {
      appLogger.error("restart-browser-agent-failed", { error: err });
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle("get-browser-agent-status", () => {
    try {
      // Use channel-runtime as primary source for process liveness
      const runtimeState = channelRuntime.getState('browser');
      if (runtimeState.registered && runtimeState.alive) {
        return "running";
      }
      if (runtimeState.registered && !runtimeState.alive) {
        return "stopped";
      }
      // Fallback: plugin registry status
      const status = registry.getStatus("browser");
      if (status === "ok") {
        const plugin = registry.getPlugin("browser");
        return plugin._sidecar?.isRunning ? "running" : "stopped";
      }
      return status || "stopped";
    } catch (_) {
      return "stopped";
    }
  });

  ipcMain.handle("get-browser-runtime-info", () => {
    try {
      const { getInstalledRuntimeInfo } = require("../plugins/browser/sidecar");
      const info = getInstalledRuntimeInfo();
      return {
        ok: true,
        installed: Boolean(info?.pythonBin),
        runtimeDir: info?.runtimeDir || null,
        pythonBin: info?.pythonBin || null,
      };
    } catch (error) {
      return {
        ok: false,
        installed: false,
        error: error?.message || "Failed to read browser runtime info.",
      };
    }
  });

  ipcMain.handle("download-browser-agent", async (event) => {
    debugLog("ipc:download-browser-agent");
    return new Promise((resolve) => {
      const { spawn } = require("child_process");
      const scriptPath = resolveChildProcessAssetPath("scripts", "download-browser-agent.js");
      const targetDir = getBrowserRuntimeInstallDir();
      const child = spawn(process.execPath, [scriptPath, "--target", targetDir], {
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: "1",
          OPENGUIDER_BROWSER_RUNTIME_DIR: targetDir,
        },
      });

      child.stdout.on("data", (data) => {
        const lines = data.toString().split("\n");
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            event.sender.send("browser-agent-download-progress", parsed);
          } catch (e) {}
        }
      });

      child.on("close", async (code) => {
        if (code === 0) {
          try {
            const runtimeSettings = await getRuntimeSettings({ includePersona: false });
            await syncBrowserPluginWithRuntimeSettings(runtimeSettings, { forceRestart: true });
            resolve({ ok: true, targetDir });
          } catch (err) {
            appLogger.error("download-browser-agent-restart-failed", { error: err?.message });
            resolve({ ok: false, error: err?.message || "Runtime downloaded but restart failed" });
          }
          return;
        }

        resolve({ ok: false, error: `Exit code ${code}` });
      });

      child.on("error", (err) => resolve({ ok: false, error: err.message }));
    });
  });
}

module.exports = { registerBrowserIpc };
