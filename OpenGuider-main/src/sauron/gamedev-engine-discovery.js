const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");
const {
  getBridgeProbeProfile,
  normalizeGamedevEngine,
  GAMEDEV_ENGINE_PORTS,
} = require("./gamedev-config");

function detectProjectEngine(workspacePath) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved || !fs.existsSync(resolved)) {
    return { engine: null, reason: "missing-workspace" };
  }

  const uproject = fs.readdirSync(resolved, { withFileTypes: true })
    .find((entry) => entry.isFile() && entry.name.endsWith(".uproject"));
  if (uproject) {
    return { engine: "unreal", reason: "uproject", marker: uproject.name };
  }

  if (fs.existsSync(path.join(resolved, "ProjectSettings", "ProjectVersion.txt"))) {
    return { engine: "unity", reason: "project-settings" };
  }

  if (fs.existsSync(path.join(resolved, "Assets"))) {
    return { engine: "unity", reason: "assets-folder" };
  }

  return { engine: null, reason: "unknown" };
}

function readFunplayMcpSettings(workspacePath) {
  const settingsPath = path.join(
    String(workspacePath || "").trim(),
    "Saved",
    "FunplayMCP",
    "funplay_mcp_settings.json",
  );
  try {
    if (!fs.existsSync(settingsPath)) {
      return { ok: false, settingsPath, url: null, token: null };
    }
    const raw = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    const url = String(raw?.url || raw?.base_url || raw?.endpoint || "").trim()
      || "http://127.0.0.1:8765/";
    const token = String(raw?.token || raw?.auth_token || "").trim();
    return { ok: true, settingsPath, url, token, raw };
  } catch (error) {
    return { ok: false, settingsPath, url: null, token: null, error: error?.message || "read-failed" };
  }
}

function probeHttpEndpoint(url, timeoutMs = 900) {
  return new Promise((resolve) => {
    const target = String(url || "").trim();
    if (!target) {
      resolve({ ok: false, error: "empty-url" });
      return;
    }

    let parsed;
    try {
      parsed = new URL(target);
    } catch {
      resolve({ ok: false, error: "invalid-url" });
      return;
    }

    const lib = parsed.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: `${parsed.pathname || "/"}${parsed.search || ""}`,
        method: "GET",
        timeout: timeoutMs,
        headers: { Accept: "*/*" },
      },
      (res) => {
        res.resume();
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 500,
          statusCode: res.statusCode,
          url: target,
        });
      },
    );

    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, error: "http-timeout", url: target });
    });
    req.on("error", (error) => {
      resolve({ ok: false, error: error?.message || "http-error", url: target });
    });
    req.end();
  });
}

function probeTcpPort(host, port, timeoutMs = 800) {
  const net = require("net");
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
    socket.once("connect", () => finish({ ok: true, host, port }));
    socket.once("timeout", () => finish({ ok: false, host, port, error: "timeout" }));
    socket.once("error", (error) => finish({ ok: false, host, port, error: error?.message || "error" }));
    try {
      socket.connect(port, host);
    } catch (error) {
      finish({ ok: false, host, port, error: error?.message || "connect-failed" });
    }
  });
}

async function probeEngineBridge(engine, options = {}) {
  const normalized = normalizeGamedevEngine(engine);
  const host = String(options.host || "127.0.0.1").trim();
  const workspacePath = String(options.workspacePath || "").trim();
  const profile = getBridgeProbeProfile(normalized);
  const results = [];

  if (normalized === "unreal" && workspacePath) {
    const funplay = readFunplayMcpSettings(workspacePath);
    if (funplay.url) {
      const httpProbe = await probeHttpEndpoint(funplay.url, options.timeoutMs || 900);
      results.push({
        ...httpProbe,
        kind: "http",
        label: "Funplay settings URL",
        port: null,
        funplay: true,
      });
      if (httpProbe.ok) {
        return {
          ok: true,
          engine: normalized,
          host,
          connected: true,
          transport: "http",
          endpoint: funplay.url,
          token: funplay.token || null,
          port: null,
          results,
        };
      }
    }
  }

  for (const entry of profile) {
    if (entry.kind === "http") {
      const url = `http://${host}:${entry.port}/`;
      const httpProbe = await probeHttpEndpoint(url, options.timeoutMs || 900);
      results.push({ ...httpProbe, kind: "http", label: entry.label, port: entry.port });
      if (httpProbe.ok) {
        return {
          ok: true,
          engine: normalized,
          host,
          connected: true,
          transport: "http",
          endpoint: `http://${host}:${entry.port}/mcp`,
          port: entry.port,
          results,
        };
      }
      continue;
    }

    const tcpProbe = await probeTcpPort(host, entry.port, options.timeoutMs || 800);
    results.push({ ...tcpProbe, kind: "tcp", label: entry.label, port: entry.port });
    if (tcpProbe.ok) {
      return {
        ok: true,
        engine: normalized,
        host,
        connected: true,
        transport: "tcp",
        port: entry.port,
        results,
      };
    }
  }

  return {
    ok: false,
    engine: normalized,
    host,
    connected: false,
    transport: null,
    port: GAMEDEV_ENGINE_PORTS[normalized] || null,
    results,
    summary: results.map((r) => `${r.label || r.kind}:${r.port || r.url || "?"}=${r.ok ? "open" : "closed"}`).join(", "),
  };
}

module.exports = {
  detectProjectEngine,
  readFunplayMcpSettings,
  probeHttpEndpoint,
  probeTcpPort,
  probeEngineBridge,
};
