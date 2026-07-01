const fs = require("fs");
const path = require("path");
const {
  GAMEDEV_MCP_SERVER_ID,
  GAMEDEV_NATIVE_MCP,
  buildEngineEnv,
  normalizeGamedevEngine,
} = require("./gamedev-config");
const { resolveGamedevMcpEntryPath } = require("./gamedev-path-resolver");
const { readFunplayMcpSettings } = require("./gamedev-engine-discovery");

function readJsonFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function writeJsonFile(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function buildMcpServerEntry(mcpEntryPath, engine, workspacePath, bridgePort = null) {
  const env = buildEngineEnv(engine, workspacePath, bridgePort);
  return {
    command: "node",
    args: [mcpEntryPath.replace(/\\/g, "/")],
    ...(Object.keys(env).length > 0 ? { env } : {}),
  };
}

function buildNativeEngineMcpServers(engine, workspacePath) {
  const normalized = normalizeGamedevEngine(engine);
  const servers = {};

  if (normalized === "unity") {
    const unity = GAMEDEV_NATIVE_MCP.unity;
    servers[unity.serverId] = {
      url: unity.httpUrl,
      type: "http",
    };
  }

  if (normalized === "unreal") {
    const unreal = GAMEDEV_NATIVE_MCP.unreal;
    const funplay = readFunplayMcpSettings(workspacePath);
    servers[unreal.serverId] = {
      command: unreal.command,
      args: [...unreal.args],
      env: {
        FUNPLAY_UNREAL_MCP_URL: funplay.url || unreal.defaultUrl,
        ...(funplay.token ? { FUNPLAY_UNREAL_MCP_TOKEN: funplay.token } : {}),
      },
    };
  }

  return servers;
}

function mergeMcpConfig(existing, serverEntries = {}) {
  const base = existing && typeof existing === "object" ? { ...existing } : {};
  const mcpServers = base.mcpServers && typeof base.mcpServers === "object"
    ? { ...base.mcpServers }
    : {};
  const servers = base.servers && typeof base.servers === "object"
    ? { ...base.servers }
    : {};

  for (const [serverId, entry] of Object.entries(serverEntries)) {
    if (!serverId || !entry) {
      continue;
    }
    if (entry.url || entry.type === "http") {
      servers[serverId] = entry;
    } else {
      mcpServers[serverId] = entry;
    }
  }

  return {
    ...base,
    ...(Object.keys(mcpServers).length > 0 ? { mcpServers } : {}),
    ...(Object.keys(servers).length > 0 ? { servers } : {}),
  };
}

function writeGamedevMcpConfig(workspacePath, settings = {}, engine = "unity", options = {}) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return { ok: false, error: "Workspace path is required." };
  }

  const mcpEntryPath = resolveGamedevMcpEntryPath(settings);
  if (!fs.existsSync(mcpEntryPath)) {
    return { ok: false, error: `MCP entry not found: ${mcpEntryPath}` };
  }

  const normalizedEngine = normalizeGamedevEngine(engine);
  const bridgePort = options.bridgePort || null;
  const serverEntries = {
    [GAMEDEV_MCP_SERVER_ID]: buildMcpServerEntry(mcpEntryPath, normalizedEngine, resolved, bridgePort),
    ...buildNativeEngineMcpServers(normalizedEngine, resolved),
  };

  const writtenPaths = [];
  const targets = [
    path.join(resolved, ".cursor", "mcp.json"),
    path.join(resolved, ".vscode", "mcp.json"),
    path.join(resolved, "mcp.json"),
    path.join(resolved, ".cline", "mcp.json"),
  ];

  for (const target of targets) {
    const merged = mergeMcpConfig(readJsonFile(target), serverEntries);
    writeJsonFile(target, merged);
    writtenPaths.push(target);
  }

  return {
    ok: true,
    mcpEntryPath,
    engine: normalizedEngine,
    writtenPaths,
    serverId: GAMEDEV_MCP_SERVER_ID,
    nativeServers: Object.keys(buildNativeEngineMcpServers(normalizedEngine, resolved)),
  };
}

module.exports = {
  buildMcpServerEntry,
  buildNativeEngineMcpServers,
  mergeMcpConfig,
  writeGamedevMcpConfig,
};
