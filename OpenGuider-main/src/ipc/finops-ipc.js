function registerFinOpsIpc({
  ipcMain,
  debugLog,
  getRuntimeSettings,
  getUsageSummary,
  sessionManager,
}) {
  ipcMain.handle("get-finops-summary", async () => {
    const runtimeSettings = await getRuntimeSettings();
    const chatSessionId = sessionManager?.getSnapshot?.()?.sessionId || null;
    return getUsageSummary(runtimeSettings, { chatSessionId });
  });
}

module.exports = { registerFinOpsIpc };
