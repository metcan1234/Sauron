const fs = require("fs");
const path = require("path");

const MEMORY_FILENAME = "project-memory.json";
const MAX_TASKS = 10;

function getMemoryPath(workspacePath) {
  return path.join(String(workspacePath || "").trim(), ".sauron", MEMORY_FILENAME);
}

function defaultMemory() {
  return {
    version: 1,
    activeProjectLabel: "",
    themeId: "",
    pipelinePhase: null,
    pipelineId: "",
    tasks: [],
    updatedAt: new Date().toISOString(),
  };
}

function readMemory(workspacePath) {
  const memoryPath = getMemoryPath(workspacePath);
  if (!fs.existsSync(memoryPath)) {
    return defaultMemory();
  }
  try {
    const raw = JSON.parse(fs.readFileSync(memoryPath, "utf8"));
    return {
      ...defaultMemory(),
      ...raw,
      tasks: Array.isArray(raw.tasks) ? raw.tasks.slice(0, MAX_TASKS) : [],
    };
  } catch {
    return defaultMemory();
  }
}

function writeMemory(workspacePath, memory) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return { ok: false, error: "Workspace path is missing." };
  }
  const sauronDir = path.join(resolved, ".sauron");
  fs.mkdirSync(sauronDir, { recursive: true });
  const next = {
    ...memory,
    tasks: (memory.tasks || []).slice(0, MAX_TASKS),
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(getMemoryPath(resolved), `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return { ok: true, path: getMemoryPath(resolved) };
}

function isProjectMemoryEnabled(settings = {}) {
  return settings.projectMemoryEnabled !== false;
}

function recordTask(workspacePath, entry = {}, settings = {}) {
  if (!isProjectMemoryEnabled(settings)) {
    return { ok: false, skipped: true };
  }
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return { ok: false, error: "Workspace path is missing." };
  }

  const summary = String(entry.summary || entry.goal || "").trim().slice(0, 160);
  if (!summary) {
    return { ok: false, error: "Task summary is empty." };
  }

  const memory = readMemory(resolved);
  memory.activeProjectLabel = String(
    entry.projectLabel || memory.activeProjectLabel || "",
  ).trim().slice(0, 96);
  if (entry.themeId) {
    memory.themeId = String(entry.themeId).trim();
  }
  if (entry.pipelinePhase != null) {
    memory.pipelinePhase = entry.pipelinePhase;
  }
  if (entry.pipelineId) {
    memory.pipelineId = String(entry.pipelineId).trim();
  }

  memory.tasks = [
    {
      summary,
      at: new Date().toISOString(),
      handoffId: entry.handoffId || "",
    },
    ...memory.tasks.filter((task) => task.summary !== summary),
  ].slice(0, MAX_TASKS);

  return writeMemory(resolved, memory);
}

function buildMemorySummaryBlock(workspacePath, settings = {}) {
  if (!isProjectMemoryEnabled(settings)) {
    return "";
  }
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return "";
  }

  const memory = readMemory(resolved);
  const lines = [];
  if (memory.activeProjectLabel) {
    lines.push(`Proje: ${memory.activeProjectLabel}`);
  }
  if (memory.themeId) {
    lines.push(`Tema: ${memory.themeId}`);
  }
  if (memory.pipelineId && memory.pipelinePhase != null) {
    lines.push(`Üretim hattı: ${memory.pipelineId} — faz ${memory.pipelinePhase}`);
  }
  const recent = memory.tasks.slice(0, 3).map((task) => `- ${task.summary}`);
  if (recent.length) {
    lines.push(`Son görevler:\n${recent.join("\n")}`);
  }
  if (!lines.length) {
    return "";
  }
  return `Proje hafızası (disk):\n${lines.join("\n")}`;
}

module.exports = {
  MEMORY_FILENAME,
  getMemoryPath,
  defaultMemory,
  readMemory,
  writeMemory,
  isProjectMemoryEnabled,
  recordTask,
  buildMemorySummaryBlock,
};
