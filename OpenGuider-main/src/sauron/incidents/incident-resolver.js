const { buildIncidentFingerprint, inferIncidentCode } = require("./incident-fingerprint");
const {
  lookupIncident,
  canAutoApplyIncident,
  readIncidentRegistry,
  upsertLearnedIncident,
} = require("./incident-registry");
const { executeIncidentFix } = require("./incident-fix-executor");
const { emitIncidentAlert } = require("./incident-alert");
const { diagnoseIncident, planIncidentFix } = require("./incident-agent");

async function resolveIncident({
  error = {},
  context = {},
  settings = {},
  deps = {},
  getWindows,
}) {
  if (settings.incidentMemoryEnabled === false) {
    return { handled: false, reason: "incident_memory_disabled" };
  }

  const fingerprint = buildIncidentFingerprint(error, context);
  const workspacePath = String(context.workspacePath || settings.workspacePath || "").trim();
  const incident = lookupIncident(fingerprint, workspacePath);
  const errorCode = inferIncidentCode(error, context);

  const baseAlert = {
    level: "info",
    fingerprint,
    errorCode,
    component: context.component || "panel",
    operation: context.operation || "unknown",
    message: String(error?.message || error || "").trim(),
    knownIncident: Boolean(incident),
    incidentId: incident?.id || null,
    hint: incident?.hint || "",
    requiresApproval: false,
    autoApplied: false,
  };

  emitIncidentAlert(getWindows, baseAlert);

  if (!incident) {
    if (settings.incidentAgentDiagnoseEnabled !== false && typeof deps.streamAIResponse === "function") {
      setImmediate(() => {
        void (async () => {
          try {
            const diagnosis = await diagnoseIncident({
              error,
              context: { ...context, fingerprint, errorCode },
              settings,
              streamAIResponse: deps.streamAIResponse,
            });
            if (!diagnosis?.component) {
              return;
            }
            emitIncidentAlert(getWindows, {
              level: "info",
              incidentDiagnosis: true,
              fingerprint,
              message: diagnosis.summary || "Yeni hata sınıflandırıldı.",
              diagnosis,
            });
          } catch {
            // non-fatal
          }
        })();
      });
    }
    return { handled: false, fingerprint, reason: "unknown_incident" };
  }

  const auto = canAutoApplyIncident(incident, settings);
  const requiresApproval = !auto && incident.risk !== "low";

  if (!auto && incident.risk !== "low") {
    emitIncidentAlert(getWindows, {
      ...baseAlert,
      level: "warning",
      requiresApproval: true,
      message: incident.hint || baseAlert.message,
      approvalIncidentId: incident.id,
    });
    return {
      handled: true,
      fingerprint,
      incident,
      requiresApproval: true,
    };
  }

  if (!auto) {
    emitIncidentAlert(getWindows, {
      ...baseAlert,
      level: "warning",
      requiresApproval: true,
      canApplyFix: true,
      message: incident.hint || "Bilinen hata — onarım adımlarını uygulamak ister misin?",
      approvalIncidentId: incident.id,
    });
    return {
      handled: true,
      fingerprint,
      incident,
      requiresApproval: true,
      canApplyFix: true,
    };
  }

  const fixResult = await executeIncidentFix(
    incident,
    { ...context, workspacePath, auto: true },
    deps,
  );

  emitIncidentAlert(getWindows, {
    ...baseAlert,
    level: fixResult.ok ? "success" : "warning",
    autoApplied: fixResult.ok,
    message: fixResult.ok
      ? "Bilinen hata otomatik onarıldı."
      : (incident.hint || fixResult.error || baseAlert.message),
    fixResult,
  });

  return {
    handled: true,
    fingerprint,
    incident,
    autoApplied: fixResult.ok,
    fixResult,
  };
}

async function applyIncidentById({
  incidentId,
  workspacePath = "",
  settings = {},
  deps = {},
  getWindows,
  approved = false,
}) {
  const { incidents } = readIncidentRegistry(workspacePath);
  const incident = incidents.find((entry) => entry.id === incidentId);
  if (!incident) {
    return { ok: false, error: "incident_not_found" };
  }
  if (!approved && incident.risk !== "low") {
    return { ok: false, error: "approval_required", incident };
  }

  const fixResult = await executeIncidentFix(
    incident,
    { workspacePath, approved: true },
    deps,
  );

  emitIncidentAlert(getWindows, {
    level: fixResult.ok ? "success" : "warning",
    incidentId,
    message: fixResult.ok ? "Onarım adımları uygulandı." : (fixResult.error || "Onarım başarısız"),
    fixResult,
  });

  return fixResult;
}

async function learnIncidentFromAgent({
  workspacePath = "",
  fingerprint = "",
  diagnosis = {},
  plan = {},
  settings = {},
  deps = {},
}) {
  if (!fingerprint || !plan?.allowedActions?.length) {
    return { ok: false, error: "invalid_learn_payload" };
  }
  const validation = require("./incident-guards").validateFixPlan(plan);
  if (!validation.ok) {
    return { ok: false, error: validation.reason };
  }

  const incident = upsertLearnedIncident(workspacePath, {
    id: plan.id || `learned-${fingerprint.replace(/[^a-z0-9]+/gi, "-").slice(0, 40)}`,
    fingerprint,
    component: diagnosis.component || "panel",
    risk: plan.risk || "medium",
    autoApply: false,
    verified: false,
    successCount: 0,
    hint: plan.hint || diagnosis.summary || "",
    fix: {
      tier: "scripted",
      allowedActions: validation.allowedActions,
    },
  });

  if (settings.incidentAgentDiagnoseEnabled === false) {
    return { ok: true, incident, stored: true };
  }

  return { ok: true, incident, stored: true };
}

async function planAndOptionallyStoreIncident({
  error,
  context,
  settings,
  deps,
}) {
  const plan = await planIncidentFix({
    error,
    context,
    settings,
    streamAIResponse: deps.streamAIResponse,
  });
  return plan;
}

module.exports = {
  resolveIncident,
  applyIncidentById,
  learnIncidentFromAgent,
  planAndOptionallyStoreIncident,
};
