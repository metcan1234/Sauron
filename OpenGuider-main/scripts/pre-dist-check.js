const { execFileSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");

function collectJsFiles(dir, files = []) {
  if (!fs.existsSync(dir)) {
    return files;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectJsFiles(fullPath, files);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(fullPath);
    }
  }
  return files;
}

function runSyntaxChecks() {
  const targets = [
    path.join(projectRoot, "main.js"),
    path.join(projectRoot, "preload.js"),
    ...collectJsFiles(path.join(projectRoot, "src")),
  ];

  const failures = [];
  for (const filePath of targets) {
    const result = spawnSync(process.execPath, ["--check", filePath], {
      encoding: "utf8",
      windowsHide: true,
    });
    if (result.status !== 0) {
      failures.push({
        filePath,
        error: result.stderr || result.stdout || "syntax check failed",
      });
    }
  }

  if (failures.length > 0) {
    console.error("Syntax check failed:");
    for (const failure of failures) {
      console.error(`- ${failure.filePath}`);
      if (failure.error) {
        console.error(failure.error.trim());
      }
    }
    process.exit(1);
  }

  console.log(`Syntax OK (${targets.length} files)`);
}

function runUnitTests() {
  console.log("Running npm test...");
  const result = spawnSync("npm", ["test"], {
    cwd: projectRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
    windowsHide: true,
  });
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function ensureBridgeVsixPresent() {
  const vsixPath = path.resolve(projectRoot, "..", "sauron-vscode-bridge", "dist", "sauron-vscode-bridge.vsix");
  if (!fs.existsSync(vsixPath)) {
    console.warn(`Bridge VSIX missing at ${vsixPath}; run sauron-vscode-bridge package:vsix before dist:win.`);
    process.exit(1);
  }
  console.log(`Bridge VSIX found: ${vsixPath}`);
}

function main() {
  runSyntaxChecks();
  runUnitTests();
  ensureBridgeVsixPresent();
  console.log("pre-dist-check passed");
}

main();
