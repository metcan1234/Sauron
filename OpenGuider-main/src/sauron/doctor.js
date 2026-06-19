const fs = require("fs");
const path = require("path");
const { resolveVSCodeCommand } = require("./handoff");
const { checkWorkspacePrerequisites } = require("./workspace-setup");
const { getBridgeVsixPath } = require("./workspace-stack-installer");

function pushCheck(checks, entry) {
  checks.push({
    id: entry.id,
    status: entry.status,
    message: entry.message,
    fixHint: entry.fixHint || "",
  });
}

function checkNodeVersion() {
  const version = process.versions.node || "";
  const major = Number.parseInt(version.split(".")[0], 10);
  if (major >= 18) {
    return {
      id: "node-version",
      status: "pass",
      message: `Node.js ${version}`,
      fixHint: "",
    };
  }
  return {
    id: "node-version",
    status: major >= 16 ? "warn" : "fail",
    message: `Node.js ${version || "bilinmiyor"} — 18+ önerilir`,
    fixHint: "nodejs.org adresinden güncel LTS sürümünü kurun.",
  };
}

function checkWorkspacePath(store) {
  const workspacePath = String(store?.get?.("workspacePath") || "").trim();
  if (!workspacePath) {
    return {
      id: "workspace-path",
      status: "warn",
      message: "Workspace klasörü seçilmemiş",
      fixHint: "Ayarlar → Workspace → proje kök klasörünü seçin.",
    };
  }
  if (!fs.existsSync(workspacePath)) {
    return {
      id: "workspace-path",
      status: "fail",
      message: `Workspace bulunamadı: ${workspacePath}`,
      fixHint: "Geçerli bir klasör seçin veya yolu düzeltin.",
    };
  }
  try {
    fs.accessSync(workspacePath, fs.constants.R_OK | fs.constants.W_OK);
  } catch {
    return {
      id: "workspace-path",
      status: "fail",
      message: `Workspace yazılabilir değil: ${workspacePath}`,
      fixHint: "Klasör izinlerini kontrol edin.",
    };
  }
  return {
    id: "workspace-path",
    status: "pass",
    message: `Workspace: ${workspacePath}`,
    fixHint: "",
  };
}

function checkSauronDir(workspacePath) {
  if (!workspacePath || !fs.existsSync(workspacePath)) {
    return {
      id: "sauron-dir",
      status: "warn",
      message: ".sauron/ kontrol edilemedi (workspace yok)",
      fixHint: "Önce workspace klasörünü seçin.",
    };
  }
  const sauronDir = path.join(workspacePath, ".sauron");
  try {
    fs.mkdirSync(sauronDir, { recursive: true });
    const probe = path.join(sauronDir, ".doctor-probe");
    fs.writeFileSync(probe, "ok", "utf8");
    fs.unlinkSync(probe);
    return {
      id: "sauron-dir",
      status: "pass",
      message: `.sauron/ yazılabilir (${sauronDir})`,
      fixHint: "",
    };
  } catch (error) {
    return {
      id: "sauron-dir",
      status: "fail",
      message: `.sauron/ oluşturulamadı: ${error?.message || error}`,
      fixHint: "Workspace klasörüne yazma izni verin.",
    };
  }
}

function checkBridgeVsix() {
  const vsixPath = getBridgeVsixPath();
  if (fs.existsSync(vsixPath)) {
    return {
      id: "bridge-vsix",
      status: "pass",
      message: `Bridge VSIX mevcut (${path.basename(vsixPath)})`,
      fixHint: "",
    };
  }
  return {
    id: "bridge-vsix",
    status: "warn",
    message: "Bridge VSIX henüz derlenmemiş",
    fixHint: "Settings → Bridge'i kur / yenile veya scripts/install-sauron-stack.ps1 çalıştırın.",
  };
}

function runSauronDoctor(store) {
  const checks = [];
  pushCheck(checks, checkNodeVersion());

  const prerequisites = checkWorkspacePrerequisites();
  const workspaceCheck = checkWorkspacePath(store);
  pushCheck(checks, workspaceCheck);

  if (prerequisites.vscodeCli) {
    pushCheck(checks, {
      id: "vscode-cli",
      status: "pass",
      message: `VS Code CLI: ${prerequisites.codeCmd}`,
      fixHint: "",
    });
  } else {
    pushCheck(checks, {
      id: "vscode-cli",
      status: "fail",
      message: "VS Code CLI (code) bulunamadı",
      fixHint: 'VS Code → Command Palette → Shell Command: Install "code" command in PATH',
    });
  }

  if (prerequisites.clineExtension) {
    pushCheck(checks, {
      id: "cline-extension",
      status: "pass",
      message: `Cline: ${prerequisites.clineExtension}`,
      fixHint: "",
    });
  } else {
    pushCheck(checks, {
      id: "cline-extension",
      status: "warn",
      message: "Cline extension bulunamadı",
      fixHint: "VS Code Extensions → Cline (saoudrizwan.claude-dev) kurun.",
    });
  }

  if (prerequisites.bridgeExtension) {
    pushCheck(checks, {
      id: "bridge-extension",
      status: "pass",
      message: `Bridge: ${prerequisites.bridgeExtension}`,
      fixHint: "",
    });
  } else {
    pushCheck(checks, {
      id: "bridge-extension",
      status: "fail",
      message: "Sauron Bridge extension bulunamadı",
      fixHint: "Settings → Bridge'i kur / yenile veya ⌘ ile otomatik kurulumu deneyin.",
    });
  }

  pushCheck(checks, checkBridgeVsix());

  pushCheck(checks, {
    id: "cline-fork-apis",
    status: "warn",
    message: "Self-Build pipeline tam otomasyon için Cline fork gerekir (getTaskState, clearTask, syncProviderCredentials)",
    fixHint: "cline-main fork derleyin; Marketplace Cline yalnızca kısmi handoff destekler.",
  });

  const workspacePath = String(store?.get?.("workspacePath") || "").trim();
  pushCheck(checks, checkSauronDir(workspacePath));

  const failCount = checks.filter((entry) => entry.status === "fail").length;
  const warnCount = checks.filter((entry) => entry.status === "warn").length;

  return {
    ok: failCount === 0,
    checks,
    summary: {
      pass: checks.filter((entry) => entry.status === "pass").length,
      warn: warnCount,
      fail: failCount,
    },
    prerequisites,
  };
}

module.exports = {
  runSauronDoctor,
};
