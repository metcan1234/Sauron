const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function getCheckpointRoot(workspacePath) {
  return path.join(String(workspacePath || "").trim(), ".sauron", "code-checkpoints");
}

function listCheckpoints(workspacePath) {
  const root = getCheckpointRoot(workspacePath);
  if (!fs.existsSync(root)) {
    return [];
  }
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const metaPath = path.join(root, entry.name, "meta.json");
      let meta = { id: entry.name, createdAt: null, label: entry.name };
      try {
        meta = { ...meta, ...JSON.parse(fs.readFileSync(metaPath, "utf8")) };
      } catch {
        // ignore
      }
      return meta;
    })
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

function createCheckpoint(workspacePath, { label = "auto", files = [] } = {}) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return { ok: false, error: "Workspace path required." };
  }
  const id = crypto.randomUUID();
  const dir = path.join(getCheckpointRoot(resolved), id);
  fs.mkdirSync(dir, { recursive: true });
  const saved = [];
  for (const filePath of files) {
    const rel = String(filePath || "").trim();
    if (!rel) continue;
    const source = path.join(resolved, rel);
    if (!fs.existsSync(source)) continue;
    const target = path.join(dir, "files", rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    saved.push(rel);
  }
  const meta = {
    id,
    label,
    createdAt: new Date().toISOString(),
    files: saved,
  };
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2), "utf8");
  return { ok: true, checkpoint: meta };
}

function rollbackCheckpoint(workspacePath, checkpointId) {
  const resolved = String(workspacePath || "").trim();
  const id = String(checkpointId || "").trim();
  if (!resolved || !id) {
    return { ok: false, error: "Workspace and checkpoint id required." };
  }
  const dir = path.join(getCheckpointRoot(resolved), id);
  const metaPath = path.join(dir, "meta.json");
  if (!fs.existsSync(metaPath)) {
    return { ok: false, error: "Checkpoint not found." };
  }
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  const restored = [];
  for (const rel of meta.files || []) {
    const source = path.join(dir, "files", rel);
    const target = path.join(resolved, rel);
    if (!fs.existsSync(source)) continue;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    restored.push(rel);
  }
  return { ok: true, restored, checkpoint: meta };
}

module.exports = {
  getCheckpointRoot,
  listCheckpoints,
  createCheckpoint,
  rollbackCheckpoint,
};
