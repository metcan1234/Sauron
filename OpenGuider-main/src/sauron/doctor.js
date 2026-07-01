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
const channelRuntime = require("./channel-runtime");
const { discoverGooseBinary, isLikelyGooseDesktopPath, isExecutableFile } = require("./goose-binary-resolver");
const { probeGamedevMcpEntry } = require("./gamedev-path-resolver");
const { normalizeGamedevEngine } = require("./gamedev-config");
const { resolveUsageLogPath } = require("./finops/usage-tracker");

// ── Vision model support ──────────────────────────────────────────────────────
const VISION_MODELS = new Set([
  "gpt-4o", "gpt-4o-mini", "gpt-4", "gpt-4-turbo",
  "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash",
  "gemini-2.0-flash-lite", "gemini-pro-vision",
  "claude-3-5-sonnet", "claude-3-5-haiku", "claude-sonnet-4-5",
  "llama-3.2", "llama-3.1",
]);

/**
 * Check whether the selected model supports vision (image input).
 * @param {object} settings — runtime settings with aiProvider and aiModel
 * @returns {{ visionCapable: boolean, model: string, warning: string|null }}
 */
function checkVisionModelSupport(settings = {}) {
  const provider = String(settings.aiProvider || "").toLowerCase();
  const model = String(settings.aiModel || "").toLowerCase();

  if (!provider || !model) {
    return { visionCapable: true, model: model || "unknown", warning: null };
  }

  // DeepSeek is text-only
  if (provider === "deepseek") {
    return {
      visionCapable: false,
      model: `${provider}/${model}`,
      warning: `Seçili model (${provider}/${model}) görsel girdileri işleyemez. Görsel eklemek için GPT-4o veya Gemini kullanın.`,
    };
  }

  // Check if model is in known vision-capable list
  const visionCapable = [...VISION_MODELS].some((vm) => model.includes(vm));
  if (!visionCapable) {
    return {
      visionCapable: false,
      model: `${provider}/${model}`,
      warning: `Seçili model (${provider}/${model}) görsel girdileri işleyemeyebilir. Emin değilseniz GPT-4o veya Gemini seçin.`,
    };
  }

  return { visionCapable: true, model: `${provider}/${model}`, warning: null };
}

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

function checkGooseBinary(settings = {}) {
  const binaryPath = discoverGooseBinary(settings);
  if (binaryPath && isExecutableFile(binaryPath) && !isLikelyGooseDesktopPath(binaryPath)) {
    return {
      id: 'goose-binary',
      status: 'pass',
      message: `Goose CLI hazır (${path.basename(binaryPath)})`,
      fixHint: '',
    };
  }
  return {
    id: 'goose-binary',
    status: 'warn',
    message: 'Goose CLI bulunamadı',
    fixHint: 'SAURON/goose/goose.exe yolunu kontrol edin veya Ayarlar → Goose binary girin.',
  };
}

function checkGamedevMcpEntry(settings = {}) {
  const probe = probeGamedevMcpEntry(settings);
  if (probe.ok) {
    return {
      id: "gamedev-mcp-entry",
      status: "pass",
      message: `Game Dev MCP entry mevcut (${probe.entryPath})`,
      fixHint: "",
    };
  }
  return {
    id: "gamedev-mcp-entry",
    status: "fail",
    message: probe.error || "Game Dev MCP entry bulunamadı",
    fixHint: "extensions/gamedev-all-in-one/dist/index.js dosyasının build edildiğinden emin olun.",
  };
}

function checkFinOpsLedgerWritable(settings = {}) {
  const logPath = resolveUsageLogPath(settings);
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.accessSync(path.dirname(logPath), fs.constants.W_OK);
    return {
      id: "finops-ledger-writable",
      status: "pass",
      message: `Token ledger yazılabilir (${logPath})`,
      fixHint: "",
      tier: "optional",
    };
  } catch (error) {
    return {
      id: "finops-ledger-writable",
      status: "warn",
      message: `Token ledger yazılamıyor: ${error?.message || error}`,
      fixHint: "Workspace .sauron/usage/ klasör izinlerini kontrol edin.",
      tier: "optional",
    };
  }
}

