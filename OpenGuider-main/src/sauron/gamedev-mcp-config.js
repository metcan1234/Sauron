const fs = require("fs");
const path = require("path");
const {
  GAMEDEV_MCP_SERVER_ID,
  buildEngineEnv,
  normalizeGamedevEngine,
} = require("./gamedev-config");
const { resolveGamedevMcpEntryPath } = require("./gamedev-path-resolver");

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

function buildMcpServerEntry(mcpEntryPath, engine, workspacePath) {
  const env = buildEngineEnv(engine, workspacePath);
  return {
    command: "node",
    args: [mcpEntryPath.replace(/\\/g, "/")],
    ...(Object.keys(env).length > 0 ? { env } : {}),
  };
}

function mergeMcpConfig(existing, serverEntry) {
  const base = existing && typeof existing === "object" ? { ...existing } : {};
  const servers = base.mcpServers && typeof base.mcpServers === "object"
    ? { ...base.mcpServers }
    : {};
  servers[GAMEDEV_MCP_SERVER_ID] = serverEntry;
  return {
    ...base,
    mcpServers: servers,
  };
}

function writeGamedevMcpConfig(workspacePath, settings = {}, engine = "unity") {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return { ok: false, error: "Workspace path is required." };
  }

  const mcpEntryPath = resolveGamedevMcpEntryPath(settings);
  if (!fs.existsSync(mcpEntryPath)) {
    return { ok: false, error: `MCP entry not found: ${mcpEntryPath}` };
  }

  const normalizedEngine = normalizeGamedevEngine(engine);
  const serverEntry = buildMcpServerEntry(mcpEntryPath, normalizedEngine, resolved);
  const writtenPaths = [];

  const targets = [
    path.join(resolved, ".cursor", "mcp.json"),
    path.join(resolved, ".vscode", "mcp.json"),
    path.join(resolved, "mcp.json"),
    path.join(resolved, ".cline", "mcp.json"),
  ];

  for (const target of targets) {
    const merged = mergeMcpConfig(readJsonFile(target), serverEntry);
    writeJsonFile(target, merged);
    writtenPaths.push(target);
  }

  return {
    ok: true,
    mcpEntryPath,
    engine: normalizedEngine,
    writtenPaths,
    serverId: GAMEDEV_MCP_SERVER_ID,
  };
}

module.exports = {
  buildMcpServerEntry,
  mergeMcpConfig,
  writeGamedevMcpConfig,
};
