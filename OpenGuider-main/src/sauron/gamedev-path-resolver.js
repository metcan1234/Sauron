const fs = require("fs");
const { getDefaultGamedevMcpEntryPath } = require("./gamedev-config");

function resolveGamedevMcpEntryPath(settings = {}) {
  const custom = String(settings.gamedevMcpEntryPath || "").trim();
  if (custom) {
    try {
      if (fs.existsSync(custom)) {
        return custom;
      }
    } catch {
      // fall through
    }
  }

  const fallback = getDefaultGamedevMcpEntryPath();
  try {
    if (fs.existsSync(fallback)) {
      return fallback;
    }
  } catch {
    // fall through
  }

  return custom || fallback;
}

function probeGamedevMcpEntry(settings = {}) {
  const entryPath = resolveGamedevMcpEntryPath(settings);
  let exists = false;
  try {
    exists = fs.existsSync(entryPath);
  } catch {
    exists = false;
  }

  return {
    entryPath,
    exists,
    ok: exists,
    error: exists ? null : `gamedev-all-in-one MCP girişi bulunamadı: ${entryPath}`,
  };
}

module.exports = {
  resolveGamedevMcpEntryPath,
  probeGamedevMcpEntry,
};
