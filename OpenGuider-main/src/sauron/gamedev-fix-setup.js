const { execFile } = require("child_process");
const { promisify } = require("util");
const path = require("path");
const { writeGamedevMcpConfig } = require("./gamedev-mcp-config");
const { probeGamedevMcpEntry } = require("./gamedev-path-resolver");
const { probeGamedevBridgeForEngine } = require("./gamedev-bridge-probe");
const { ensureGamedevProjectReady } = require("./gamedev-project-bootstrap");
const { normalizeGamedevEngine } = require("./gamedev-config");

const execFileAsync = promisify(execFile);

async function buildGamedevMcpEntry(projectRoot) {
  const mcpRoot = path.join(projectRoot, "extensions", "gamedev-all-in-one");
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const execOptions = {
    cwd: mcpRoot,
    timeout: 120000,
    ...(process.platform === "win32" ? { shell: true } : {}),
  };

  if (!require("fs").existsSync(path.join(mcpRoot, "node_modules"))) {
    await execFileAsync(npm, ["ci"], execOptions);
  }
  await execFileAsync(npm, ["run", "build"], execOptions);
  return probeGamedevMcpEntry({});
}

async function fixGamedevSetup({ workspacePath, settings = {}, projectRoot = "" } = {}) {
  const resolved = String(workspacePath || settings.workspacePath || "").trim();
  const root = String(projectRoot || process.cwd()).trim();
  const engine = normalizeGamedevEngine(settings.gamedevActiveEngine || "unity");
  const steps = [];

  try {
    const probe = probeGamedevMcpEntry(settings);
    if (probe.ok) {
      steps.push({ id: "mcp-build", ok: true, message: "MCP entry mevcut" });
    } else {
      const build = await buildGamedevMcpEntry(root);
      steps.push({ id: "mcp-build", ok: build.ok, message: build.ok ? "MCP build OK" : build.error });
    }
  } catch (error) {
    steps.push({ id: "mcp-build", ok: false, message: error.message || "MCP build failed" });
  }

  if (resolved) {
    const bootstrap = await ensureGamedevProjectReady(resolved, settings, engine);
    steps.push({
      id: "project-bootstrap",
      ok: bootstrap.ok,
      message: bootstrap.ok ? `Bootstrap OK (${engine})` : bootstrap.error || "Bootstrap failed",
    });
    if (Array.isArray(bootstrap.steps)) {
      steps.push(...bootstrap.steps.map((step) => ({ ...step, id: `bootstrap-${step.id}` })));
    }
  } else {
    steps.push({ id: "mcp-config", ok: false, message: "Workspace secilmedi" });
  }

  const bridge = await probeGamedevBridgeForEngine(engine, { workspacePath: resolved });
  steps.push({
    id: `${engine}-bridge`,
    ok: bridge.ok,
    message: bridge.ok
      ? `${engine} bridge acik (${bridge.transport || "tcp"}:${bridge.port || "http"})`
      : bridge.summary || "Bridge probe",
  });

  const ok = steps.every((step) => step.ok || step.id.endsWith("-bridge") || step.id === "bootstrap-bridge-probe");
  return { ok, steps, engine, summary: ok ? "Game Dev kurulum tamamlandi." : "Bazi adimlar eksik — editor acik mi kontrol edin." };
}

module.exports = { fixGamedevSetup, buildGamedevMcpEntry };
