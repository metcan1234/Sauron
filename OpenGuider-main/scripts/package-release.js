/**
 * @file package-release.js
 * Full release pipeline for Windows.
 *
 * Steps:
 *   1. Verify preconditions (prebuild integrity check)
 *   2. Build gamedev-all-in-one MCP (dist + node_modules)
 *   3. Build Bridge VSIX (sauron-vscode-bridge)
 *   4. Copy .vsix → resources/bridge/
 *   5. Run electron-builder dist:win
 *   6. Print release summary
 *   7. GitHub push + release upload (when gh available)
 *
 * Usage:
 *   npm run release:win
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(ROOT, "..");
const GAMEDEV_DIR = path.join(ROOT, "extensions", "gamedev-all-in-one");
const BRIDGE_DIR = path.resolve(ROOT, "..", "sauron-vscode-bridge");
const VSIX_SOURCE = path.join(BRIDGE_DIR, "dist", "sauron-vscode-bridge.vsix");
const VSIX_TARGET_DIR = path.join(ROOT, "resources", "bridge");
const VSIX_TARGET = path.join(VSIX_TARGET_DIR, "sauron-vscode-bridge.vsix");

function readVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  return String(pkg.version || "0.0.0");
}

function step(label) {
  console.log(`\n━━━ ${label} ━━━`);
}

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: options.cwd || ROOT,
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: options.silent ? ["ignore", "pipe", "pipe"] : "inherit",
    windowsHide: true,
    ...options,
  });
  if (result.status !== 0 && !options.ignoreExit) {
    console.error(`[FAIL] ${cmd} ${args.join(" ")}`);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status || 1);
  }
  return result;
}

function ensureGamedevMcpBuilt() {
  const distEntry = path.join(GAMEDEV_DIR, "dist", "index.js");
  const sdkPath = path.join(GAMEDEV_DIR, "node_modules", "@modelcontextprotocol", "sdk");

  console.log("  → Building gamedev-all-in-one MCP...");
  run("npm", ["ci"], { cwd: GAMEDEV_DIR });
  run("npm", ["run", "build"], { cwd: GAMEDEV_DIR });

  if (!fs.existsSync(distEntry)) {
    console.error(`[FAIL] GameDev MCP entry missing at ${distEntry}`);
    process.exit(1);
  }
  if (!fs.existsSync(sdkPath)) {
    console.error(`[FAIL] GameDev MCP dependency missing at ${sdkPath}`);
    process.exit(1);
  }
  console.log(`  → GameDev MCP ready: ${distEntry}`);
}

function findInstallers(releaseDir, version) {
  const installers = [];
  if (!fs.existsSync(releaseDir)) {
    return installers;
  }
  const versionToken = `-${version}-`;
  for (const entry of fs.readdirSync(releaseDir, { withFileTypes: true })) {
    if (entry.isFile() && /\.exe$/.test(entry.name) && entry.name.includes(versionToken)) {
      const fullPath = path.join(releaseDir, entry.name);
      const size = (fs.statSync(fullPath).size / (1024 * 1024)).toFixed(1);
      installers.push({ name: entry.name, size, path: fullPath });
    }
  }
  return installers;
}

function publishGitHubRelease(version, installers) {
  if (installers.length === 0) {
    console.warn("  ⚠ No installer to upload — skipping GitHub Release.");
    return;
  }

  const tag = `v${version}`;
  const ghCheck = run("gh", ["auth", "status"], { silent: true, ignoreExit: true });
  if (ghCheck.status !== 0) {
    console.warn("  ⚠ gh CLI not authenticated — skip GitHub Release upload.");
    console.warn(`     Manual: gh release create ${tag} --title "Sauron ${version}" ${installers.map((i) => i.path).join(" ")}`);
    return;
  }

  const existing = run("gh", ["release", "view", tag], { silent: true, ignoreExit: true, cwd: REPO_ROOT });
  const assetArgs = installers.flatMap((inst) => ["--clobber", inst.path]);

  if (existing.status === 0) {
    console.log(`  → Uploading assets to existing release ${tag}...`);
    run("gh", ["release", "upload", tag, ...assetArgs], { cwd: REPO_ROOT, ignoreExit: true });
  } else {
    console.log(`  → Creating GitHub Release ${tag}...`);
    run(
      "gh",
      [
        "release",
        "create",
        tag,
        "--title",
        `Sauron ${version}`,
        "--generate-notes",
        ...assetArgs,
      ],
      { cwd: REPO_ROOT, ignoreExit: true },
    );
  }

  for (const inst of installers) {
    console.log(`  ✓ Release asset: https://github.com/metcan1234/Sauron/releases/download/${tag}/${inst.name}`);
  }
}

function main() {
  const version = readVersion();

  console.log("═══════════════════════════════════════════");
  console.log("  Sauron Windows Release Pipeline");
  console.log(`  Version: ${version}`);
  console.log("═══════════════════════════════════════════\n");

  step("1 / 7 — Prebuild integrity check");
  run("node", ["scripts/check-build-integrity.js"]);

  step("2 / 7 — Building gamedev-all-in-one MCP");
  ensureGamedevMcpBuilt();

  step("3 / 7 — Building Bridge VSIX");
  if (!fs.existsSync(path.join(BRIDGE_DIR, "node_modules"))) {
    console.log("  → Installing sauron-vscode-bridge dependencies...");
    run("npm", ["install"], { cwd: BRIDGE_DIR });
  }
  run("npm", ["run", "package:vsix"], { cwd: BRIDGE_DIR });

  if (!fs.existsSync(VSIX_SOURCE)) {
    console.error(`[FAIL] VSIX not produced at ${VSIX_SOURCE}`);
    process.exit(1);
  }
  const vsixSize = (fs.statSync(VSIX_SOURCE).size / 1024).toFixed(1);
  console.log(`  → VSIX produced: ${vsixSize} KB`);

  step("4 / 7 — Copying VSIX to resources/bridge/");
  fs.mkdirSync(VSIX_TARGET_DIR, { recursive: true });
  fs.copyFileSync(VSIX_SOURCE, VSIX_TARGET);
  console.log(`  → ${VSIX_TARGET}`);

  step("5 / 7 — Running electron-builder (dist:win)");
  run("npm", ["run", "dist:win"]);

  step("6 / 7 — Release summary");
  const releaseDir = path.join(ROOT, "release");
  const installers = findInstallers(releaseDir, version);

  if (installers.length === 0) {
    console.warn("  ⚠ No installer .exe found in release/ — check electron-builder output.");
  } else {
    for (const inst of installers) {
      console.log(`  ✓ ${inst.name} (${inst.size} MB)`);
    }
  }

  const unpackedMcp = path.join(releaseDir, "win-unpacked", "resources", "gamedev-all-in-one", "dist", "index.js");
  const unpackedSdk = path.join(
    releaseDir,
    "win-unpacked",
    "resources",
    "gamedev-all-in-one",
    "node_modules",
    "@modelcontextprotocol",
    "sdk",
  );
  if (fs.existsSync(unpackedMcp) && fs.existsSync(unpackedSdk)) {
    console.log("  ✓ Portable MCP bundle verified in win-unpacked/resources/");
  } else {
    console.warn("  ⚠ Portable MCP bundle check failed in win-unpacked/resources/");
  }

  console.log("\n═══════════════════════════════════════════");
  console.log("  Release hazır!");
  console.log("═══════════════════════════════════════════\n");

  const releaseNotes = [
    `Bridge VSIX: ${vsixSize} KB`,
    ...installers.map((i) => `Installer: ${i.name} (${i.size} MB)`),
  ];
  for (const line of releaseNotes) {
    console.log(`  • ${line}`);
  }
  console.log("");

  step("7 / 7 — GitHub push + Release upload");
  run("git", ["push", "origin", "main"], {
    cwd: REPO_ROOT,
    stdio: ["inherit", "pipe", "pipe"],
    ignoreExit: true,
  });
  publishGitHubRelease(version, installers);
}

main();