function checkGamedevTcpBridgeSync() {
  const { probeTcpPortSync } = require("./gamedev-bridge-probe");
  const unityOpen = probeTcpPortSync("127.0.0.1", 7890);
  const unrealOpen = probeTcpPortSync("127.0.0.1", 55557);
  if (unityOpen || unrealOpen) {
    const parts = [];
    if (unityOpen) parts.push("7890");
    if (unrealOpen) parts.push("55557");
    return {
      id: "gamedev-tcp-bridge",
      status: "pass",
      message: `Game Dev TCP bridge açık (port ${parts.join(", ")})`,
      fixHint: "",
      tier: "optional",
    };
  }
  return {
    id: "gamedev-tcp-bridge",
    status: "warn",
    message: "Game Dev TCP bridge kapalı (7890/55557)",
    fixHint: "Unity/Unreal editor + MCP plugin çalışırken doctor'u yeniden çalıştırın.",
    tier: "optional",
  };
}

function checkGamedevUnityBridge(settings = {}) {
  const engine = String(settings.gamedevActiveEngine || "unity").toLowerCase();
  if (engine !== "unity") {
    return {
      id: "gamedev-unity-bridge",
      status: "pass",
      message: "Unity bridge kontrolü atlandı (engine unreal)",
      fixHint: "",
    };
  }
  return {
    id: "gamedev-unity-bridge",
    status: "warn",
    message: "Unity MCP plugin kurulumu gerekli (TCP 7890)",
    fixHint: "docs/gamedev-unity-setup.md — CoplayDev unity-mcp veya IvanMurzak Unity-MCP kurun.",
  };
}

function checkGamedevUnrealBridge(settings = {}) {
  const engine = String(settings.gamedevActiveEngine || "unity").toLowerCase();
  if (engine !== "unreal") {
    return {
      id: "gamedev-unreal-bridge",
      status: "pass",
      message: "Unreal bridge kontrolü atlandı (engine unity)",
      fixHint: "",
    };
  }
  return {
    id: "gamedev-unreal-bridge",
    status: "warn",
    message: "Unreal MCP plugin kurulumu gerekli (TCP 55557)",
    fixHint: "docs/gamedev-unreal-setup.md — Funplay veya ue-mcp plugin kurun.",
  };
}

/**
 * Get all blockers for a specific channel.
 * @param {string} channelId - 'workspace' | 'goose' | 'gamedev' | 'browser'
 * @param {object} store - electron-store instance
 * @param {object} [options] - { settings }
 * @returns {string[]} array of user-facing blocker messages
 */
