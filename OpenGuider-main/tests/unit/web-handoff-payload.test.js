const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { buildHandoffPayload } = require("../../src/sauron/handoff");
const { saveBrief } = require("../../src/sauron/web-studio/brief-schema");

test("buildHandoffPayload includes webBrief when brief exists in workspace", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "web-handoff-"));
  saveBrief(workspace, {
    companyName: "Test Holding",
    tagline: "Premium services",
    industry: "finance",
    primaryColor: "#112233",
    accentColor: "#ffcc00",
    brandTone: "luxury",
    pages: ["home", "contact"],
  });

  const payload = buildHandoffPayload(
    { sessionId: "s1", goalIntent: "Build website" },
    workspace,
    "handoff-test-id",
    {},
  );

  assert.equal(payload.projectType, "corporate-web");
  assert.ok(payload.webBrief);
  assert.equal(payload.webBrief.companyName, "Test Holding");
  assert.ok(payload.taskSummary.includes("WEB PROJECT BRIEF"));
  assert.ok(payload.taskSummary.includes("Test Holding"));
  assert.equal(payload.complexityHint, "high");
  assert.deepEqual(payload.qualityGates, ["seo", "a11y", "responsive", "performance"]);

  fs.rmSync(workspace, { recursive: true, force: true });
});

test("buildHandoffPayload omits web fields without brief", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "web-handoff-empty-"));
  const payload = buildHandoffPayload({ sessionId: "s2" }, workspace, "id-2", {});
  assert.equal(payload.projectType, undefined);
  assert.equal(payload.webBrief, undefined);
  fs.rmSync(workspace, { recursive: true, force: true });
});
