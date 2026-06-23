const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function generateGooseHandoffId() {
  return `goose-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

function getGooseHandoffDir(workspacePath) {
  return path.join(String(workspacePath || "").trim(), ".sauron");
}

function writeGooseHandoff(workspacePath, { taskText, mode, sessionId } = {}) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    throw new Error("Workspace path is required.");
  }

  const handoffDir = getGooseHandoffDir(resolved);
  fs.mkdirSync(handoffDir, { recursive: true });

  const handoff = {
    id: generateGooseHandoffId(),
    timestamp: new Date().toISOString(),
    task: String(taskText || "").trim(),
    mode: String(mode || "balanced"),
    status: "pending",
    sessionId: String(sessionId || "").trim() || undefined,
  };

  const filePath = path.join(handoffDir, `${handoff.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(handoff, null, 2), "utf8");
  return { handoff, filePath };
}

function updateGooseHandoffStatus(workspacePath, handoffId, status, extra = {}) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved || !handoffId) {
    return false;
  }
  const filePath = path.join(getGooseHandoffDir(resolved), `${handoffId}.json`);
  if (!fs.existsSync(filePath)) {
    return false;
  }
  try {
    const current = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const next = {
      ...current,
      ...extra,
      status: String(status || current.status),
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(filePath, JSON.stringify(next, null, 2), "utf8");
    return true;
  } catch {
    return false;
  }
}

function listGooseHandoffs(workspacePath, { limit = 10 } = {}) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return [];
  }
  const handoffDir = getGooseHandoffDir(resolved);
  if (!fs.existsSync(handoffDir)) {
    return [];
  }

  const items = [];
  for (const entry of fs.readdirSync(handoffDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.startsWith("goose-") || !entry.name.endsWith(".json")) {
      continue;
    }
    const fullPath = path.join(handoffDir, entry.name);
    try {
      const parsed = JSON.parse(fs.readFileSync(fullPath, "utf8"));
      items.push({ ...parsed, filePath: fullPath });
    } catch {
      // skip
    }
  }

  items.sort((a, b) => Date.parse(b.timestamp || 0) - Date.parse(a.timestamp || 0));
  return items.slice(0, Math.max(1, limit));
}

module.exports = {
  generateGooseHandoffId,
  writeGooseHandoff,
  updateGooseHandoffStatus,
  listGooseHandoffs,
};
