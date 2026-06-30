#!/usr/bin/env node
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  getBundledGooseExePath,
  getBundledWorkspacePath,
  getSauronAsistanRoot,
  isSauronAsistanLayout,
} = require("../src/sauron/sauron-asistan-root");

const CONFIG_DIRS = ["openguider", "sauron"];

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, "\t")}\n`, "utf8");
}

function resolveDefaultVscodePath() {
  const localAppData = process.env.LOCALAPPDATA || "";
  const candidate = path.join(localAppData, "Programs", "Microsoft VS Code", "Code.exe");
  return fs.existsSync(candidate) ? candidate : "";
}

function pinConfig(configPath) {
  const config = readJson(configPath);
  if (!config) {
    return { ok: false, reason: "missing", configPath };
  }

  const workspacePath = getBundledWorkspacePath();
  const gooseBinaryPath = getBundledGooseExePath();
  const vscodePath = resolveDefaultVscodePath();
  const changes = [];

  if (config.workspacePath !== workspacePath) {
    config.workspacePath = workspacePath;
    config.tempWorkspaceActive = false;
    changes.push("workspacePath");
  }
  if (gooseBinaryPath && fs.existsSync(gooseBinaryPath) && config.gooseBinaryPath !== gooseBinaryPath) {
    config.gooseBinaryPath = gooseBinaryPath;
    changes.push("gooseBinaryPath");
  }
  if (vscodePath && config.vscodePath !== vscodePath) {
    config.vscodePath = vscodePath;
    changes.push("vscodePath");
  }

  if (!changes.length) {
    return { ok: true, changed: false, configPath, workspacePath, gooseBinaryPath };
  }

  writeJson(configPath, config);
  return { ok: true, changed: true, configPath, changes, workspacePath, gooseBinaryPath };
}

function main() {
  if (!isSauronAsistanLayout()) {
    console.error("[FAIL] Sauron Asistan düzeni bulunamadı.");
    console.error(`       Beklenen kök: ${getSauronAsistanRoot()}`);
    process.exit(1);
  }

  const workspacePath = getBundledWorkspacePath();
  const gooseBinaryPath = getBundledGooseExePath();
  fs.mkdirSync(workspacePath, { recursive: true });

  let anyChanged = false;
  for (const dir of CONFIG_DIRS) {
    const configPath = path.join(os.homedir(), "AppData", "Roaming", dir, "config.json");
    const result = pinConfig(configPath);
    if (!result.ok) {
      console.log(`[SKIP] ${configPath} (yok)`);
      continue;
    }
    if (result.changed) {
      anyChanged = true;
      console.log(`[OK] ${configPath}`);
      console.log(`     güncellendi: ${result.changes.join(", ")}`);
    } else {
      console.log(`[OK] ${configPath} (zaten doğru)`);
    }
  }

  console.log("");
  console.log("Sauron Asistan kökü:", getSauronAsistanRoot());
  console.log("Workspace:", workspacePath);
  console.log("Goose:", gooseBinaryPath, fs.existsSync(gooseBinaryPath) ? "" : "(eksik!)");
  if (anyChanged) {
    console.log("\nSauron'u yeniden başlatın (npm run terminal).");
  }
}

main();
