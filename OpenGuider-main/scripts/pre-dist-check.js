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
  const excludeFiles = [
    "gamedev-launcher.test.js",
    "gamedev-v21.test.js",
    "agent-resilience.test.js",
    "ai-providers.mock.test.js",
    "panel-browser-task-view.test.js",
  ];
  const testDirs = [
    path.join(projectRoot, "tests", "unit"),
    path.join(projectRoot, "tests", "ui"),
  ];
  const testFiles = [];
  for (const dir of testDirs) {
    for (const file of collectJsFiles(dir)) {
      if (file.endsWith(".test.js") && !excludeFiles.some((e) => path.basename(file) === e)) {
        testFiles.push(file);
      }
    }
  }
  console.log(`Running ${testFiles.length} test files (excluded ${excludeFiles.join(", ")})...`);
  const result = spawnSync(process.execPath, ["--test", "--test-force-exit", ...testFiles], {
    cwd: projectRoot,
    encoding: "utf8",
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

function ensureGamedevMcpPresent() {
  const gamedevRoot = path.resolve(projectRoot, "extensions", "gamedev-all-in-one");
  const mcpPath = path.join(gamedevRoot, "dist", "index.js");
  const sdkPath = path.join(gamedevRoot, "node_modules", "@modelcontextprotocol", "sdk");
  if (!fs.existsSync(mcpPath)) {
    console.error(`GameDev MCP entry missing at ${mcpPath}`);
    console.error("Run: cd extensions/gamedev-all-in-one && npm ci && npm run build");
    process.exit(1);
  }
  if (!fs.existsSync(sdkPath)) {
    console.error(`GameDev MCP dependency missing at ${sdkPath}`);
    console.error("Run: cd extensions/gamedev-all-in-one && npm ci");
    process.exit(1);
  }
  console.log(`GameDev MCP found: ${mcpPath}`);
  console.log(`GameDev MCP deps found: ${sdkPath}`);
}

function assertMainIpcStartupOrder() {
  const mainPath = path.join(projectRoot, "main.js");
  const source = fs.readFileSync(mainPath, "utf8");
  const bootIdx = source.indexOf("app.whenReady");
  if (bootIdx < 0) {
    console.error("main.js missing app.whenReady block");
    process.exit(1);
  }
  const bootBlock = source.slice(bootIdx, bootIdx + 12000);
  const ipcReadyIdx = bootBlock.indexOf("ensureIpcHandlersReady()");
  const panelIdx = bootBlock.indexOf("createPanelWindow()");
  if (ipcReadyIdx < 0 || panelIdx < 0 || ipcReadyIdx >= panelIdx) {
    console.error("main.js IPC startup order invalid (ensureIpcHandlersReady must precede createPanelWindow)");
    process.exit(1);
  }
  if (!source.includes("ipcHandlersReady")) {
    console.error("main.js missing ipcHandlersReady barrier");
    process.exit(1);
  }
  console.log("main.js IPC startup order OK");
}

function main() {
  runSyntaxChecks();
  assertMainIpcStartupOrder();
  if (process.env.SAURON_SKIP_PREDIST_TESTS === "1") {
    console.log("Skipping unit/UI tests (SAURON_SKIP_PREDIST_TESTS=1)");
  } else {
    runUnitTests();
  }
  ensureBridgeVsixPresent();
  ensureGamedevMcpPresent();
  console.log("pre-dist-check passed");
}

main();
