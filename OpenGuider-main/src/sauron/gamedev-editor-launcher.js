const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { probeGamedevBridgeForEngine } = require("./gamedev-bridge-probe");
const { normalizeGamedevEngine } = require("./gamedev-config");
const { findUprojectFile } = require("./gamedev-unreal-installer");

const DEFAULT_BRIDGE_WAIT_MS = 90000;
const DEFAULT_POLL_MS = 2500;

function fileExists(candidate) {
  try {
    return fs.existsSync(candidate);
  } catch {
    return false;
  }
}

function findUnityEditorExecutable() {
  if (process.platform !== "win32") {
    return null;
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

function findUnrealEditorExecutable() {
  if (process.platform !== "win32") {
    return null;
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

function spawnDetached(command, args = [], options = {}) {
  try {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      ...options,
    });
    child.unref();
    return { ok: true, pid: child.pid, command, args };
  } catch (error) {
    return { ok: false, error: error?.message || "spawn-failed", command, args };
  }
}

function launchUnityProject(workspacePath, settings = {}) {
  const resolved = String(workspacePath || "").trim();
  const unityExe = String(settings.gamedevUnityEditorPath || "").trim() || findUnityEditorExecutable();
  if (!unityExe || !fileExists(unityExe)) {
    return { ok: false, error: "unity-editor-not-found" };
  }
  if (!fileExists(path.join(resolved, "Assets"))) {
    return { ok: false, error: "not-unity-project" };
  }
  return spawnDetached(unityExe, ["-projectPath", resolved]);
}

function launchUnrealProject(workspacePath, settings = {}) {
  const resolved = String(workspacePath || "").trim();
  const uprojectPath = findUprojectFile(resolved);
  const unrealExe = String(settings.gamedevUnrealEditorPath || "").trim() || findUnrealEditorExecutable();
  if (!unrealExe || !fileExists(unrealExe)) {
    return { ok: false, error: "unreal-editor-not-found" };
  }
  if (!uprojectPath) {
    return { ok: false, error: "uproject-not-found" };
  }
  return spawnDetached(unrealExe, [uprojectPath]);
}

function launchGameEditor(engine, workspacePath, settings = {}) {
  const normalized = normalizeGamedevEngine(engine);
  if (normalized === "unreal") {
    return launchUnrealProject(workspacePath, settings);
  }
  if (normalized === "unity") {
    return launchUnityProject(workspacePath, settings);
  }
  return { ok: false, skipped: true, reason: "unsupported-engine" };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForEngineBridge(engine, workspacePath, options = {}) {
  const timeoutMs = Number(options.timeoutMs) || DEFAULT_BRIDGE_WAIT_MS;
  const pollMs = Number(options.pollMs) || DEFAULT_POLL_MS;
  const started = Date.now();
  let lastProbe = null;

  while (Date.now() - started < timeoutMs) {
    lastProbe = await probeGamedevBridgeForEngine(engine, { workspacePath });
    if (lastProbe.ok) {
      return {
        ok: true,
        connected: true,
        waitedMs: Date.now() - started,
        probe: lastProbe,
      };
    }
    await sleep(pollMs);
  }

  return {
    ok: false,
    connected: false,
    waitedMs: Date.now() - started,
    probe: lastProbe,
    error: "bridge-wait-timeout",
  };
}

async function ensureEditorBridgeReady(engine, workspacePath, settings = {}, options = {}) {
  const normalized = normalizeGamedevEngine(engine);
  const resolved = String(workspacePath || "").trim();
  const steps = [];

  const initial = await probeGamedevBridgeForEngine(normalized, { workspacePath: resolved });
  steps.push({ id: "bridge-initial", ok: initial.ok, message: initial.ok ? "bridge-online" : "bridge-offline" });
  if (initial.ok) {
    return { ok: true, probe: initial, steps, launched: false };
  }

  if (settings.gamedevAutoEditorLaunch === false) {
    return { ok: false, probe: initial, steps, launched: false, error: "bridge-offline-auto-launch-disabled" };
  }

  const launch = launchGameEditor(normalized, resolved, settings);
  steps.push({
    id: "editor-launch",
    ok: launch.ok,
    message: launch.ok ? `editor-launched (${launch.pid || "?"})` : launch.error || "launch-failed",
  });
  if (!launch.ok) {
    return { ok: false, probe: initial, steps, launched: false, error: launch.error || "editor-launch-failed" };
  }

  const wait = await waitForEngineBridge(normalized, resolved, options);
  steps.push({
    id: "bridge-wait",
    ok: wait.ok,
    message: wait.ok
      ? `bridge-online (${wait.waitedMs}ms)`
      : wait.error || "bridge-wait-timeout",
  });

  return {
    ok: wait.ok,
    probe: wait.probe || initial,
    steps,
    launched: true,
    launch,
    wait,
  };
}

module.exports = {
  DEFAULT_BRIDGE_WAIT_MS,
  findUnityEditorExecutable,
  findUnrealEditorExecutable,
  launchUnityProject,
  launchUnrealProject,
  launchGameEditor,
  waitForEngineBridge,
  ensureEditorBridgeReady,
};
