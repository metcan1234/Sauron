const net = require("net");
const { randomUUID } = require("crypto");
const { GAMEDEV_ENGINE_PORTS } = require("./gamedev-config");

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

function probeUnityBridge({ host = DEFAULT_HOST, port = GAMEDEV_ENGINE_PORTS.unity, timeoutMs = 2000 } = {}) {
  return probeBridge({ host, port, timeoutMs });
}

function probeUnrealBridge({ host = DEFAULT_HOST, port = GAMEDEV_ENGINE_PORTS.unreal, timeoutMs = 2000 } = {}) {
  return probeBridge({ host, port, timeoutMs });
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
      finish({ ok: false, skipped: false, error: "Unity MCP command timeout", method });
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

async function runUnityPlayModeVerification(action = "play") {
  const probe = await probeUnityBridge();
  if (!probe.connected) {
    return {
      ok: true,
      skipped: true,
      warn: probe.error || "Unity bridge not connected",
    };
  }

  const playResult = await dispatchBridgeCommand("play_mode", { action }, { port: GAMEDEV_ENGINE_PORTS.unity });
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
    await dispatchBridgeCommand("play_mode", { action: "stop" }, { port: GAMEDEV_ENGINE_PORTS.unity });
  }

  return { ok: true, skipped: false, result: playResult };
}

async function runUnrealPlayModeVerification(action = "play") {
  const probe = await probeUnrealBridge();
  if (!probe.connected) {
    return {
      ok: true,
      skipped: true,
      warn: probe.error || "Unreal bridge not connected",
    };
  }

  const playResult = await dispatchBridgeCommand("play_mode", { action }, { port: GAMEDEV_ENGINE_PORTS.unreal });
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
    await dispatchBridgeCommand("play_mode", { action: "stop" }, { port: GAMEDEV_ENGINE_PORTS.unreal });
  }

  return { ok: true, skipped: false, result: playResult };
}

function dispatchUnityCommand(method, params = {}, options = {}) {
  return dispatchBridgeCommand(method, params, { ...options, port: options.port || GAMEDEV_ENGINE_PORTS.unity });
}

module.exports = {
  probeBridge,
  probeUnityBridge,
  probeUnrealBridge,
  dispatchBridgeCommand,
  dispatchUnityCommand,
  runUnityPlayModeVerification,
  runUnrealPlayModeVerification,
};
