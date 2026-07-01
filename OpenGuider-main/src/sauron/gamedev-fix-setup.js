const { execFile } = require("child_process");
const { promisify } = require("util");
const path = require("path");
const { writeGamedevMcpConfig } = require("./gamedev-mcp-config");
const { probeGamedevMcpEntry } = require("./gamedev-path-resolver");
const { probeGamedevBridgePorts } = require("./gamedev-bridge-probe");

const execFileAsync = promisify(execFile);

async function buildGamedevMcpEntry(projectRoot) {
  const mcpRoot = path.join(projectRoot, "extensions", "gamedev-all-in-one");
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  await execFileAsync(npm, ["run", "build"], { cwd: mcpRoot, timeout: 120000 });
  return probeGamedevMcpEntry({});
}

async function fixGamedevSetup({ workspacePath, settings = {}, projectRoot = "" } = {}) {
  const resolved = String(workspacePath || settings.workspacePath || "").trim();
  const root = String(projectRoot || process.cwd()).trim();
  const steps = [];

  try {
    const build = await buildGamedevMcpEntry(root);
    steps.push({ id: "mcp-build", ok: build.ok, message: build.ok ? "MCP build OK" : build.error });
  } catch (error) {
    steps.push({ id: "mcp-build", ok: false, message: error.message || "MCP build failed" });
  }

  if (resolved) {
    const config = writeGamedevMcpConfig(resolved, settings, settings.gamedevActiveEngine || "unity");
    steps.push({
      id: "mcp-config",
      ok: config.ok,
      message: config.ok ? `MCP config yazildi (${config.writtenPaths?.length || 0})` : config.error,
    });
  } else {
    steps.push({ id: "mcp-config", ok: false, message: "Workspace secilmedi" });
  }

  const bridge = await probeGamedevBridgePorts();
  steps.push({
    id: "unity-bridge",
    ok: bridge.ok,
    message: bridge.summary || "Bridge probe",
  });

  const ok = steps.every((step) => step.ok || step.id === "unity-bridge");
  return { ok, steps };
}

module.exports = { fixGamedevSetup, buildGamedevMcpEntry };
