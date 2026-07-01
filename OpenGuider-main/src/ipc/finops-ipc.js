function registerFinOpsIpc({
  ipcMain,
  debugLog,
  getRuntimeSettings,
  getUsageSummary,
  getUsageTimeSeries,
  sessionManager,
  syncClineUsageFromDisk,
  emitBudgetAlert,
  getFinOpsAlertWindows,
  persistFinOpsSettings,
}) {
  ipcMain.handle("get-finops-summary", async () => {
    const runtimeSettings = await getRuntimeSettings();
    if (typeof syncClineUsageFromDisk === "function") {
      await syncClineUsageFromDisk(runtimeSettings).catch(() => {});
    }
    const chatSessionId = sessionManager?.getSnapshot?.()?.sessionId || null;
    const summary = await getUsageSummary(runtimeSettings, { chatSessionId });

    if (typeof emitBudgetAlert === "function" && summary?.agentWallets) {
      const {
        buildLowAgentWalletAlerts,
        buildExhaustedAgentAlerts,
        buildSoftEconomySuggestionAlert,
        applySoftAutoEconomy,
      } = require("../sauron/finops/agent-usage");

      const exhaustedAlerts = buildExhaustedAgentAlerts(summary.agentWallets);
      for (const alert of exhaustedAlerts) {
        emitBudgetAlert(getFinOpsAlertWindows, alert);
      }

      const softEconomyAlert = buildSoftEconomySuggestionAlert(summary.agentWallets, runtimeSettings);
      if (softEconomyAlert) {
        emitBudgetAlert(getFinOpsAlertWindows, softEconomyAlert);
        if (softEconomyAlert.autoEconomyEnabled && typeof persistFinOpsSettings === "function") {
          const patched = applySoftAutoEconomy(runtimeSettings);
          if (patched._tokenUltraAutoEconomyApplied) {
            await persistFinOpsSettings({ finopsCostOptimizerMode: "economy" }).catch(() => {});
          }
        }
      }

      const lowAlerts = buildLowAgentWalletAlerts(summary.agentWallets, runtimeSettings);
      if (lowAlerts.length && typeof persistFinOpsSettings === "function") {
        emitBudgetAlert(getFinOpsAlertWindows, lowAlerts[0]);
        const markDate = lowAlerts[0]?.markAlertDate;
        if (markDate) {
          await persistFinOpsSettings({ finopsAgentWalletLastAlertDate: markDate }).catch(() => {});
        }
      }
    }

    return summary;
  });

  ipcMain.handle("get-finops-analytics", async (_event, options = {}) => {
    debugLog("ipc:get-finops-analytics", options);
    const runtimeSettings = await getRuntimeSettings();
    if (typeof syncClineUsageFromDisk === "function") {
      await syncClineUsageFromDisk(runtimeSettings).catch(() => {});
    }
    const days = Number(options?.days) || 7;
    const [summary, series] = await Promise.all([
      getUsageSummary(runtimeSettings),
      getUsageTimeSeries(runtimeSettings, { days }),
    ]);
    return {
      ok: true,
      days,
      summary,
      series,
    };
  });
}

module.exports = { registerFinOpsIpc };
