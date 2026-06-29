/**
 * @file check-build-integrity.js
 * Prebuild integrity check. Runs before `npm run dist:*` to ensure all
 * required artifacts exist. Uses only Node.js core modules.
 */

const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
let failures = 0;

function fail(label, detail, fixHint) {
  console.error(`[FAIL] ${label}`);
  console.error(`       ${detail}`);
  if (fixHint) console.error(`       → ${fixHint}`);
  failures += 1;
}

function pass(label) {
  console.log(`[PASS] ${label}`);
}

// ── 1. GameDev MCP entry (optional) ──────────────────────────────────────────
const gamedevMcp = path.resolve(projectRoot, "extensions", "gamedev-all-in-one", "dist", "index.js");
if (fs.existsSync(gamedevMcp)) {
  pass("GameDev MCP entry");
} else {
  console.warn(`[WARN] GameDev MCP entry missing at extensions/gamedev-all-in-one/dist/index.js — skipping (opsiyonel)`);
}

// ── 2. Bridge VSIX ────────────────────────────────────────────────────────────
const bridgeVsix = path.resolve(projectRoot, "..", "sauron-vscode-bridge", "dist", "sauron-vscode-bridge.vsix");
if (fs.existsSync(bridgeVsix)) {
  pass("Bridge VSIX");
} else {
  fail("Bridge VSIX", "../sauron-vscode-bridge/dist/sauron-vscode-bridge.vsix bulunamadı", "cd sauron-vscode-bridge && npm run package:vsix");
}

// ── 3. Node modules varlığı (3 rastgele paket) ───────────────────────────────
const requiredPkgs = ["electron", "electron-store", "ws"];
for (const pkg of requiredPkgs) {
  const pkgPath = path.resolve(projectRoot, "node_modules", pkg);
  try {
    require.resolve(pkg, { paths: [projectRoot] });
    pass(`node_modules/${pkg}`);
  } catch {
    fail(`node_modules/${pkg}`, `${pkg} bulunamadı`, "npm install");
  }
}

// ── 4. Sauron runtime yapısı (kritik src/ dizinleri) ─────────────────────────
const criticalPaths = [
  "main.js",
  "src/ipc",
  "src/sauron",
  "src/plugins/browser/sidecar.js",
  "src/sauron/channel-runtime.js",
  "src/sauron/doctor.js",
  "src/sauron/handoff.js",
];
for (const rel of criticalPaths) {
  const absPath = path.resolve(projectRoot, rel);
  if (fs.existsSync(absPath)) {
    pass(`src/${rel}`);
  } else {
    fail(`src/${rel}`, `${rel} bulunamadı`, "git restore veya npm run dev ile kontrol edin");
  }
}

// ── Sonuç ─────────────────────────────────────────────────────────────────────
if (failures > 0) {
  console.error(`\nBuild integrity: ${failures} failure(s). Düzeltmeden build yapılamaz.`);
  process.exit(1);
} else {
  console.log("\nBuild integrity: OK");
}
