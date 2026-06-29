const { execSync } = require("child_process");

const UNITY_MARKERS = ["Unity.exe", "Unity Hub.exe"];
const UNREAL_MARKERS = ["UnrealEditor.exe", "UE4Editor.exe", "UE5Editor.exe"];

function listRunningProcessesWindows() {
  if (process.platform !== "win32") {
    return [];
  }
  try {
    const output = execSync('tasklist /FO CSV /NH', {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 4000,
    });
    return String(output || "")
      .split(/\r?\n/)
      .map((line) => line.replace(/^"|"$/g, "").split('","')[0])
      .filter(Boolean);
  } catch {
    return [];
  }
}

function detectRunningGameEngine() {
  const processes = listRunningProcessesWindows();
  const lower = processes.map((name) => name.toLowerCase());

  const unrealHit = UNREAL_MARKERS.find((marker) => lower.some((name) => name.includes(marker.toLowerCase())));
  if (unrealHit) {
    return { engine: "unreal", process: unrealHit, detected: true };
  }

  const unityHit = UNITY_MARKERS.find((marker) => lower.some((name) => name.includes(marker.toLowerCase())));
  if (unityHit) {
    return { engine: "unity", process: unityHit, detected: true };
  }

  return { engine: null, process: null, detected: false };
}

function resolvePreferredEngine(settings = {}) {
  const configured = String(settings.gamedevActiveEngine || "unity").trim().toLowerCase();
  const detected = detectRunningGameEngine();
  if (detected.detected && detected.engine) {
    return {
      engine: detected.engine,
      source: "process",
      process: detected.process,
      configured,
    };
  }
  return {
    engine: configured || "unity",
    source: "settings",
    process: null,
    configured,
  };
}

module.exports = {
  detectRunningGameEngine,
  resolvePreferredEngine,
  listRunningProcessesWindows,
};
