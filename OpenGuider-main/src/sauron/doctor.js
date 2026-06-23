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
const { hasAgentCredential } = require("./finops/agent-matrix");
const { isCursorCliPath } = require("./vscode-launcher");
const { discoverGooseBinary, isLikelyGooseDesktopPath } = require("./goose-binary-resolver");

const SOLO_READINESS_IDS = new Set([
  "workspace-path",
  "vscode-cli",
  "vscode-not-cursor",
  "bridge-extension",
  "cline-extension",
  "ai-credentials",
  "sauron-dir",
]);

const CHECK_LABELS = {
  "workspace-path": "Workspace klasörü",
  "vscode-cli": "VS Code CLI",
  "vscode-not-cursor": "VS Code (Cursor değil)",
  "bridge-extension": "Sauron Bridge",
  "cline-extension": "Cline extension",
  "ai-credentials": "AI provider anahtarı",
  "sauron-dir": ".sauron yazılabilirliği",
};

function pushCheck(checks, entry) {
  checks.push({
    id: entry.id,
    status: entry.status,
    message: entry.message,
    fixHint: entry.fixHint || "",
    ...(entry.tier ? { tier: entry.tier } : {}),
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

function checkFinOpsHandoffCache(workspacePath) {
  if (!workspacePath || !fs.existsSync(workspacePath)) {
    return {
      id: "finops-handoff-cache",
      status: "warn",
      message: "Handoff context cache kontrol edilemedi (workspace yok)",
      fixHint: "Önce workspace klasörünü seçin.",
      tier: "optional",
    };
  }
  const cachePath = path.join(workspacePath, ".sauron", "handoff-context-cache.json");
  try {
    const sauronDir = path.join(workspacePath, ".sauron");
    fs.mkdirSync(sauronDir, { recursive: true });
    const probe = { probe: true, at: new Date().toISOString() };
    fs.writeFileSync(cachePath, JSON.stringify(probe), "utf8");
    return {
      id: "finops-handoff-cache",
      status: "pass",
      message: "FinOps handoff context cache yazılabilir",
      fixHint: "",
      tier: "optional",
    };
  } catch (error) {
    return {
      id: "finops-handoff-cache",
      status: "warn",
      message: `Handoff cache yazılamadı: ${error?.message || error}`,
      fixHint: "Workspace .sauron/ klasörüne yazma izni verin.",
      tier: "optional",
    };
  }
}

function parseRulesVersionFromFile(rulesPath) {
  try {
    const content = fs.readFileSync(rulesPath, "utf8");
    const match = content.match(/sauron-rules-version:\s*([^\s>]+)/i);
    return match ? String(match[1]).trim() : "";
  } catch {
    return "";
  }
}

function compareRulesVersion(left, right) {
  const partsLeft = String(left || "0").split(".").map((part) => Number(part) || 0);
  const partsRight = String(right || "0").split(".").map((part) => Number(part) || 0);
  for (let index = 0; index < 3; index += 1) {
    const a = partsLeft[index] || 0;
    const b = partsRight[index] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

function checkFinOpsRulesVersion(workspacePath) {
  if (!workspacePath || !fs.existsSync(workspacePath)) {
    return {
      id: "finops-rules-version",
      status: "warn",
      message: "Cline kuralları sürümü kontrol edilemedi (workspace yok)",
      fixHint: "Handoff ile workspace kurallarını seed edin.",
      tier: "optional",
    };
  }
  const rulesPath = path.join(workspacePath, ".clinerules", "sauron-workspace.md");
  if (!fs.existsSync(rulesPath)) {
    return {
      id: "finops-rules-version",
      status: "warn",
      message: "sauron-workspace.md bulunamadı (v1.3 bekleniyor)",
      fixHint: "Bir handoff başlatın veya workspace bootstrap çalıştırın.",
      tier: "optional",
    };
  }
  const version = parseRulesVersionFromFile(rulesPath);
  if (compareRulesVersion(version, "1.3") >= 0) {
    return {
      id: "finops-rules-version",
      status: "pass",
      message: `Cline kuralları güncel (v${version || "1.3"})`,
      fixHint: "",
      tier: "optional",
    };
  }
  return {
    id: "finops-rules-version",
    status: "warn",
    message: `Cline kuralları eski (v${version || "?"} — v1.3 önerilir)`,
    fixHint: "Yeni bir handoff başlatın; kurallar otomatik güncellenir.",
    tier: "optional",
  };
}

function checkBridgeVsix() {
  const optionalTier = { tier: "optional" };
  const vsixPath = getBridgeVsixPath();
  if (fs.existsSync(vsixPath)) {
    return {
      id: "bridge-vsix",
      status: "pass",
      message: `Bridge VSIX mevcut (${path.basename(vsixPath)})`,
      fixHint: "",
      ...optionalTier,
    };
  }
  return {
    id: "bridge-vsix",
    status: "warn",
    message: "Bridge VSIX henüz derlenmemiş",
    fixHint: "Settings → Bridge'i kur / yenile veya scripts/install-sauron-stack.ps1 çalıştırın.",
    ...optionalTier,
  };
}

function checkVscodeNotCursor(prerequisites) {
  if (!prerequisites.vscodeCli) {
    return {
      id: "vscode-not-cursor",
      status: "pass",
      message: "VS Code CLI (Cursor kontrolü atlandı)",
      fixHint: "",
    };
  }
  const codeCmd = String(prerequisites.codeCmd || "");
  if (isCursorCliPath(codeCmd)) {
    return {
      id: "vscode-not-cursor",
      status: "fail",
      message: "PATH'teki code komutu Cursor shim gibi görünüyor",
      fixHint: "Gerçek VS Code kurun; Ayarlar → Çalışma Kısmı → VS Code yolu veya PATH'teki code komutu Cursor olmamalı.",
    };
  }
  return {
    id: "vscode-not-cursor",
    status: "pass",
    message: "VS Code CLI Cursor değil",
    fixHint: "",
  };
}

function appendClineCapabilityChecks(checks, prerequisites, options = {}) {
  const probe = probeClineCapabilities({
    codeCmd: prerequisites.codeCmd || resolveVSCodeCommand(),
  });
  const report = probe.report;
  const selfBuildEnabled = options.selfBuildEnabled !== false;

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
    if (entry.id === "cap-pipeline-autochain" && !selfBuildEnabled) {
      pushCheck(checks, {
        id: entry.id,
        status: "pass",
        message: "Build pipeline devre dışı (atlandı)",
        fixHint: "",
        tier: "optional",
      });
      continue;
    }
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

function resolveOptionalToolBin(toolName) {
  const candidates = process.platform === "win32"
    ? [`${toolName}.cmd`, toolName]
    : [toolName];
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

function checkWebStudioReady(store) {
  const workspacePath = String(store?.get?.("workspacePath") || "").trim();
  const base = {
    id: "web-studio-ready",
    tier: "optional",
  };
  if (!workspacePath) {
    return {
      ...base,
      status: "warn",
      message: "Web Studio için workspace klasörü seçilmemiş",
      fixHint: "Ayarlar → Workspace → proje kök klasörünü seçin.",
    };
  }
  if (!fs.existsSync(workspacePath)) {
    return {
      ...base,
      status: "fail",
      message: `Web Studio workspace bulunamadı: ${workspacePath}`,
      fixHint: "Geçerli bir klasör seçin veya yolu düzeltin.",
    };
  }
  try {
    fs.accessSync(workspacePath, fs.constants.R_OK | fs.constants.W_OK);
  } catch {
    return {
      ...base,
      status: "fail",
      message: `Web Studio workspace yazılabilir değil: ${workspacePath}`,
      fixHint: "Klasör izinlerini kontrol edin.",
    };
  }

  const nodeBin = resolveOptionalToolBin("node");
  const npmBin = resolveOptionalToolBin("npm");
  if (!nodeBin || !npmBin) {
    return {
      ...base,
      status: "warn",
      message: "Web Studio scaffold için Node.js/npm PATH'te bulunamadı",
      fixHint: "nodejs.org adresinden Node.js LTS kurun (npm dahil).",
    };
  }

  return {
    ...base,
    status: "pass",
    message: "Web Studio hazır (workspace + Node.js)",
    fixHint: "",
  };
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
      tier: "optional",
    };
  }

  return {
    id: "browser-agent-ready",
    status: "warn",
    message: "Browser agent henüz hazır değil",
    fixHint: runtimeInfo?.pythonBin
      ? "Sidecar script eksik — uygulamayı yeniden kurun."
      : "Ayarlar → Eklentiler → Browser → Runtime indir (veya sistem Python kurun).",
    tier: "optional",
  };
}

function appendWebStudioCheck(checks, store, settings = {}) {
  if (settings.webStudioEnabled === false) {
    pushCheck(checks, {
      id: "web-studio-ready",
      status: "pass",
      message: "Web Studio devre dışı (atlandı)",
      fixHint: "",
      tier: "optional",
    });
    return;
  }
  pushCheck(checks, checkWebStudioReady(store));
}

function appendBrowserAgentChecks(checks, settings = {}) {
  if (settings.browserAgentEnabled === false) {
    pushCheck(checks, {
      id: "browser-agent-ready",
      status: "pass",
      message: "Browser agent devre dışı (atlandı)",
      fixHint: "",
      tier: "optional",
    });
    return;
  }

  const optionalTier = { tier: "optional" };
  pushCheck(checks, { ...checkPythonSystem(), ...optionalTier });
  pushCheck(checks, { ...checkPythonRuntime(), ...optionalTier });
  pushCheck(checks, { ...checkPythonSidecarScript(), ...optionalTier });
  pushCheck(checks, checkBrowserAgentReady());
}

function checkAiCredentials(settings = {}) {
  const agents = ["gemini", "deepseek", "openai", "ollama"];
  const configured = agents.filter((agentId) => hasAgentCredential(settings, agentId));
  if (configured.length > 0) {
    return {
      id: "ai-credentials",
      status: "pass",
      message: `AI provider yapılandırıldı (${configured.join(", ")})`,
      fixHint: "",
    };
  }
  return {
    id: "ai-credentials",
    status: "fail",
    message: "En az bir AI provider anahtarı yapılandırılmamış",
    fixHint: "Ayarlar → AI provider bölümünden API key girin.",
  };
}

function computeReadinessReport(checks = []) {
  const actionItems = [];
  const warnings = [];

  for (const check of checks) {
    if (check.tier === "optional") {
      if (check.status === "warn" || check.status === "fail") {
        warnings.push(check.message);
      }
      continue;
    }

    if (SOLO_READINESS_IDS.has(check.id)) {
      if (check.status !== "pass") {
        actionItems.push({
          id: check.id,
          label: CHECK_LABELS[check.id] || check.message,
          fixHint: check.fixHint || check.message,
        });
      }
      continue;
    }

    if (check.status === "fail") {
      actionItems.push({
        id: check.id,
        label: check.message,
        fixHint: check.fixHint || check.message,
      });
    } else if (check.status === "warn") {
      warnings.push(check.message);
    }
  }

  const status = actionItems.length === 0 ? "ready" : "blocked";
  const blockers = actionItems.map((item) => item.fixHint || item.label);
  return {
    status,
    headline: status === "ready" ? "Kullanıma Hazır" : "Eksikler var",
    blockers,
    actionItems,
    warnings,
  };
}

function appendGooseChecks(checks, store, settings = {}) {
  if (settings.gooseEnabled === false) {
    pushCheck(checks, {
      id: "goose-enabled",
      status: "pass",
      message: "Goose Kısmı devre dışı (atlandı)",
      fixHint: "",
      tier: "optional",
    });
    return;
  }

  const binaryPath = discoverGooseBinary({
    gooseBinaryPath: store?.get?.("gooseBinaryPath") || "",
    ...settings,
  });

  if (!binaryPath) {
    pushCheck(checks, {
      id: "goose-binary",
      status: "warn",
      message: "Goose CLI bulunamadı",
      fixHint: "Goose Desktop yeterli değil — CLI kurun (%USERPROFILE%\\.local\\bin\\goose.exe) veya Ayarlar → Goose binary yolunu girin.",
      tier: "optional",
    });
  } else if (isLikelyGooseDesktopPath(binaryPath)) {
    pushCheck(checks, {
      id: "goose-binary",
      status: "warn",
      message: "Goose Desktop bulundu (CLI değil)",
      fixHint: "Start Menu'deki Goose Desktop değil; terminal CLI kurun: download_cli.ps1",
      tier: "optional",
    });
  } else {
    pushCheck(checks, {
      id: "goose-binary",
      status: "pass",
      message: `Goose binary: ${path.basename(binaryPath)}`,
      fixHint: "",
      tier: "optional",
    });
  }

  const ollamaUrl = String(settings.ollamaUrl || "http://localhost:11434").trim();
  const hasOllamaModel = Boolean(String(settings.ollamaModelCustom || "").trim());
  if (!hasOllamaModel) {
    pushCheck(checks, {
      id: "goose-economy-provider",
      status: "warn",
      message: "Goose Economy (Ollama) yapılandırılmamış",
      fixHint: "Ücretsiz Economy mod için Ollama URL ve model adı girin.",
      tier: "optional",
    });
    return;
  }

  pushCheck(checks, {
    id: "goose-economy-provider",
    status: "pass",
    message: `Goose Economy (Ollama) yapılandırıldı: ${ollamaUrl}`,
    fixHint: "",
    tier: "optional",
  });
}

function appendCodeAgentChecks(checks, store, settings = {}) {
  if (settings.codeAgentNativeEnabled !== true) {
    pushCheck(checks, {
      id: "code-agent-ready",
      status: "pass",
      message: "Yerel Kod Agent devre dışı (atlandı)",
      fixHint: "",
      tier: "optional",
    });
    return;
  }
  const workspacePath = String(store?.get?.("workspacePath") || "").trim();
  if (!workspacePath) {
    pushCheck(checks, {
      id: "code-agent-ready",
      status: "fail",
      message: "Kod Agent için workspace seçilmemiş",
      fixHint: "Ayarlar → Çalışma Kısmı → klasör seçin.",
      tier: "optional",
    });
    return;
  }
  pushCheck(checks, checkSauronDir(workspacePath));
  try {
    const { getIndexStatus } = require("../code-agent/codebase-indexer");
    const indexStatus = getIndexStatus(workspacePath);
    if (!indexStatus.built) {
      pushCheck(checks, {
        id: "code-index-stale",
        status: "warn",
        message: "Kod indeksi henüz oluşturulmamış",
        fixHint: "Code Studio veya kod görevi başlatınca otomatik oluşur.",
        tier: "optional",
      });
    } else if (indexStatus.stale) {
      pushCheck(checks, {
        id: "code-index-stale",
        status: "warn",
        message: "Kod indeksi eski (>24s)",
        fixHint: "Workspace'te yeniden index çalıştırın.",
        tier: "optional",
      });
    } else {
      pushCheck(checks, {
        id: "code-index-stale",
        status: "pass",
        message: `Kod indeksi güncel (${indexStatus.fileCount} dosya)`,
        fixHint: "",
        tier: "optional",
      });
    }
  } catch {
    // optional
  }
  pushCheck(checks, {
    id: "code-agent-ready",
    status: "pass",
    message: "Yerel Kod Agent hazır",
    fixHint: "",
    tier: "optional",
  });
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

  pushCheck(checks, checkVscodeNotCursor(prerequisites));

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

  const runtimeSettings = {
    browserAgentEnabled: store?.get?.("browserAgentEnabled") !== false,
    webStudioEnabled: store?.get?.("webStudioEnabled") !== false,
    selfBuildEnabled: store?.get?.("selfBuildEnabled") !== false,
    codeAgentNativeEnabled: store?.get?.("codeAgentNativeEnabled") === true,
    ...(options.settings || {}),
  };

  const clineProbe = appendClineCapabilityChecks(checks, prerequisites, {
    selfBuildEnabled: runtimeSettings.selfBuildEnabled,
  });

  const workspacePath = String(store?.get?.("workspacePath") || "").trim();
  pushCheck(checks, checkSauronDir(workspacePath));
  pushCheck(checks, checkFinOpsHandoffCache(workspacePath));
  pushCheck(checks, checkFinOpsRulesVersion(workspacePath));

  appendBrowserAgentChecks(checks, runtimeSettings);
  appendWebStudioCheck(checks, store, runtimeSettings);
  appendGooseChecks(checks, store, runtimeSettings);
  appendCodeAgentChecks(checks, store, runtimeSettings);
  pushCheck(checks, checkAiCredentials(runtimeSettings));

  const failCount = checks.filter((entry) => entry.status === "fail").length;
  const warnCount = checks.filter((entry) => entry.status === "warn").length;
  const readiness = computeReadinessReport(checks);

  return {
    ok: failCount === 0,
    checks,
    readiness,
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
  checkBrowserAgentReady,
  checkWebStudioReady,
  checkAiCredentials,
  computeReadinessReport,
  checkVscodeNotCursor,
};
