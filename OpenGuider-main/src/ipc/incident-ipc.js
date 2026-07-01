function registerIncidentIpc({
  ipcMain,
  debugLog,
  store,
  getRuntimeSettings,
  getFinOpsAlertWindows,
  runSauronDoctor,
  installWorkspaceStack,
  streamAIResponse,
}) {
  const {
    readIncidentRegistry,
    readAppliedLog,
    clearIncidentData,
    lookupIncidentById,
  } = require("../sauron/incidents/incident-registry");
  const {
    resolveIncident,
    applyIncidentById,
    planAndOptionallyStoreIncident,
    learnIncidentFromAgent,
  } = require("../sauron/incidents/incident-resolver");
  const { buildIncidentFingerprint } = require("../sauron/incidents/incident-fingerprint");
  const { diagnoseIncident } = require("../sauron/incidents/incident-agent");

  const TASK_RUNTIME = { includePersona: false };

  function buildDeps() {
    return {
      runSauronDoctor,
      installWorkspaceStack,
      streamAIResponse,
      store,
    };
  }

  ipcMain.handle("get-incident-registry-state", async () => {
    debugLog("ipc:get-incident-registry-state");
    const settings = await getRuntimeSettings(TASK_RUNTIME);
    const workspacePath = String(settings.workspacePath || "").trim();
    const registry = readIncidentRegistry(workspacePath);
    const applied = readAppliedLog(workspacePath, 15);
    return {
      ok: true,
      workspacePath,
      incidentMemoryEnabled: settings.incidentMemoryEnabled !== false,
      incidentAutoApplyLowRisk: settings.incidentAutoApplyLowRisk === true,
      incidentAgentDiagnoseEnabled: settings.incidentAgentDiagnoseEnabled !== false,
      incidents: registry.incidents,
      applied,
      source: registry.source,
    };
  });

  ipcMain.handle("apply-incident-fix", async (_event, payload = {}) => {
    debugLog("ipc:apply-incident-fix", payload?.incidentId);
    const settings = await getRuntimeSettings(TASK_RUNTIME);
    const workspacePath = String(settings.workspacePath || store.get("workspacePath") || "").trim();
    const incidentId = String(payload?.incidentId || "").trim();
    if (!incidentId) {
      return { ok: false, error: "incident_id_required" };
    }
    return applyIncidentById({
      incidentId,
      workspacePath,
      settings,
      deps: buildDeps(),
      getWindows: getFinOpsAlertWindows,
      approved: payload?.approved === true,
    });
  });

  ipcMain.handle("plan-incident-fix", async (_event, payload = {}) => {
    debugLog("ipc:plan-incident-fix");
    const settings = await getRuntimeSettings(TASK_RUNTIME);
    const workspacePath = String(settings.workspacePath || "").trim();
    const error = { message: String(payload?.message || ""), code: payload?.code || "" };
    const context = {
      component: payload?.component || "panel",
      operation: payload?.operation || "unknown",
      workspacePath,
    };
    const fingerprint = buildIncidentFingerprint(error, context);
    const diagnosis = await diagnoseIncident({
      error,
      context: { ...context, fingerprint },
      settings,
      streamAIResponse,
    });
    const plan = await planAndOptionallyStoreIncident({
      error,
      context: { ...context, fingerprint },
      settings,
      deps: { streamAIResponse },
    });
    return { ok: true, fingerprint, diagnosis, plan };
  });

  ipcMain.handle("learn-incident-fix", async (_event, payload = {}) => {
    debugLog("ipc:learn-incident-fix", payload?.fingerprint);
    const settings = await getRuntimeSettings(TASK_RUNTIME);
    const workspacePath = String(settings.workspacePath || "").trim();
    return learnIncidentFromAgent({
      workspacePath,
      fingerprint: payload?.fingerprint,
      diagnosis: payload?.diagnosis || {},
      plan: payload?.plan || {},
      settings,
      deps: buildDeps(),
    });
  });

  ipcMain.handle("clear-incident-memory", async () => {
    debugLog("ipc:clear-incident-memory");
    const settings = await getRuntimeSettings(TASK_RUNTIME);
    const workspacePath = String(settings.workspacePath || "").trim();
    return clearIncidentData(workspacePath);
  });

  return {
    async handleRuntimeIncident(error, context = {}) {
      const settings = await getRuntimeSettings(TASK_RUNTIME);
      return resolveIncident({
        error,
        context: {
          ...context,
          workspacePath: context.workspacePath || settings.workspacePath,
        },
        settings,
        deps: buildDeps(),
        getWindows: getFinOpsAlertWindows,
      });
    },
    lookupIncidentById: (id, workspacePath) => lookupIncidentById(id, workspacePath),
  };
}

module.exports = { registerIncidentIpc };
