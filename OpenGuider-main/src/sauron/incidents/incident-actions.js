const { validateActionPayload } = require("./incident-guards");

async function runDoctorCheck(deps = {}, checkId = "") {
  const runDoctor = deps.runSauronDoctor;
  if (typeof runDoctor !== "function") {
    return { ok: false, error: "doctor_unavailable" };
  }
  const result = await runDoctor();
  const checks = Array.isArray(result?.checks) ? result.checks : [];
  const target = String(checkId || "").trim();
  if (!target) {
    return { ok: true, result };
  }
  const match = checks.find((entry) => entry.id === target);
  if (!match) {
    return { ok: false, error: `doctor_check_missing:${target}`, result };
  }
  return {
    ok: match.status === "pass",
    status: match.status,
    message: match.message,
    fixHint: match.fixHint || "",
    result,
  };
}

async function executeIncidentAction(action = {}, deps = {}) {
  const validation = validateActionPayload(action);
  if (!validation.ok) {
    return { ok: false, error: validation.reason, action };
  }

  const name = validation.action;
  if (name === "run-doctor-check") {
    return runDoctorCheck(deps, action.checkId);
  }
  if (name === "run-full-doctor") {
    return runDoctorCheck(deps, "");
  }
  if (name === "suggest-install-bridge") {
    return {
      ok: true,
      suggested: true,
      message: "Sauron Bridge kurulumu önerildi. Onay sonrası install-bridge çalıştırılabilir.",
    };
  }
  if (name === "install-bridge") {
    const install = deps.installWorkspaceStack;
    if (typeof install !== "function") {
      return { ok: false, error: "install_unavailable" };
    }
    const result = await install({ force: Boolean(action.force) });
    return {
      ok: result?.ok === true,
      result,
      error: result?.ok ? "" : (result?.error || "install_failed"),
    };
  }
  if (name === "open-settings-tab") {
    return {
      ok: true,
      navigate: {
        tab: String(action.tab || "workspace").trim(),
      },
      message: `Ayarlar sekmesi: ${action.tab || "workspace"}`,
    };
  }
  if (name === "retry-handoff") {
    return {
      ok: true,
      retry: { operation: "open-workspace-handoff", force: Boolean(action.force) },
      message: "Handoff yeniden denenebilir.",
    };
  }
  if (name === "show-incident-hint") {
    return {
      ok: true,
      hint: String(action.message || action.hint || "").trim(),
    };
  }

  return { ok: false, error: `unhandled_action:${name}` };
}

module.exports = {
  executeIncidentAction,
  runDoctorCheck,
};
