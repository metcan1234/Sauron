#!/usr/bin/env node
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const gamedevDir = path.join(projectRoot, "extensions", "gamedev-all-in-one");
const bridgeDir = path.join(projectRoot, "..", "sauron-vscode-bridge");

function run(cmd, cwd) {
  execSync(cmd, { cwd, stdio: "inherit", shell: true });
}

if (fs.existsSync(path.join(gamedevDir, "package.json"))) {
  if (!fs.existsSync(path.join(gamedevDir, "dist", "index.js"))) {
    console.log("[ensure-dev-artifacts] Building gamedev-all-in-one...");
    run("npm install", gamedevDir);
    run("npm run build", gamedevDir);
  }
}

const vsixPath = path.join(bridgeDir, "dist", "sauron-vscode-bridge.vsix");
if (fs.existsSync(path.join(bridgeDir, "package.json")) && !fs.existsSync(vsixPath)) {
  console.log("[ensure-dev-artifacts] Packaging bridge VSIX...");
  run("npm install", bridgeDir);
  run("npm run package:vsix", bridgeDir);
}

console.log("[ensure-dev-artifacts] Done");
