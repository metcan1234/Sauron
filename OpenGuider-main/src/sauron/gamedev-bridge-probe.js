const { spawnSync } = require("child_process");
const { probeEngineBridge, probeTcpPort } = require("./gamedev-engine-discovery");
const { getBridgeProbeProfile, normalizeGamedevEngine } = require("./gamedev-config");

function probeTcpPortSync(host = "127.0.0.1", port = 7890, timeoutMs = 700) {
  if (process.platform === "win32") {
    const result = spawnSync("powershell", [
      "-NoProfile",
      "-Command",
      `$r = Test-NetConnection -ComputerName ${host} -Port ${port} -WarningAction SilentlyContinue; if ($r.TcpTestSucceeded) { exit 0 } else { exit 1 }`,
    ], { timeout: timeoutMs + 400, stdio: "ignore" });
    return result.status === 0;
  }

  const result = spawnSync("bash", ["-c", `echo >/dev/tcp/${host}/${port}`], {
    timeout: timeoutMs,
    stdio: "ignore",
  });
  return result.status === 0;
}

async function probeGamedevBridgePorts(host = "127.0.0.1", engine = null, workspacePath = "") {
  const engines = engine
    ? [normalizeGamedevEngine(engine)]
    : ["unity", "unreal"];

  const results = [];
  for (const entry of engines) {
    const probe = await probeEngineBridge(entry, { host, workspacePath });
    results.push({
      engine: entry,
      ...probe,
    });
  }

  const anyOpen = results.some((entry) => entry.ok);
  return {
    ok: anyOpen,
    host,
    results,
    summary: results
      .map((entry) => `${entry.engine}=${entry.ok ? entry.transport || "open" : "closed"}`)
      .join(", "),
  };
}

async function probeGamedevBridgeForEngine(engine, options = {}) {
  return probeEngineBridge(normalizeGamedevEngine(engine), options);
}

function buildLegacyDefaultTcpPorts() {
  return getBridgeProbeProfile("unity")
    .filter((entry) => entry.kind === "tcp")
    .concat(getBridgeProbeProfile("unreal").filter((entry) => entry.kind === "tcp"));
}

module.exports = {
  buildLegacyDefaultTcpPorts,
  probeTcpPort,
  probeTcpPortSync,
  probeGamedevBridgePorts,
  probeGamedevBridgeForEngine,
};
