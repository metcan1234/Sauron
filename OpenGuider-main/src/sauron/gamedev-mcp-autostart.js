const fs = require("fs");
const path = require("path");
const http = require("http");
const { normalizeGamedevEngine } = require("./gamedev-config");
const { probeHttpEndpoint } = require("./gamedev-engine-discovery");
const { probeGamedevBridgeForEngine } = require("./gamedev-bridge-probe");

const UNITY_MCP_URL = "http://127.0.0.1:8080/mcp";
const FUNPLAY_MCP_URL = "http://127.0.0.1:8765/";

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function ensureUnityAutostartConfig(workspacePath) {
  const markerPath = path.join(String(workspacePath || "").trim(), ".sauron", "unity-mcp-autostart.json");
  writeJson(markerPath, {
    version: 1,
    autoStart: true,
    hint: "Coplay unity-mcp: Window → MCP for Unity → Start Server (8080)",
    packageId: "com.coplaydev.unity-mcp",
    updatedAt: new Date().toISOString(),
  });
  return markerPath;
}

function ensureFunplayAutostartConfig(workspacePath) {
  const resolved = String(workspacePath || "").trim();
  const settingsPath = path.join(resolved, "Saved", "FunplayMCP", "funplay_mcp_settings.json");
  const sauronMarker = path.join(resolved, ".sauron", "funplay-autostart.json");
  const existing = fs.existsSync(settingsPath)
    ? JSON.parse(fs.readFileSync(settingsPath, "utf8"))
    : {};
  const merged = {
    ...existing,
    url: existing.url || FUNPLAY_MCP_URL,
    auto_start: true,
    start_on_editor_load: true,
    sauron_autostart: true,
  };
  writeJson(settingsPath, merged);
  writeJson(sauronMarker, {
    version: 1,
    autoStart: true,
    settingsPath,
    updatedAt: new Date().toISOString(),
  });
  return { settingsPath, sauronMarker };
}

function postHttpJson(url, body = {}, timeoutMs = 1500) {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      resolve({ ok: false, error: "invalid-url" });
      return;
    }
    const payload = JSON.stringify(body);
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port || 80,
      path: `${parsed.pathname || "/"}${parsed.search || ""}`,
      method: "POST",
      timeout: timeoutMs,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    }, (res) => {
      res.resume();
      resolve({ ok: res.statusCode >= 200 && res.statusCode < 500, statusCode: res.statusCode });
    });
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, error: "timeout" });
    });
    req.on("error", (error) => resolve({ ok: false, error: error?.message || "error" }));
    req.write(payload);
    req.end();
  });
}

async function nudgeUnityMcpStart() {
  const attempts = [
    () => probeHttpEndpoint(UNITY_MCP_URL, 900),
    () => postHttpJson("http://127.0.0.1:8080/start", { action: "start" }),
    () => postHttpJson("http://127.0.0.1:8080/mcp", { jsonrpc: "2.0", method: "initialize", id: 1, params: {} }),
  ];
  for (const attempt of attempts) {
    const result = await attempt();
    if (result.ok) {
      return { ok: true, via: "unity-http", result };
    }
  }
  return { ok: false, error: "unity-mcp-nudge-failed" };
}

async function nudgeFunplayMcpStart(workspacePath) {
  const settingsPath = path.join(String(workspacePath || "").trim(), "Saved", "FunplayMCP", "funplay_mcp_settings.json");
  let baseUrl = FUNPLAY_MCP_URL;
  if (fs.existsSync(settingsPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
      baseUrl = String(raw.url || raw.base_url || baseUrl).trim() || baseUrl;
    } catch {
      // ignore
    }
  }
  const attempts = [
    () => probeHttpEndpoint(baseUrl, 900),
    () => postHttpJson(`${baseUrl.replace(/\/$/, "")}/start`, { action: "start" }),
    () => postHttpJson(`${baseUrl.replace(/\/$/, "")}/api/start`, {}),
    () => postHttpJson(`${baseUrl.replace(/\/$/, "")}/mcp`, { jsonrpc: "2.0", method: "initialize", id: 1, params: {} }),
  ];
  for (const attempt of attempts) {
    const result = await attempt();
    if (result.ok) {
      return { ok: true, via: "funplay-http", result };
    }
  }
  return { ok: false, error: "funplay-mcp-nudge-failed" };
}

async function tryStartEngineMcp(engine, workspacePath, settings = {}) {
  if (settings.gamedevAutoMcpStart === false) {
    return { ok: false, skipped: true, reason: "auto-mcp-start-disabled" };
  }

  const normalized = normalizeGamedevEngine(engine);
  const resolved = String(workspacePath || "").trim();

  if (normalized === "unity") {
    ensureUnityAutostartConfig(resolved);
    const nudge = await nudgeUnityMcpStart();
    const probe = await probeGamedevBridgeForEngine("unity", { workspacePath: resolved });
    return { ok: probe.ok, engine: normalized, nudge, probe };
  }

  if (normalized === "unreal") {
    ensureFunplayAutostartConfig(resolved);
    const nudge = await nudgeFunplayMcpStart(resolved);
    const probe = await probeGamedevBridgeForEngine("unreal", { workspacePath: resolved });
    return { ok: probe.ok, engine: normalized, nudge, probe };
  }

  return { ok: false, skipped: true, reason: "unsupported-engine" };
}

module.exports = {
  UNITY_MCP_URL,
  FUNPLAY_MCP_URL,
  ensureUnityAutostartConfig,
  ensureFunplayAutostartConfig,
  tryStartEngineMcp,
  nudgeUnityMcpStart,
  nudgeFunplayMcpStart,
};
