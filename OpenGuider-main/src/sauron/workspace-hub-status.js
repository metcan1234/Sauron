const fs = require("fs");
const path = require("path");
const { loadBrief } = require("./web-studio/brief-schema");
const { readPipelineState, readTaskCompleteArtifact } = require("./build-pipeline/pipeline-state");
const { listHandoffHistory } = require("./handoff");

const HANDOFF_STATUS_TR = {
  pending: "bekliyor",
  consumed: "tamamlandı",
  rejected: "reddedildi",
  not_found: "bulunamadı",
  unknown: "bilinmiyor",
};

function basenameOnly(filePath) {
  return path.basename(String(filePath || ""));
}

function resolveProjectLabel(workspacePath) {
  const briefResult = loadBrief(workspacePath);
  if (briefResult.ok && briefResult.brief?.companyName) {
    return briefResult.brief.companyName;
  }
  return path.basename(String(workspacePath || "").trim()) || "Çalışma Kısmı";
}

function resolveLatestHandoff(workspacePath) {
  const items = listHandoffHistory(workspacePath, { limit: 5 });
  if (!items.length) {
    return null;
  }
  const latest = items[0];
  const sauronDir = path.join(workspacePath, ".sauron");
  let suffix = "";
  if (latest.status === "consumed") suffix = ".consumed";
  else if (latest.status === "rejected") suffix = ".rejected";
  const fullPath = path.join(sauronDir, `${latest.fileName}${suffix}`);
  try {
    const parsed = JSON.parse(fs.readFileSync(fullPath, "utf8"));
    latest.relevantFiles = Array.isArray(parsed.relevantFiles) ? parsed.relevantFiles : [];
  } catch {
    latest.relevantFiles = [];
  }
  return latest;
}

function resolveHandoffStatusLabel(latestHandoff, taskComplete) {
  if (!latestHandoff) {
    return null;
  }
  const raw = String(latestHandoff.status || "unknown");
  if (taskComplete && raw === "consumed") {
    return "Cline'da tamamlandı";
  }
  if (raw === "pending" && taskComplete) {
    return "Cline'da";
  }
  return HANDOFF_STATUS_TR[raw] || raw;
}

function collectRecentFileNames(workspacePath, latestHandoff) {
  const names = new Set();

  if (Array.isArray(latestHandoff?.relevantFiles)) {
    for (const file of latestHandoff.relevantFiles.slice(0, 3)) {
      names.add(basenameOnly(file));
    }
  }

  const sauronDir = path.join(workspacePath, ".sauron");
  if (fs.existsSync(sauronDir)) {
    const entries = fs.readdirSync(sauronDir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => ({
        name: entry.name,
        mtime: fs.statSync(path.join(sauronDir, entry.name)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 3);
    for (const entry of entries) {
      names.add(entry.name);
    }
  }

  return Array.from(names).slice(0, 3);
}

function getWorkspaceHubStatus(workspacePath, options = {}) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return { ok: false, error: "Workspace path is missing." };
  }

  const pipeline = readPipelineState(resolved);
  const taskComplete = readTaskCompleteArtifact(resolved);
  const latestHandoff = resolveLatestHandoff(resolved);
  const projectLabel = resolveProjectLabel(resolved);
  const handoffStatus = resolveHandoffStatusLabel(latestHandoff, taskComplete);
  const recentFiles = collectRecentFileNames(resolved, latestHandoff);

  const parts = [];
  if (handoffStatus) {
    parts.push(`Son handoff: ${handoffStatus}`);
  }
  if (pipeline && pipeline.status === "active") {
    parts.push(`Üretim hattı: faz ${pipeline.currentPhase || "?"}/${pipeline.totalPhases || "?"}`);
  } else if (pipeline?.status === "completed") {
    parts.push("Üretim hattı: tamamlandı");
  }
  if (recentFiles.length) {
    parts.push(`Son dosyalar: ${recentFiles.join(", ")}`);
  }

  const summaryLine = parts.join(" · ");
  const shouldShow = Boolean(
    options.forceShow
    || handoffStatus === "bekliyor"
    || (pipeline && pipeline.status === "active")
    || taskComplete,
  );

  let tone = "default";
  if (handoffStatus === "bekliyor") {
    tone = "warning";
  } else if (taskComplete || handoffStatus === "tamamlandı" || handoffStatus === "Cline'da tamamlandı") {
    tone = "success";
  }

  return {
    ok: true,
    projectLabel,
    handoffStatus,
    handoffFileName: latestHandoff?.fileName || "",
    pipeline: pipeline
      ? {
        id: pipeline.templateId || pipeline.pipelineId || "",
        status: pipeline.status || "",
        currentPhase: pipeline.currentPhase,
        totalPhases: pipeline.totalPhases,
        label: pipeline.label || "",
      }
      : null,
    recentFiles,
    summaryLine,
    shouldShow,
    tone,
    pendingComplete: Boolean(taskComplete),
    clineTaskComplete: Boolean(taskComplete),
  };
}

module.exports = {
  HANDOFF_STATUS_TR,
  getWorkspaceHubStatus,
};
