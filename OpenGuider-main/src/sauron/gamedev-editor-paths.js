const fs = require("fs");
const path = require("path");
const os = require("os");
const http = require("http");

function fileExists(candidate) {
  try {
    return fs.existsSync(candidate);
  } catch {
    return false;
  }
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function findUnityEditorFromHub() {
  const hubEditors = path.join(process.env.APPDATA || "", "UnityHub", "editors.json");
  const data = readJsonFile(hubEditors);
  if (!data || typeof data !== "object") {
    return null;
  }
  const entries = Object.entries(data)
    .filter(([, info]) => info?.installed && info?.location)
    .sort((a, b) => String(b[0]).localeCompare(String(a[0])));
  for (const [, info] of entries) {
    const unityExe = path.join(String(info.location), "Editor", "Unity.exe");
    if (fileExists(unityExe)) {
      return unityExe;
    }
  }
  return null;
}

function findUnityEditorExecutable(settings = {}) {
  const override = String(settings.gamedevUnityEditorPath || "").trim();
  if (override && fileExists(override)) {
    return override;
  }
  const fromHub = findUnityEditorFromHub();
  if (fromHub) {
    return fromHub;
  }
  const roots = [
    path.join(process.env["ProgramFiles"] || "C:\\Program Files", "Unity", "Hub", "Editor"),
    path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Unity", "Hub", "Editor"),
  ];
  const candidates = [];
  for (const root of roots) {
    if (!fileExists(root)) {
      continue;
    }
    for (const versionDir of fs.readdirSync(root, { withFileTypes: true })) {
      if (!versionDir.isDirectory()) {
        continue;
      }
      candidates.push(path.join(root, versionDir.name, "Editor", "Unity.exe"));
    }
  }
  candidates.sort().reverse();
  return candidates.find((entry) => fileExists(entry)) || null;
}

function findUnrealEditorFromManifest() {
  const manifestPath = path.join(process.env.PROGRAMDATA || "C:\\ProgramData", "Epic", "UnrealEngineLauncher", "LauncherInstalled.dat");
  const raw = readJsonFile(manifestPath);
  const installations = raw?.InstallationList || raw?.Installations || [];
  const list = Array.isArray(installations) ? installations : [];
  const sorted = list
    .filter((entry) => entry?.InstallLocation || entry?.AppName)
    .sort((a, b) => String(b?.AppVersion || b?.AppName || "").localeCompare(String(a?.AppVersion || a?.AppName || "")));
  for (const entry of sorted) {
    const base = String(entry.InstallLocation || "").trim();
    if (!base) {
      continue;
    }
    const unrealExe = path.join(base, "Engine", "Binaries", "Win64", "UnrealEditor.exe");
    if (fileExists(unrealExe)) {
      return unrealExe;
    }
  }
  return null;
}

function findUnrealEditorExecutable(settings = {}) {
  const override = String(settings.gamedevUnrealEditorPath || "").trim();
  if (override && fileExists(override)) {
    return override;
  }
  const fromManifest = findUnrealEditorFromManifest();
  if (fromManifest) {
    return fromManifest;
  }
  const epicRoot = path.join(process.env["ProgramFiles"] || "C:\\Program Files", "Epic Games");
  if (!fileExists(epicRoot)) {
    return null;
  }
  const candidates = [];
  for (const entry of fs.readdirSync(epicRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^UE_/i.test(entry.name)) {
      continue;
    }
    candidates.push(path.join(epicRoot, entry.name, "Engine", "Binaries", "Win64", "UnrealEditor.exe"));
  }
  candidates.sort().reverse();
  return candidates.find((entry) => fileExists(entry)) || null;
}

module.exports = {
  findUnityEditorFromHub,
  findUnityEditorExecutable,
  findUnrealEditorFromManifest,
  findUnrealEditorExecutable,
};
