const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildIncidentFingerprint,
  inferIncidentCode,
  matchesIncident,
} = require("../../src/sauron/incidents/incident-fingerprint");
const {
  lookupIncident,
  recordIncidentOutcome,
  upsertLearnedIncident,
  readIncidentRegistry,
} = require("../../src/sauron/incidents/incident-registry");
const { validateActionPayload, validateFixPlan } = require("../../src/sauron/incidents/incident-guards");
const { executeIncidentFix } = require("../../src/sauron/incidents/incident-fix-executor");
const fs = require("fs");
const os = require("os");
const path = require("path");

test("buildIncidentFingerprint normalizes workspace bridge errors", () => {
  const fp = buildIncidentFingerprint(
    { message: "Sauron Bridge kurulamadı." },
    { component: "workspace", operation: "open-workspace-handoff" },
  );
  assert.equal(fp, "workspace:open-workspace-handoff:BRIDGE_MISSING");
});

test("lookupIncident finds default bridge incident", () => {
  const incident = lookupIncident("workspace:open-workspace-handoff:BRIDGE_MISSING", "");
  assert.ok(incident);
  assert.equal(incident.id, "bridge-extension-missing");
});

test("validateActionPayload rejects unknown actions", () => {
  const result = validateActionPayload({ action: "rm-rf-node-modules" });
  assert.equal(result.ok, false);
});

test("validateFixPlan rejects forbidden patterns in payload", () => {
  const result = validateFixPlan({
    allowedActions: [{ action: "show-incident-hint", message: "git reset --hard now" }],
  });
  assert.equal(result.ok, false);
});

test("executeIncidentFix runs doctor check without mutating files", async () => {
  const incident = lookupIncident("workspace:open-workspace-handoff:VSCODE_CLI_MISSING", "");
  const result = await executeIncidentFix(
    incident,
    { workspacePath: "" },
    {
      runSauronDoctor: async () => ({
        checks: [{ id: "vscode-cli", status: "fail", message: "missing" }],
      }),
    },
  );
  assert.equal(result.ok, false);
  assert.ok(Array.isArray(result.results));
});

test("recordIncidentOutcome tracks success count in workspace registry", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "incident-outcome-"));
  try {
    recordIncidentOutcome(workspace, "bridge-extension-missing", { success: true });
    recordIncidentOutcome(workspace, "bridge-extension-missing", { success: true });
    const updated = lookupIncident("workspace:open-workspace-handoff:BRIDGE_MISSING", workspace);
    assert.ok(updated);
    assert.ok(Number(updated.successCount) >= 2);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("upsertLearnedIncident stores learned fixes only in workspace file", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "incident-learn-"));
  try {
    upsertLearnedIncident(workspace, {
      id: "custom-test-incident",
      fingerprint: "panel:test:UNKNOWN_ERROR",
      learned: true,
      risk: "medium",
      fix: {
        tier: "scripted",
        allowedActions: [{ action: "show-incident-hint", message: "test hint" }],
      },
    });
    const { incidents } = readIncidentRegistry(workspace);
    const learned = incidents.find((entry) => entry.id === "custom-test-incident");
    assert.ok(learned);
    assert.equal(learned.learned, true);
    assert.ok(matchesIncident(learned, "panel:test:UNKNOWN_ERROR"));
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
