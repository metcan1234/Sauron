const net = require("net");
const { randomUUID } = require("crypto");
const { GAMEDEV_ENGINE_PORTS } = require("./gamedev-config");

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_TIMEOUT_MS = 8000;

function probeUnityBridge({ host = DEFAULT_HOST, port = GAMEDEV_ENGINE_PORTS.unity, timeoutMs = 2000 } = {}) {
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

function dispatchUnityCommand(method, params = {}, { host = DEFAULT_HOST, port = GAMEDEV_ENGINE_PORTS.unity, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
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

  const playResult = await dispatchUnityCommand("play_mode", { action });
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
    await dispatchUnityCommand("play_mode", { action: "stop" });
  }

  return { ok: true, skipped: false, result: playResult };
}

module.exports = {
  probeUnityBridge,
  dispatchUnityCommand,
  runUnityPlayModeVerification,
};
