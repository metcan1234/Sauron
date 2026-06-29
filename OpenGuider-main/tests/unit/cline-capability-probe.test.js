const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  extensionHasForkMarkers,
  buildCapabilitiesForVariant,
  buildCapabilityReport,
  probeClineInstallation,
} = require("../../src/sauron/cline-capability-probe");

function createMockExtensionDir(name, markers = []) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cline-probe-"));
  const extDir = path.join(root, name);
  const distDir = path.join(extDir, "dist");
  fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(
    path.join(distDir, "extension.js"),
    markers.join("\n"),
    "utf8",
  );
  return { root, extDir };
}

test("extensionHasForkMarkers detects fork API strings", () => {
  const { root, extDir } = createMockExtensionDir("saoudrizwan.claude-dev-3.0.0", [
    "function syncProviderCredentials() {}",
    "function setActiveModel() {}",
    "function clearTask() {}",
  ]);
  try {
    assert.equal(extensionHasForkMarkers(extDir), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("extensionHasForkMarkers returns false for marketplace bundle", () => {
  const { root, extDir } = createMockExtensionDir("saoudrizwan.claude-dev-3.0.0", [
    "function startNewTask() {}",
    "function addToInput() {}",
  ]);
  try {
    assert.equal(extensionHasForkMarkers(extDir), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("buildCapabilitiesForVariant marks marketplace features as limited", () => {
  const forkCaps = buildCapabilitiesForVariant("fork");
  const marketplaceCaps = buildCapabilitiesForVariant("marketplace");

  assert.equal(forkCaps.handoff, true);
  assert.equal(forkCaps.pipelineAutoChain, true);
  assert.equal(marketplaceCaps.handoff, true);
  assert.equal(marketplaceCaps.pipelineAutoChain, false);
  assert.equal(marketplaceCaps.degradedOnMarketplace, true);
});

test("buildCapabilityReport summarizes marketplace limitations", () => {
  const report = buildCapabilityReport({
    variant: "marketplace",
    extensionPath: "/tmp/cline",
    capabilities: buildCapabilitiesForVariant("marketplace"),
  });

  assert.match(report.summary, /Marketplace Cline/i);
  assert.ok(report.limited.some((entry) => /autoChain|auto.?chain|faz zinciri/i.test(entry)));
  assert.ok(report.works.some((entry) => /Handoff/i.test(entry)));
});

test("probeClineInstallation returns not_installed when extension missing", () => {
  const result = probeClineInstallation({
    codeCmd: path.join(os.tmpdir(), "missing-code-cmd"),
    extensionId: "test.nonexistent.claude-dev",
  });
  assert.equal(result.variant, "not_installed");
  assert.equal(result.capabilities.handoff, false);
});
