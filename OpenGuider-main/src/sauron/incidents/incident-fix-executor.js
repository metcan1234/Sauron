const fs = require("fs");
const os = require("os");
const path = require("path");
const { validateFixPlan } = require("./incident-guards");
const { executeIncidentAction } = require("./incident-actions");
const {
  appendAppliedLog,
  recordIncidentOutcome,
} = require("./incident-registry");

async function executeIncidentFix(incident = {}, context = {}, deps = {}) {
  const validation = validateFixPlan(incident.fix || {});
  if (!validation.ok) {
    return {
      ok: false,
      blocked: true,
      reason: validation.reason,
      incidentId: incident.id,
    };
  }

  const tier = String(incident.fix?.tier || "diagnose").trim();
  if (tier === "agent-plan") {
    return {
      ok: false,
      blocked: true,
      requiresApproval: true,
      reason: "agent_plan_requires_approval",
      incidentId: incident.id,
    };
  }

  const results = [];
  for (const action of validation.allowedActions) {
    const result = await executeIncidentAction(action, deps);
    results.push({ action, result });
    if (!result.ok && tier === "scripted") {
      appendAppliedLog(context.workspacePath, {
        incidentId: incident.id,
        fingerprint: incident.fingerprint,
        action: action.action,
        ok: false,
        error: result.error || result.message || "action_failed",
      });
      recordIncidentOutcome(context.workspacePath, incident.id, { success: false });
      return {
        ok: false,
        incidentId: incident.id,
        results,
        error: result.error || "action_failed",
      };
    }
  }

  appendAppliedLog(context.workspacePath, {
    incidentId: incident.id,
    fingerprint: incident.fingerprint,
    ok: true,
    actionCount: results.length,
    auto: Boolean(context.auto),
  });
  recordIncidentOutcome(context.workspacePath, incident.id, { success: true });

  return {
    ok: true,
    incidentId: incident.id,
    results,
    hints: results.map((entry) => entry.result?.hint).filter(Boolean),
    navigate: results.map((entry) => entry.result?.navigate).find(Boolean) || null,
    retry: results.map((entry) => entry.result?.retry).find(Boolean) || null,
  };
}

module.exports = {
  executeIncidentFix,
};
