const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { runSauronDoctor } = require("../../src/sauron/doctor");

test("runSauronDoctor skips web studio check when disabled", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-doctor-ws-off-"));
  const store = {
    get(key) {
      if (key === "workspacePath") return workspace;
      if (key === "webStudioEnabled") return false;
      if (key === "browserAgentEnabled") return false;
      if (key === "selfBuildEnabled") return false;
      return null;
    },
  };
  const result = runSauronDoctor(store, {
    settings: { geminiApiKey: "test-key" },
  });
  const webCheck = result.checks.find((entry) => entry.id === "web-studio-ready");
  assert.equal(webCheck?.status, "pass");
  assert.match(webCheck?.message, /devre dışı/);
  fs.rmSync(workspace, { recursive: true, force: true });
});

test("runSauronDoctor skips pipeline autochain when self-build disabled", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sauron-doctor-sb-off-"));
  const store = {
    get(key) {
      if (key === "workspacePath") return workspace;
      if (key === "selfBuildEnabled") return false;
      if (key === "browserAgentEnabled") return false;
      return null;
    },
  };
  const result = runSauronDoctor(store);
  const pipeCheck = result.checks.find((entry) => entry.id === "cap-pipeline-autochain");
  assert.equal(pipeCheck?.status, "pass");
  assert.match(pipeCheck?.message, /devre dışı/);
  fs.rmSync(workspace, { recursive: true, force: true });
});
