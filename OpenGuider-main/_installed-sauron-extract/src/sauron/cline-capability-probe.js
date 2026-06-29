const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { resolveVSCodeCommand } = require("./handoff");

const CLINE_EXTENSION_ID = "saoudrizwan.claude-dev";

const FORK_API_MARKERS = [
  "syncProviderCredentials",
  "setActiveModel",
  "clearTask",
  "getTaskState",
  "getActiveTaskMetrics",
];

function listExtensionInstallDirs(extensionId) {
  const roots = [];
  const home = os.homedir();
  if (process.platform === "win32") {
    roots.push(path.join(process.env.USERPROFILE || home, ".vscode", "extensions"));
    roots.push(path.join(process.env.USERPROFILE || home, ".vscode-insiders", "extensions"));
  } else if (process.platform === "darwin") {
    roots.push(path.join(home, ".vscode", "extensions"));
    roots.push(path.join(home, ".vscode-insiders", "extensions"));
  } else {
    roots.push(path.join(home, ".vscode", "extensions"));
    roots.push(path.join(home, ".vscode-insiders", "extensions"));
  }

  const prefix = `${extensionId.toLowerCase()}-`;
  const matches = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) {
      continue;
    }
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      if (entry.name.toLowerCase().startsWith(prefix)) {
        matches.push(path.join(root, entry.name));
      }
    }
  }

  matches.sort((a, b) => {
    const statA = fs.statSync(a);
    const statB = fs.statSync(b);
    return statB.mtimeMs - statA.mtimeMs;
  });
  return matches;
}

function locateExtensionViaCodeCli(codeCmd, extensionId) {
  if (!codeCmd || !fs.existsSync(codeCmd)) {
    return null;
  }
  try {
    const result = process.platform === "win32"
      ? execFileSync(codeCmd, ["--locate-extension", extensionId], {
        encoding: "utf8",
        timeout: 15000,
        windowsHide: true,
      })
      : execFileSync(codeCmd, ["--locate-extension", extensionId], {
        encoding: "utf8",
        timeout: 15000,
      });
    const located = String(result || "").trim().split(/\r?\n/).find(Boolean);
    if (located && fs.existsSync(located)) {
      return located;
    }
  } catch {
    // fall through to directory scan
  }
  return null;
}

function collectCandidateFiles(extensionDir, limit = 24) {
  const files = [];
  const queue = [{ dir: extensionDir, depth: 0 }];
  while (queue.length > 0 && files.length < limit) {
    const { dir, depth } = queue.shift();
    if (depth > 4) {
      continue;
    }
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (files.length >= limit) {
        break;
      }
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) {
          continue;
        }
        queue.push({ dir: fullPath, depth: depth + 1 });
        continue;
      }
      if (!/\.(js|mjs|cjs)$/i.test(entry.name)) {
        continue;
      }
      files.push(fullPath);
    }
  }
  return files;
}

function extensionHasForkMarkers(extensionDir) {
  const files = collectCandidateFiles(extensionDir);
  let hits = 0;
  for (const filePath of files) {
    let content = "";
    try {
      const stat = fs.statSync(filePath);
      if (stat.size > 2_000_000) {
        continue;
      }
      content = fs.readFileSync(filePath, "utf8");
    } catch {
      continue;
    }
    for (const marker of FORK_API_MARKERS) {
      if (content.includes(marker)) {
        hits += 1;
      }
    }
    if (hits >= 2) {
      return true;
    }
  }
  return hits >= 2;
}

function buildCapabilitiesForVariant(variant) {
  const isFork = variant === "fork";
  const isMarketplace = variant === "marketplace";
  const installed = variant !== "not_installed" && variant !== "unknown";

  return {
    handoff: installed,
    startTask: installed,
    finopsTracking: installed,
    modelRouting: isFork,
    credentialSync: isFork,
    pipelineAutoChain: isFork,
    taskCompleteExport: isFork,
    degradedOnMarketplace: isMarketplace,
  };
}

function buildCapabilityReport(probeResult) {
  const { variant, extensionPath, capabilities } = probeResult;
  const works = [];
  const limited = [];

  if (variant === "not_installed") {
    return {
      variant,
      extensionPath,
      capabilities,
      works,
      limited: [
        "Cline extension yüklü değil — handoff ve görev başlatma çalışmaz.",
      ],
      summary: "Cline yüklü değil",
    };
  }

  if (capabilities.handoff) {
    works.push("Handoff dosyası okuma ve Cline'a görev yükleme");
  }
  if (capabilities.startTask) {
    works.push("Görev başlatma (startNewTask / addToInput)");
  }
  if (capabilities.finopsTracking) {
    works.push("FinOps takibi (Core + Cline readonly usage sync)");
  }

  if (!capabilities.modelRouting) {
    limited.push("Otomatik model routing (setActiveModel) — Cline fork gerektirir");
  }
  if (!capabilities.credentialSync) {
    limited.push("API anahtarı otomatik senkronu — Cline fork gerektirir");
  }
  if (!capabilities.pipelineAutoChain) {
    limited.push("Build pipeline otomatik faz zinciri (autoChain / clearTask) — Cline fork gerektirir");
  }
  if (!capabilities.taskCompleteExport) {
    limited.push("Cline görev metrik export (getActiveTaskMetrics) — fork ile tam entegrasyon");
  }

  const variantLabel = variant === "fork"
    ? "Cline fork"
    : variant === "marketplace"
      ? "Marketplace Cline"
      : "Cline (sürüm belirsiz)";

  const summary = variant === "fork"
    ? `${variantLabel} — tüm Sauron entegrasyonları desteklenir`
    : `${variantLabel} — handoff çalışır; routing/sync/autoChain kısıtlı`;

  return {
    variant,
    extensionPath,
    capabilities,
    works,
    limited,
    summary,
  };
}

function probeClineInstallation(options = {}) {
  const extensionId = options.extensionId || CLINE_EXTENSION_ID;
  const codeCmd = options.codeCmd || resolveVSCodeCommand();
  let extensionPath = locateExtensionViaCodeCli(codeCmd, extensionId);
  if (!extensionPath) {
    const dirs = listExtensionInstallDirs(extensionId);
    extensionPath = dirs[0] || null;
  }

  if (!extensionPath) {
    return {
      variant: "not_installed",
      extensionPath: null,
      extensionId,
      capabilities: buildCapabilitiesForVariant("not_installed"),
    };
  }

  const hasForkMarkers = extensionHasForkMarkers(extensionPath);
  const variant = hasForkMarkers ? "fork" : "marketplace";
  return {
    variant,
    extensionPath,
    extensionId,
    capabilities: buildCapabilitiesForVariant(variant),
  };
}

function probeClineCapabilities(options = {}) {
  const probeResult = probeClineInstallation(options);
  return {
    ...probeResult,
    report: buildCapabilityReport(probeResult),
  };
}

function getForkLimitations(probeResult) {
  const report = probeResult?.report || buildCapabilityReport(probeResult || { variant: "unknown" });
  return Array.isArray(report.limited) ? [...report.limited] : [];
}

function requiresForkForAutoChain(probeResult) {
  const variant = probeResult?.variant || probeResult?.report?.variant;
  return variant !== "fork";
}

module.exports = {
  CLINE_EXTENSION_ID,
  FORK_API_MARKERS,
  listExtensionInstallDirs,
  locateExtensionViaCodeCli,
  extensionHasForkMarkers,
  buildCapabilitiesForVariant,
  buildCapabilityReport,
  probeClineInstallation,
  probeClineCapabilities,
  getForkLimitations,
  requiresForkForAutoChain,
};
