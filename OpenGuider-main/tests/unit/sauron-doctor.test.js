const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { runSauronDoctor, computeReadinessReport } = require("../../src/sauron/doctor");

test("runSauronDoctor returns structured checks", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-doctor-"));
  const store = {
    get(key) {
      if (key === "workspacePath") {
        return workspace;
      }
      return null;
    },
  };

  const result = runSauronDoctor(store);
  assert.equal(typeof result.ok, "boolean");
  assert.ok(Array.isArray(result.checks));
  assert.ok(result.checks.length >= 5);
  assert.ok(result.checks.some((entry) => entry.id === "node-version"));
  assert.ok(result.checks.some((entry) => entry.id === "workspace-path"));
  assert.ok(result.checks.some((entry) => entry.id === "sauron-dir"));
  assert.ok(result.checks.some((entry) => entry.id === "cline-variant"));
  assert.ok(result.clineReport);
  assert.equal(result.summary.pass + result.summary.warn + result.summary.fail, result.checks.length);

  fs.rmSync(workspace, { recursive: true, force: true });
});

test("runSauronDoctor warns when workspace missing", () => {
  const store = { get: () => "" };
  const result = runSauronDoctor(store);
  const workspaceCheck = result.checks.find((entry) => entry.id === "workspace-path");
  assert.equal(workspaceCheck.status, "warn");
  assert.equal(result.readiness.status, "blocked");
  assert.ok(result.readiness.blockers.includes("Workspace klasörü"));
});

test("computeReadinessReport marks ready when core checks pass", () => {
  const readiness = computeReadinessReport([
    { id: "vscode-cli", status: "pass" },
    { id: "bridge-extension", status: "pass" },
    { id: "workspace-path", status: "pass" },
    { id: "sauron-dir", status: "pass" },
    { id: "ai-credentials", status: "pass" },
    { id: "bridge-vsix", status: "pass" },
    { id: "cline-extension", status: "warn" },
    { id: "browser-agent-ready", status: "warn", tier: "optional" },
  ]);
  assert.equal(readiness.status, "ready");
  assert.equal(readiness.headline, "Kullanıma Hazır");
  assert.ok(readiness.warnings.length >= 1);
});

test("runSauronDoctor includes ai-credentials check", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-doctor-ready-"));
  const store = {
    get(key) {
      if (key === "workspacePath") {
        return workspace;
      }
      if (key === "browserAgentEnabled") {
        return false;
      }
      return null;
    },
  };
  const result = runSauronDoctor(store, {
    settings: {
      geminiApiKey: "test-key",
      aiProvider: "gemini",
    },
  });
  const aiCheck = result.checks.find((entry) => entry.id === "ai-credentials");
  assert.equal(aiCheck?.status, "pass");
  assert.ok(result.readiness);
  fs.rmSync(workspace, { recursive: true, force: true });
});
