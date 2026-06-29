/**
 * Cursor / dev terminal launcher — kills stale Sauron/Electron, then runs with live logs.
 * Usage: npm run terminal
 */
const { spawn, execSync } = require("child_process");
const path = require("path");
const electronPath = require("electron");

const projectRoot = path.join(__dirname, "..");

function killStaleProcesses() {
  if (process.platform !== "win32") {
    return;
  }
  try {
    execSync(
      "Get-Process electron,Sauron -ErrorAction SilentlyContinue | Stop-Process -Force",
      { shell: "powershell.exe", stdio: "ignore" },
    );
    console.log("[Sauron][terminal] Eski Electron/Sauron süreçleri kapatıldı.");
  } catch {
    // No matching processes — fine.
  }
}

console.log("[Sauron][terminal] Proje:", projectRoot);
console.log("[Sauron][terminal] Log seviyesi: debug | Dosya: %APPDATA%\\openguider\\logs\\app.log");
console.log("[Sauron][terminal] Durdurmak için: Ctrl+C\n");

killStaleProcesses();

const env = {
  ...process.env,
  SAURON_TERMINAL: "1",
  OPENGUIDER_LOG_LEVEL: process.env.OPENGUIDER_LOG_LEVEL || "debug",
  ELECTRON_ENABLE_LOGGING: "1",
};

const child = spawn(electronPath, ["."], {
  cwd: projectRoot,
  env,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error("[Sauron][terminal] Electron başlatılamadı:", error.message);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.log(`[Sauron][terminal] Sinyal ile kapandı: ${signal}`);
    process.exit(0);
  }
  console.log(`[Sauron][terminal] Çıkış kodu: ${code ?? 0}`);
  process.exit(code ?? 0);
});
