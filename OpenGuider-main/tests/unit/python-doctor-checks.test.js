const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { runSauronDoctor } = require("../../src/sauron/doctor");

test("runSauronDoctor includes python and cline capability checks", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-doctor-python-"));
  const store = {
    get(key) {
      if (key === "workspacePath") {
        return workspace;
      }
      if (key === "browserAgentEnabled") {
        return true;
      }
      return null;
    },
  };

  const result = runSauronDoctor(store);
  const ids = result.checks.map((entry) => entry.id);

  assert.ok(ids.includes("cline-variant"));
  assert.ok(ids.includes("cap-handoff"));
  assert.ok(ids.includes("cap-pipeline-autochain"));
  assert.ok(ids.includes("python-system"));
  assert.ok(ids.includes("python-runtime"));
  assert.ok(ids.includes("python-sidecar-script"));
  assert.ok(ids.includes("browser-agent-ready"));
  assert.ok(result.clineReport);
  assert.equal(typeof result.clineReport.summary, "string");

  fs.rmSync(workspace, { recursive: true, force: true });
});

test("runSauronDoctor skips detailed python checks when browser agent disabled", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-doctor-browser-off-"));
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

  const result = runSauronDoctor(store);
  const browserReady = result.checks.find((entry) => entry.id === "browser-agent-ready");
  assert.ok(browserReady);
  assert.match(browserReady.message, /devre dışı/i);
  assert.equal(result.checks.some((entry) => entry.id === "python-runtime"), false);

  fs.rmSync(workspace, { recursive: true, force: true });
});
