const net = require("net");
const { spawnSync } = require("child_process");

const DEFAULT_TCP_PORTS = [
  { port: 7890, label: "Unity MCP bridge" },
  { port: 55557, label: "Unreal MCP bridge" },
];

function probeTcpPort(host, port, timeoutMs = 800) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch {
        // ignore
      }
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish({ ok: true, port, host }));
    socket.once("timeout", () => finish({ ok: false, port, host, error: "timeout" }));
    socket.once("error", (error) => finish({ ok: false, port, host, error: error?.message || "error" }));

    try {
      socket.connect(port, host);
    } catch (error) {
      finish({ ok: false, port, host, error: error?.message || "connect-failed" });
    }
  });
}

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

async function probeGamedevBridgePorts(host = "127.0.0.1", ports = DEFAULT_TCP_PORTS) {
  const results = [];
  for (const entry of ports) {
    const probe = await probeTcpPort(host, entry.port);
    results.push({
      ...probe,
      label: entry.label,
    });
  }
  const anyOpen = results.some((entry) => entry.ok);
  return {
    ok: anyOpen,
    host,
    results,
    summary: results.map((entry) => `${entry.label}:${entry.port}=${entry.ok ? "open" : "closed"}`).join(", "),
  };
}

module.exports = {
  DEFAULT_TCP_PORTS,
  probeTcpPort,
  probeTcpPortSync,
  probeGamedevBridgePorts,
};
