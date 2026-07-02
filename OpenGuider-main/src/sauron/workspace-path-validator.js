const fs = require("fs");
const os = require("os");
const path = require("path");
const { detectWorkspaceLayout } = require("./workspace-detector");

function normalizePathForCompare(workspacePath) {
  return String(workspacePath || "").trim().toLowerCase().replace(/\//g, "\\");
}

function isTempWorkspacePath(workspacePath) {
  const lower = normalizePathForCompare(workspacePath);
  if (!lower) {
    return false;
  }
  return (
    lower.includes("\\temp\\")
    || lower.includes("\\tmp\\")
    || lower.includes("sauron-temp")
    || lower.includes("\\appdata\\local\\temp\\")
  );
}

function getDefaultWorkspacePath() {
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  const candidates = [
    path.join(localAppData, "Sauron", "workspace"),
    path.join(os.homedir(), "Documents", "SauronWorkspace"),
    path.join(os.homedir(), "Desktop", "SauronWorkspace"),
  ];
  for (const candidate of candidates) {
    try {
      const parent = path.dirname(candidate);
      if (fs.existsSync(parent)) {
        return candidate;
      }
    } catch {
      // try next
    }
  }
  return candidates[0];
}

function ensureDefaultWorkspaceDir() {
  const target = getDefaultWorkspacePath();
  fs.mkdirSync(target, { recursive: true });
  const readmePath = path.join(target, "README.md");
  if (!fs.existsSync(readmePath)) {
    fs.writeFileSync(
      readmePath,
      "# Sauron Workspace\n\nBu klasör Goose, Game Dev ve Çalışma Kısmı (⌘) için varsayılan proje alanıdır.\nUnity/Unreal projen varsa Ayarlar → Çalışma Kısmı'ndan o klasörü seç.\n",
      "utf8",
    );
  }
  return target;
}

function describeWorkspacePathIssue(workspacePath) {
  const trimmed = String(workspacePath || "").trim();
  if (!trimmed) {
    return { valid: false, issue: "empty", message: "Workspace path ayarlanmamış." };
  }
  if (isTempWorkspacePath(trimmed)) {
    return { valid: false, issue: "temp", message: "Workspace geçici (temp) klasörde." };
  }
  if (!fs.existsSync(trimmed)) {
    return { valid: false, issue: "missing", message: "Workspace klasörü bulunamadı." };
  }
  const layout = detectWorkspaceLayout(trimmed);
  if (layout.isOpenGuider || layout.layout === "electron-core") {
    return {
      valid: false,
      issue: "sauron-source",
      message: "Workspace Sauron kaynak kodu — ayrı proje klasörü gerekli.",
    };
  }
  return { valid: true, issue: null, message: "" };
}

function resolveUsableWorkspacePath(storedPath) {
  const issue = describeWorkspacePathIssue(storedPath);
  if (issue.valid) {
    return {
      workspacePath: String(storedPath).trim(),
      changed: false,
      issue: null,
      previousPath: storedPath,
    };
  }
  const fallback = ensureDefaultWorkspaceDir();
  return {
    workspacePath: fallback,
    changed: true,
    issue: issue.issue,
    previousPath: storedPath,
    message: issue.message,
  };
}

module.exports = {
  isTempWorkspacePath,
  getDefaultWorkspacePath,
  ensureDefaultWorkspaceDir,
  describeWorkspacePathIssue,
  resolveUsableWorkspacePath,
};
