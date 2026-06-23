const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { runSauronDoctor, computeReadinessReport, checkVscodeNotCursor } = require("../../src/sauron/doctor");

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
  assert.ok(result.readiness.actionItems?.some((item) => item.id === "workspace-path"));
});

test("computeReadinessReport marks ready when solo checks pass", () => {
  const readiness = computeReadinessReport([
    { id: "vscode-cli", status: "pass" },
    { id: "vscode-not-cursor", status: "pass" },
    { id: "bridge-extension", status: "pass" },
    { id: "workspace-path", status: "pass" },
    { id: "sauron-dir", status: "pass" },
    { id: "ai-credentials", status: "pass" },
    { id: "bridge-vsix", status: "warn", tier: "optional" },
    { id: "cline-extension", status: "pass" },
    { id: "browser-agent-ready", status: "warn", tier: "optional" },
  ]);
  assert.equal(readiness.status, "ready");
  assert.equal(readiness.headline, "Kullanıma Hazır");
  assert.equal(readiness.actionItems.length, 0);
  assert.ok(readiness.warnings.length >= 1);
});

test("computeReadinessReport blocks when Cline missing", () => {
  const readiness = computeReadinessReport([
    { id: "vscode-cli", status: "pass" },
    { id: "vscode-not-cursor", status: "pass" },
    { id: "bridge-extension", status: "pass" },
    { id: "workspace-path", status: "pass" },
    { id: "sauron-dir", status: "pass" },
    { id: "ai-credentials", status: "pass" },
    { id: "cline-extension", status: "warn", fixHint: "VS Code Extensions → Cline kurun." },
  ]);
  assert.equal(readiness.status, "blocked");
  assert.ok(readiness.actionItems.some((item) => item.id === "cline-extension"));
});

test("checkVscodeNotCursor fails for Cursor shim path", () => {
  const check = checkVscodeNotCursor({
    vscodeCli: true,
    codeCmd: "C:\\Users\\me\\AppData\\Local\\Programs\\cursor\\code.cmd",
  });
  assert.equal(check.status, "fail");
  assert.equal(check.id, "vscode-not-cursor");
});

test("computeReadinessReport exposes actionItems with fixHint", () => {
  const readiness = computeReadinessReport([
    {
      id: "ai-credentials",
      status: "fail",
      fixHint: "Ayarlar → AI provider bölümünden API key girin.",
    },
  ]);
  assert.equal(readiness.actionItems.length, 1);
  assert.match(readiness.actionItems[0].fixHint, /API key/);
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

test("runSauronDoctor warns when goose binary missing", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-doctor-goose-"));
  const store = {
    get(key) {
      if (key === "workspacePath") return workspace;
      if (key === "gooseBinaryPath") return "";
      return null;
    },
  };
  const result = runSauronDoctor(store, { settings: { gooseEnabled: true } });
  const gooseBinary = result.checks.find((entry) => entry.id === "goose-binary");
  assert.equal(gooseBinary?.status, "warn");
  assert.match(gooseBinary?.message, /bulunamadı/i);
  fs.rmSync(workspace, { recursive: true, force: true });
});
