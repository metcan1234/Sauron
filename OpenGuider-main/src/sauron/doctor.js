const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { resolveVSCodeCommand } = require("./handoff");
const { checkWorkspacePrerequisites } = require("./workspace-setup");
const { getBridgeVsixPath } = require("./workspace-stack-installer");
const { probeClineCapabilities } = require("./cline-capability-probe");
const {
  getInstalledRuntimeInfo,
  resolveChildProcessAssetPath,
} = require("../plugins/browser/sidecar");

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

function appendClineCapabilityChecks(checks, prerequisites) {
  const probe = probeClineCapabilities({
    codeCmd: prerequisites.codeCmd || resolveVSCodeCommand(),
  });
  const report = probe.report;

  const variantStatus = probe.variant === "fork"
    ? "pass"
    : probe.variant === "marketplace"
      ? "warn"
      : "warn";

  pushCheck(checks, {
    id: "cline-variant",
    status: variantStatus,
    message: report.summary,
    fixHint: probe.variant === "fork"
      ? ""
      : "Tam otomasyon için cline-main fork derleyin; Marketplace handoff için yeterlidir.",
  });

  const capabilityChecks = [
    {
      id: "cap-handoff",
      key: "handoff",
      passMessage: "Handoff ve görev başlatma destekleniyor",
      failMessage: "Handoff çalışmaz — Cline extension gerekli",
      fixHint: "VS Code Extensions → Cline (saoudrizwan.claude-dev) kurun.",
    },
    {
      id: "cap-model-routing",
      key: "modelRouting",
      passMessage: "Otomatik model routing (fork API) mevcut",
      failMessage: "Otomatik model routing yok — Marketplace Cline kısıtlı",
      fixHint: "Cline fork kurun veya Cline içinde modeli elle seçin.",
    },
    {
      id: "cap-credential-sync",
      key: "credentialSync",
      passMessage: "API anahtarı otomatik senkronu (fork API) mevcut",
      failMessage: "Otomatik credential sync yok — anahtarları Cline Settings'e elle girin",
      fixHint: "Cline fork kurun veya Cline'da provider anahtarlarını manuel ayarlayın.",
    },
    {
      id: "cap-pipeline-autochain",
      key: "pipelineAutoChain",
      passMessage: "Build pipeline autoChain (clearTask) destekleniyor",
      failMessage: "Pipeline autoChain kısıtlı — fazlar manuel ilerler",
      fixHint: "Self-Build tam otomasyon için Cline fork gerekir.",
    },
  ];

  for (const entry of capabilityChecks) {
    const supported = Boolean(probe.capabilities?.[entry.key]);
    pushCheck(checks, {
      id: entry.id,
      status: supported ? "pass" : "warn",
      message: supported ? entry.passMessage : entry.failMessage,
      fixHint: supported ? "" : entry.fixHint,
    });
  }

  return probe;
}

function resolveSystemPythonBin() {
  const candidates = process.platform === "win32"
    ? ["python", "python3", "py"]
    : ["python3", "python"];
  for (const command of candidates) {
    try {
      execFileSync(command, ["--version"], {
        encoding: "utf8",
        timeout: 5000,
        windowsHide: true,
        stdio: ["ignore", "pipe", "ignore"],
      });
      return command;
    } catch {
      // try next
    }
  }
  return null;
}

function checkPythonSystem() {
  const pythonBin = resolveSystemPythonBin();
  if (pythonBin) {
    return {
      id: "python-system",
      status: "pass",
      message: `Sistem Python bulundu (${pythonBin})`,
      fixHint: "",
    };
  }
  return {
    id: "python-system",
    status: "warn",
    message: "Sistem Python bulunamadı",
    fixHint: "Browser agent için Ayarlar → Eklentiler → Browser → Runtime indir veya Python 3.11+ kurun.",
  };
}

function checkPythonRuntime() {
  const runtimeInfo = getInstalledRuntimeInfo();
  if (runtimeInfo?.pythonBin) {
    return {
      id: "python-runtime",
      status: "pass",
      message: `Browser runtime hazır (${runtimeInfo.pythonBin})`,
      fixHint: "",
    };
  }
  return {
    id: "python-runtime",
    status: "warn",
    message: "Browser Python runtime indirilmemiş",
    fixHint: "Ayarlar → Eklentiler → Browser bölümünden Runtime indir butonuna basın.",
  };
}

function checkPythonSidecarScript() {
  const scriptPath = resolveChildProcessAssetPath(
    path.join(__dirname, "..", "plugins", "browser", "python", "agent_server.py"),
  );
  if (scriptPath && fs.existsSync(scriptPath)) {
    return {
      id: "python-sidecar-script",
      status: "pass",
      message: "Browser sidecar script pakette mevcut",
      fixHint: "",
    };
  }
  return {
    id: "python-sidecar-script",
    status: "fail",
    message: "Browser sidecar script bulunamadı (agent_server.py)",
    fixHint: "Uygulamayı yeniden kurun veya geliştirme modunda OpenGuider-main dizininden çalıştırın.",
  };
}

function checkBrowserAgentReady() {
  const runtimeInfo = getInstalledRuntimeInfo();
  const scriptPath = resolveChildProcessAssetPath(
    path.join(__dirname, "..", "plugins", "browser", "python", "agent_server.py"),
  );
  const scriptOk = scriptPath && fs.existsSync(scriptPath);
  const runtimeOk = Boolean(runtimeInfo?.pythonBin) || Boolean(resolveSystemPythonBin());

  if (scriptOk && runtimeOk) {
    return {
      id: "browser-agent-ready",
      status: "pass",
      message: "Browser agent başlatılabilir",
      fixHint: "",
    };
  }

  return {
    id: "browser-agent-ready",
    status: "warn",
    message: "Browser agent henüz hazır değil",
    fixHint: runtimeInfo?.pythonBin
      ? "Sidecar script eksik — uygulamayı yeniden kurun."
      : "Ayarlar → Eklentiler → Browser → Runtime indir (veya sistem Python kurun).",
  };
}

function appendBrowserAgentChecks(checks, settings = {}) {
  if (settings.browserAgentEnabled === false) {
    pushCheck(checks, {
      id: "browser-agent-ready",
      status: "pass",
      message: "Browser agent devre dışı (atlandı)",
      fixHint: "",
    });
    return;
  }

  pushCheck(checks, checkPythonSystem());
  pushCheck(checks, checkPythonRuntime());
  pushCheck(checks, checkPythonSidecarScript());
  pushCheck(checks, checkBrowserAgentReady());
}

function runSauronDoctor(store, options = {}) {
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

  const clineProbe = appendClineCapabilityChecks(checks, prerequisites);

  const workspacePath = String(store?.get?.("workspacePath") || "").trim();
  pushCheck(checks, checkSauronDir(workspacePath));

  const settings = options.settings || {};
  appendBrowserAgentChecks(checks, {
    browserAgentEnabled: store?.get?.("browserAgentEnabled") !== false,
    ...settings,
  });

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
    clineReport: clineProbe.report,
    clineProbe: {
      variant: clineProbe.variant,
      extensionPath: clineProbe.extensionPath,
      capabilities: clineProbe.capabilities,
    },
  };
}

function getClineCapabilityReport(store) {
  const prerequisites = checkWorkspacePrerequisites();
  const probe = probeClineCapabilities({
    codeCmd: prerequisites.codeCmd || resolveVSCodeCommand(),
  });
  return {
    ok: true,
    ...probe,
    report: probe.report,
  };
}

module.exports = {
  runSauronDoctor,
  getClineCapabilityReport,
};