function getBlockersForChannel(channelId, store, options = {}) {
  const prerequisites = checkWorkspacePrerequisites();
  const settings = {
    browserAgentEnabled: store?.get?.('browserAgentEnabled') !== false,
    webStudioEnabled: store?.get?.('webStudioEnabled') !== false,
    ...(options.settings || {}),
  };
  const workspacePath = String(store?.get?.('workspacePath') || '').trim();
  const blockers = [];

  const CHANNEL_BLOCKERS = {
    workspace: [
      { ok: prerequisites.vscodeCli, msg: 'VS Code CLI (code) bulunamadı', fix: 'VS Code → Command Palette → Shell Command: Install "code" command in PATH' },
      { ok: prerequisites.bridgeExtension, msg: 'Sauron Bridge VSIX yüklü değil', fix: '⌘ ile otomatik kurulum yapın veya Settings → Bridge → Kur' },
      { ok: prerequisites.clineExtension, msg: 'Cline extension yüklü değil', fix: 'VS Code Extensions → Cline (saoudrizwan.claude-dev) kurun' },
      { ok: Boolean(workspacePath && fs.existsSync(workspacePath)), msg: 'Workspace klasörü seçilmemiş veya bulunamıyor', fix: 'Ayarlar → Çalışma Kısmı → klasör seçin' },
      { ok: prerequisites.codeCmd ? !isCursorCliPath(prerequisites.codeCmd) : true, msg: 'VS Code CLI Cursor shim gibi görünüyor', fix: 'Gerçek VS Code kurun' },
    ],
    goose: [
      { ok: Boolean(settings.gooseEnabled !== false && discoverGooseBinary(settings)), msg: 'Goose CLI bulunamadı', fix: 'Ayarlar → AI Ajanları → Goose yolunu kontrol edin' },
      { ok: Boolean(workspacePath && fs.existsSync(workspacePath)), msg: 'Workspace klasörü seçilmemiş', fix: 'Ayarlar → Çalışma Kısmı → klasör seçin' },
    ],
    gamedev: [
      { ok: prerequisites.vscodeCli, msg: 'VS Code CLI (code) bulunamadı', fix: 'VS Code → Shell Command: Install "code" command in PATH' },
      { ok: prerequisites.clineExtension, msg: 'Cline extension yüklü değil', fix: 'VS Code → Cline kurun' },
      { ok: Boolean(settings.gamedevEnabled !== false && probeGamedevMcpEntry(settings).ok), msg: 'Game Dev MCP entry bulunamadı', fix: 'extensions/gamedev-all-in-one/dist/index.js build edin' },
      { ok: Boolean(workspacePath && fs.existsSync(workspacePath)), msg: 'Workspace klasörü seçilmemiş', fix: 'Ayarlar → Çalışma Kısmı → klasör seçin' },
    ],
    browser: [
      { ok: Boolean(checkPythonSidecarScript().status === 'pass'), msg: 'Browser sidecar script (agent_server.py) bulunamadı', fix: 'Uygulamayı yeniden kurun' },
      { ok: Boolean(checkPythonRuntime().status === 'pass' || checkPythonSystem().status === 'pass'), msg: 'Browser Python runtime hazır değil', fix: 'Ayarlar → Eklentiler → Browser → Runtime indir veya sistem Python 3.11+ kurun' },
    ],
  };

  const rules = CHANNEL_BLOCKERS[channelId];
  if (!rules) return blockers;

  for (const rule of rules) {
    if (!rule.ok) {
      blockers.push(`${rule.msg}. ${rule.fix}`);
    }
  }
  return blockers;
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
  appendCodeAgentChecks(checks, store, runtimeSettings);
  pushCheck(checks, checkAiCredentials(runtimeSettings));

  pushCheck(checks, checkFinOpsLedgerWritable({ workspacePath, ...runtimeSettings }));

  const {
    checkGamedevEngineBridgeSync,
    checkGamedevProjectEngineMatch,
    checkGamedevCompatManifest,
  } = require("./gamedev-health");
  pushCheck(checks, checkGamedevEngineBridgeSync(runtimeSettings, workspacePath));
  pushCheck(checks, checkGamedevProjectEngineMatch(runtimeSettings, workspacePath));
  pushCheck(checks, checkGamedevCompatManifest(runtimeSettings, workspacePath));
  if (normalizeGamedevEngine(runtimeSettings.gamedevActiveEngine || "unity") === "unreal") {
    const { checkGamedevUnrealPluginInstalled } = require("./gamedev-health");
    pushCheck(checks, checkGamedevUnrealPluginInstalled(runtimeSettings, workspacePath));
  }

  // ── Additional channel-specific checks ───────────────────────────────
  pushCheck(checks, checkGooseBinary(runtimeSettings));
  pushCheck(checks, checkGamedevMcpEntry(runtimeSettings));

  // ── Channel Runtime Health ────────────────────────────────────────────
  const channelLabels = { workspace: '⌘ Çalışma Kısmı', goose: '🪿 Goose', gamedev: '🎮 Game Dev', browser: 'Browser Agent' };
  for (const [ch, label] of Object.entries(channelLabels)) {
    const state = channelRuntime.getState(ch);
    if (!state.registered) continue;
    if (state.alive) {
      pushCheck(checks, {
        id: `runtime-${ch}`,
        status: 'pass',
        message: `${label}: çalışıyor (PID ${state.pid})`,
        fixHint: '',
      });
    } else {
      pushCheck(checks, {
        id: `runtime-${ch}`,
        status: 'warn',
        message: `${label}: kayıtlı ama process yanıt vermiyor (zombie olabilir)`,
        fixHint: `Gerekmiyorsa channel-runtime-kill:${ch} ile temizleyin veya Sauron'u yeniden başlatın.`,
      });
    }
  }

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
  checkGooseBinary,
  checkGamedevMcpEntry,
  checkGamedevUnityBridge,
  checkGamedevUnrealBridge,
  checkVisionModelSupport,
  computeReadinessReport,
  checkVscodeNotCursor,
  getBlockersForChannel,
};
