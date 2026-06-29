/**
 * @file package-release.js
 * Full release pipeline for Windows.
 *
 * Steps:
 *   1. Verify preconditions (prebuild integrity check)
 *   2. Build Bridge VSIX (sauron-vscode-bridge)
 *   3. Copy .vsix → resources/bridge/
 *   4. Run electron-builder dist:win
 *   5. Print release summary
 *
 * Usage:
 *   npm run release:win
 */

const { execFileSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BRIDGE_DIR = path.resolve(ROOT, "..", "sauron-vscode-bridge");
const VSIX_SOURCE = path.join(BRIDGE_DIR, "dist", "sauron-vscode-bridge.vsix");
const VSIX_TARGET_DIR = path.join(ROOT, "resources", "bridge");
const VSIX_TARGET = path.join(VSIX_TARGET_DIR, "sauron-vscode-bridge.vsix");

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
    process.exit(result.status);
  }
  return result;
}

function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  Sauron Windows Release Pipeline");
  console.log("═══════════════════════════════════════════\n");

  // ── Step 0: Prebuild integrity check ──────────────────────────────
  step("0 / 4 — Prebuild integrity check");
  run("node", ["scripts/check-build-integrity.js"]);

  // ── Step 1: Build Bridge VSIX ─────────────────────────────────────
  step("1 / 4 — Building Bridge VSIX");
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

  // ── Step 2: Copy VSIX to resources/bridge/ ────────────────────────
  step("2 / 4 — Copying VSIX to resources/bridge/");
  fs.mkdirSync(VSIX_TARGET_DIR, { recursive: true });
  fs.copyFileSync(VSIX_SOURCE, VSIX_TARGET);
  console.log(`  → ${VSIX_TARGET}`);

  // ── Step 3: Run electron-builder dist:win ─────────────────────────
  step("3 / 5 — Running electron-builder (dist:win)");
  run("npm", ["run", "dist:win"]);

  // ── Step 4: Release summary ────────────────────────────────────────
  step("4 / 5 — Release summary");

  const releaseDir = path.join(ROOT, "release");
  const installers = [];
  if (fs.existsSync(releaseDir)) {
    for (const entry of fs.readdirSync(releaseDir, { withFileTypes: true })) {
      if (entry.isFile() && /\.exe$/.test(entry.name)) {
        const fullPath = path.join(releaseDir, entry.name);
        const size = (fs.statSync(fullPath).size / (1024 * 1024)).toFixed(1);
        installers.push({ name: entry.name, size, path: fullPath });
      }
    }
  }

  if (installers.length === 0) {
    console.warn("  ⚠ No installer .exe found in release/ — check electron-builder output.");
  } else {
    for (const inst of installers) {
      console.log(`  ✓ ${inst.name} (${inst.size} MB)`);
    }
  }

  console.log("\n═══════════════════════════════════════════");
  console.log("  Release hazır! 🚀");
  console.log("═══════════════════════════════════════════\n");

  const releaseNotes = [
    "Bridge VSIX: " + vsixSize + " KB",
    ...installers.map((i) => `Installer: ${i.name} (${i.size} MB)`),
  ];
  for (const line of releaseNotes) {
    console.log(`  • ${line}`);
  }
  console.log("");

  // ── Step 5: GitHub push ─────────────────────────────────────────────
  step("5 / 5 — GitHub push");
  try {
    run("git", ["push", "origin", "main"], {
      cwd: ROOT,
      stdio: ["inherit", "pipe", "pipe"],
      ignoreExit: true,
    });
    console.log("  ✅ GitHub'a push edildi");
  } catch (pushError) {
    const msg = pushError?.stderr || pushError?.message || String(pushError);
    console.warn("  ⚠️ Push başarısız — manuel git push origin main çalıştırın");
    console.warn("     Hata: " + msg.trim().split("\n").pop());
  }
}

main();
