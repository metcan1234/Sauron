const net = require("net");
const { randomUUID } = require("crypto");
const { GAMEDEV_ENGINE_PORTS, getBridgeProbeProfile } = require("./gamedev-config");
const { probeEngineBridge } = require("./gamedev-engine-discovery");

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_TIMEOUT_MS = 8000;

function probeBridge({ host = DEFAULT_HOST, port, timeoutMs = 2000 } = {}) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      try {
        socket.destroy();
      } catch {
        // ignore
      }
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish({ ok: true, connected: true, host, port }));
    socket.once("timeout", () => finish({ ok: false, connected: false, error: "Bridge probe timeout" }));
    socket.once("error", (error) => finish({ ok: false, connected: false, error: error?.message || "Bridge unreachable" }));
    socket.connect(port, host);
  });
}

async function probeUnityBridge(options = {}) {
  const probe = await probeEngineBridge("unity", options);
  return {
    ok: probe.ok,
    connected: probe.connected === true,
    host: probe.host || DEFAULT_HOST,
    port: probe.port || GAMEDEV_ENGINE_PORTS.unity,
    transport: probe.transport || null,
    endpoint: probe.endpoint || null,
    error: probe.ok ? null : probe.summary || "Unity bridge unreachable",
  };
}

async function probeUnrealBridge(options = {}) {
  const probe = await probeEngineBridge("unreal", options);
  return {
    ok: probe.ok,
    connected: probe.connected === true,
    host: probe.host || DEFAULT_HOST,
    port: probe.port || GAMEDEV_ENGINE_PORTS.unreal,
    transport: probe.transport || null,
    endpoint: probe.endpoint || null,
    error: probe.ok ? null : probe.summary || "Unreal bridge unreachable",
  };
}

function resolveUnityTcpPort() {
  const profile = getBridgeProbeProfile("unity");
  const tcp = profile.find((entry) => entry.kind === "tcp");
  return tcp?.port || GAMEDEV_ENGINE_PORTS.unity;
}

function resolveUnrealTcpPort() {
  const profile = getBridgeProbeProfile("unreal");
  const tcp = profile.find((entry) => entry.kind === "tcp");
  return tcp?.port || GAMEDEV_ENGINE_PORTS.unreal;
}

function dispatchBridgeCommand(method, params = {}, { host = DEFAULT_HOST, port = GAMEDEV_ENGINE_PORTS.unity, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const id = randomUUID();
    let buffer = "";
    let settled = false;

    const finish = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      try {
        socket.destroy();
      } catch {
        // ignore
      }
      resolve(result);
    };

    const timer = setTimeout(() => {
      finish({ ok: false, skipped: false, error: "MCP command timeout", method });
    }, timeoutMs);

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }
        try {
          const resp = JSON.parse(trimmed);
          if (resp.id === id) {
            clearTimeout(timer);
            finish({
              ok: resp.status === "ok",
              method,
              result: resp.result,
              error: resp.error,
            });
            return;
          }
        } catch {
          // ignore partial JSON
        }
      }
    });

    socket.once("error", (error) => {
      clearTimeout(timer);
      finish({ ok: false, error: error?.message || "Bridge socket error", method });
    });

    socket.connect(port, host, () => {
      const payload = JSON.stringify({ id, method, params });
      socket.write(`${payload}\n`);
    });
  });
}

async function runUnityPlayModeVerification(action = "play", options = {}) {
  const probe = await probeUnityBridge(options);
  if (!probe.connected) {
    return {
      ok: true,
      skipped: true,
      warn: probe.error || "Unity bridge not connected",
    };
  }

  if (probe.transport === "http") {
    return { ok: true, skipped: true, warn: "Unity HTTP MCP active — use Cline/unityMCP for play mode" };
  }

  const port = probe.port || resolveUnityTcpPort();
  const playResult = await dispatchBridgeCommand("play_mode", { action }, { port, host: probe.host });
  if (!playResult.ok) {
    return {
      ok: false,
      skipped: false,
      error: playResult.error || "unity_play_mode failed",
      result: playResult,
    };
  }

  if (action === "play") {
    await new Promise((r) => setTimeout(r, 1500));
    await dispatchBridgeCommand("play_mode", { action: "stop" }, { port, host: probe.host });
  }

  return { ok: true, skipped: false, result: playResult };
}

async function runUnrealPlayModeVerification(action = "play", options = {}) {
  const probe = await probeUnrealBridge(options);
  if (!probe.connected) {
    return {
      ok: true,
      skipped: true,
      warn: probe.error || "Unreal bridge not connected",
    };
  }

  if (probe.transport === "http") {
    return { ok: true, skipped: true, warn: "Unreal HTTP MCP active — use funplay-unreal play_in_editor tool" };
  }

  const port = probe.port || resolveUnrealTcpPort();
  const playResult = await dispatchBridgeCommand("play_mode", { action }, { port, host: probe.host });
  if (!playResult.ok) {
    return {
      ok: false,
      skipped: false,
      error: playResult.error || "unreal_play_mode failed",
      result: playResult,
    };
  }

  if (action === "play") {
    await new Promise((r) => setTimeout(r, 1500));
    await dispatchBridgeCommand("play_mode", { action: "stop" }, { port, host: probe.host });
  }

  return { ok: true, skipped: false, result: playResult };
}

function dispatchUnityCommand(method, params = {}, options = {}) {
  const port = options.port || resolveUnityTcpPort();
  return dispatchBridgeCommand(method, params, { ...options, port });
}

function dispatchUnrealCommand(method, params = {}, options = {}) {
  const port = options.port || resolveUnrealTcpPort();
  return dispatchBridgeCommand(method, params, { ...options, port });
}

module.exports = {
  probeBridge,
  probeUnityBridge,
  probeUnrealBridge,
  dispatchBridgeCommand,
  dispatchUnityCommand,
  dispatchUnrealCommand,
  runUnityPlayModeVerification,
  runUnrealPlayModeVerification,
};
