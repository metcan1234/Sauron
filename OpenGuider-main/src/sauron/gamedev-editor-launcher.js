const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { probeGamedevBridgeForEngine } = require("./gamedev-bridge-probe");
const { normalizeGamedevEngine } = require("./gamedev-config");
const { findUprojectFile } = require("./gamedev-unreal-installer");
const { findUnityEditorExecutable, findUnrealEditorExecutable } = require("./gamedev-editor-paths");
const { tryStartEngineMcp } = require("./gamedev-mcp-autostart");

const DEFAULT_BRIDGE_WAIT_MS = 90000;
const DEFAULT_POLL_MS = 2500;

function fileExists(candidate) {
  try {
    return fs.existsSync(candidate);
  } catch {
    return false;
  }
}

function findUnityEditorExecutableLegacy(settings = {}) {
  return findUnityEditorExecutable(settings);
}

function findUnrealEditorExecutableLegacy(settings = {}) {
  return findUnrealEditorExecutable(settings);
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
  const settings = options.settings || {};
  const started = Date.now();
  let lastProbe = null;
  let nudgeCount = 0;

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
    if (Date.now() - started > 10000 && nudgeCount < 4 && settings.gamedevAutoMcpStart !== false) {
      await tryStartEngineMcp(engine, workspacePath, settings);
      nudgeCount += 1;
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

  const wait = await waitForEngineBridge(normalized, resolved, { ...options, settings });
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
  findUnityEditorExecutable: findUnityEditorExecutableLegacy,
  findUnrealEditorExecutable: findUnrealEditorExecutableLegacy,
  launchUnityProject,
  launchUnrealProject,
  launchGameEditor,
  waitForEngineBridge,
  ensureEditorBridgeReady,
};
