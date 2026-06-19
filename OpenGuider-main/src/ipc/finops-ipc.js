function registerFinOpsIpc({
  ipcMain,
  debugLog,
  getRuntimeSettings,
  getUsageSummary,
  getUsageTimeSeries,
  sessionManager,
}) {
  ipcMain.handle("get-finops-summary", async () => {
    const runtimeSettings = await getRuntimeSettings();
    const chatSessionId = sessionManager?.getSnapshot?.()?.sessionId || null;
    return getUsageSummary(runtimeSettings, { chatSessionId });
  });

  ipcMain.handle("get-finops-analytics", async (_event, options = {}) => {
    debugLog("ipc:get-finops-analytics", options);
    const runtimeSettings = await getRuntimeSettings();
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
