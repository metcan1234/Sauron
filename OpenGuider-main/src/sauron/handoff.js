const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawn, execFileSync } = require("child_process");
const {
  mergeCostOptimizerConfig,
  computeComplexityHint,
} = require("./finops/cost-optimizer-config");

const SAURON_RULES_FILENAME = "sauron-workspace.md";
const HANDOFF_DIR = ".sauron";
const LEGACY_HANDOFF_FILE = "handoff.json";

const SAURON_RULES_CONTENT = `# Sauron Workspace — Cline Kuralları

## Token / Maliyet Disiplini
1. Her görev öncesi kısa bir plan yaz (2-5 madde), onaysız uzun kod bloklarına girme.
2. Büyük dosyaları (200+ satır) tam okumadan önce, gerçekten gerekli mi diye düşün; sadece ilgili bölümü oku/düzenle.
3. Aynı bağlamı (dosya içeriği, önceki cevaplar) tekrar tekrar modele gönderme; oturum içi hafızayı kullan.
4. Ucuz/yerel model (Ollama) yeterli olan basit işlerde (formatlama, küçük refactor, dosya arama) GPT/Gemini gibi pahalı modellere geçme; görev karmaşıklığına göre model seç.
5. Bir günlük/oturumluk yaklaşık bir bütçe sınırın varsa, sınıra yaklaşınca kullanıcıyı uyar ve ucuz modele düşmeyi öner.

## Onay Kapıları (Approval Gates)
6. Dosya yazma/silme işleminden önce mutlaka diff göster ve onay iste — "yolo" / oto-onay modu sadece kullanıcı açıkça etkinleştirirse kullanılsın.
7. Git commit ve push işlemlerini kullanıcı onayı olmadan yapma; commit mesajını göster, push'tan önce ayrıca sor.
8. Terminalde yıkıcı olabilecek komutları (rm -rf, force push, paket kaldırma vb.) çalıştırmadan önce açıkça belirt ve onay iste.
9. Mimari karar gerektiren değişikliklerde (yeni bağımlılık ekleme, klasör yapısını değiştirme) önce kısa bir gerekçe sun, kullanıcı onaylamadan uygulama.
10. Görev tamamlandığında ne yapıldığını kısa özetle (post-flight); sessizce bitirme.

## Genel
11. Hangi modeli (Gemini/Ollama/GPT/DeepSeek) kullandığını görev başında belirt, böylece maliyet/performans takibi yapılabilsin.
12. Workspace dışına (proje klasörü dışındaki dosyalara) yazma yapma.
`;

function isTerminalHandoffName(name) {
  return name.endsWith(".consumed") || name.endsWith(".rejected");
}

function isPendingHandoffFileName(name) {
  if (isTerminalHandoffName(name)) {
    return false;
  }
  if (name === LEGACY_HANDOFF_FILE) {
    return true;
  }
  return /^handoff-.+\.json$/i.test(name);
}

function getSauronDir(workspacePath) {
  return path.join(workspacePath, HANDOFF_DIR);
}

function generateHandoffId() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${stamp}-${crypto.randomUUID()}`;
}

function collectTouchedFiles(snapshot) {
  const files = new Set();
  const plan = snapshot?.activePlan;
  const steps = Array.isArray(plan?.steps) ? plan.steps : [];
  for (const step of steps) {
    for (const field of ["file", "path", "targetFile"]) {
      const value = step?.[field];
      if (value) {
        files.add(String(value).trim());
      }
    }
  }
  const browserFiles = snapshot?.browserExecution?.touchedFiles;
  if (Array.isArray(browserFiles)) {
    for (const file of browserFiles) {
      if (file) {
        files.add(String(file).trim());
      }
    }
  }
  return [...files].filter(Boolean);
}

function truncateTaskSummary(full, maxChars) {
  const text = String(full || "").trim();
  if (!text || text.length <= maxChars) {
    return text;
  }

  const goalBlock = text.match(/Goal:[^\n]*(?:\n(?!Plan steps:|Acceptance:|Touched files:|User intent:|Recent conversation:)[^\n]*)*/)?.[0] || "";
  const stepsBlock = text.match(/Plan steps:[\s\S]*?(?=\n\n(?:Acceptance:|Touched files:|User intent:|Recent conversation:)|$)/)?.[0] || "";
  const preserved = [goalBlock, stepsBlock].filter(Boolean).join("\n\n").trim();

  if (preserved.length >= maxChars) {
    return preserved.slice(0, maxChars);
  }

  const remainder = maxChars - preserved.length - (preserved ? 2 : 0);
  if (remainder <= 0) {
    return preserved;
  }

  const rest = text
    .replace(goalBlock, "")
    .replace(stepsBlock, "")
    .trim();
  return [preserved, rest.slice(0, remainder)].filter(Boolean).join("\n\n");
}

function buildTaskSummary(snapshot, options = {}) {
  const includeTranscript = options.includeTranscript === true;
  const handoffMaxChars = Number.isFinite(Number(options.handoffMaxChars))
    ? Math.max(100, Number(options.handoffMaxChars))
    : 4000;

  const parts = [];

  const finalMessage = snapshot?.browserExecution?.finalMessage;
  if (finalMessage) {
    parts.push(String(finalMessage).trim());
  }

  const plan = snapshot?.activePlan;
  if (plan?.goal) {
    parts.push(`Goal: ${plan.goal}`);
    const steps = Array.isArray(plan.steps) ? plan.steps : [];
    if (steps.length > 0) {
      const stepLines = steps.map((step, index) => {
        const title = step?.title || step?.instruction || `Step ${index + 1}`;
        const status = step?.status || "pending";
        return `- [${status}] ${title}`;
      });
      parts.push(`Plan steps:\n${stepLines.join("\n")}`);
    }
    if (plan.acceptanceCriteria) {
      parts.push(`Acceptance: ${String(plan.acceptanceCriteria).trim()}`);
    }
  }

  if (snapshot?.goalIntent) {
    parts.push(`User intent: ${snapshot.goalIntent}`);
  }

  const touchedFiles = collectTouchedFiles(snapshot);
  if (touchedFiles.length > 0) {
    parts.push(`Touched files:\n${touchedFiles.map((file) => `- ${file}`).join("\n")}`);
  }

  if (includeTranscript) {
    const messages = Array.isArray(snapshot?.messages) ? snapshot.messages : [];
    const recent = messages.slice(-10).filter((m) => m?.content);
    if (recent.length > 0) {
      const transcript = recent
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${String(m.content).trim()}`)
        .join("\n");
      parts.push(`Recent conversation:\n${transcript}`);
    }
  }

  const summary = parts.filter(Boolean).join("\n\n").trim();
  const fallback = summary || "Continue the task discussed in Sauron Core.";
  const truncated = truncateTaskSummary(fallback, handoffMaxChars);
  if (truncated.length <= handoffMaxChars) {
    return truncated;
  }
  return truncated.slice(0, handoffMaxChars);
}

function buildHandoffPayload(sessionSnapshot, workspacePath, handoffId = generateHandoffId(), settings = {}) {
  const optimizer = mergeCostOptimizerConfig(settings);
  const taskSummary = buildTaskSummary(sessionSnapshot, {
    includeTranscript: optimizer.routing.includeTranscript,
    handoffMaxChars: optimizer.routing.handoffMaxChars,
  });
  const complexityHint = computeComplexityHint(taskSummary, optimizer.routing.complexityKeywords);

  return {
    version: 2,
    id: handoffId,
    source: "sauron-core",
    workspacePath,
    taskSummary,
    goal: sessionSnapshot?.goalIntent
      || sessionSnapshot?.activePlan?.goal
      || sessionSnapshot?.browserExecution?.goal
      || "",
    sessionId: sessionSnapshot?.sessionId || "",
    createdAt: new Date().toISOString(),
    autoStart: true,
    complexityHint,
    costContext: {
      coreModelTier: optimizer.coreModelTier,
      optimizerEnabled: optimizer.enabled,
      mode: optimizer.mode,
    },
  };
}

function listPendingHandoffs(workspacePath) {
  const sauronDir = getSauronDir(workspacePath);
  if (!fs.existsSync(sauronDir)) {
    return [];
  }

  const entries = fs.readdirSync(sauronDir, { withFileTypes: true });
  const pending = [];

  for (const entry of entries) {
    if (!entry.isFile() || !isPendingHandoffFileName(entry.name)) {
      continue;
    }
    const fullPath = path.join(sauronDir, entry.name);
    let createdAt = fs.statSync(fullPath).mtime.toISOString();
    try {
      const parsed = JSON.parse(fs.readFileSync(fullPath, "utf8"));
      if (parsed?.createdAt) {
        createdAt = parsed.createdAt;
      }
    } catch {
      // keep mtime fallback
    }
    pending.push({
      fileName: entry.name,
      path: fullPath,
      createdAt,
    });
  }

  pending.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return pending;
}

function writeHandoff(workspacePath, payload) {
  const sauronDir = getSauronDir(workspacePath);
  fs.mkdirSync(sauronDir, { recursive: true });

  const handoffId = payload?.id || generateHandoffId();
  const nextPayload = { ...payload, id: handoffId, version: payload?.version || 2 };
  const fileName = handoffId === LEGACY_HANDOFF_FILE.replace(".json", "")
    ? LEGACY_HANDOFF_FILE
    : `handoff-${handoffId}.json`;
  const handoffPath = path.join(sauronDir, fileName);

  fs.writeFileSync(handoffPath, JSON.stringify(nextPayload, null, 2), "utf8");
  return { handoffPath, handoffId, fileName };
}

function seedSauronRules(workspacePath) {
  const rulesDir = path.join(workspacePath, ".clinerules");
  const rulesPath = path.join(rulesDir, SAURON_RULES_FILENAME);
  if (fs.existsSync(rulesPath)) {
    return { seeded: false, path: rulesPath };
  }
  fs.mkdirSync(rulesDir, { recursive: true });
  fs.writeFileSync(rulesPath, SAURON_RULES_CONTENT, "utf8");
  return { seeded: true, path: rulesPath };
}

function resolveVSCodeCommand() {
  if (process.platform === "win32") {
    const candidates = [
      path.join(process.env.LOCALAPPDATA || "", "Programs", "Microsoft VS Code", "bin", "code.cmd"),
      path.join(process.env.ProgramFiles || "", "Microsoft VS Code", "bin", "code.cmd"),
      path.join(process.env["ProgramFiles(x86)"] || "", "Microsoft VS Code", "bin", "code.cmd"),
    ];
    for (const candidate of candidates) {
      if (candidate && fs.existsSync(candidate)) {
        return candidate;
      }
    }
    try {
      const result = execFileSync("where", ["code"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      const first = result.trim().split(/\r?\n/).find(Boolean);
      if (first && fs.existsSync(first)) {
        return first;
      }
    } catch {
      // where failed — fall through to error below
    }
    return null;
  }
  return "code";
}

function launchVSCode(workspacePath) {
  if (!workspacePath || !fs.existsSync(workspacePath)) {
    throw new Error("Workspace path is invalid or does not exist.");
  }

  const codeCmd = resolveVSCodeCommand();
  if (!codeCmd) {
    throw new Error(
      "VS Code CLI (code) not found. Install VS Code and enable \"Shell Command: Install 'code' command in PATH\".",
    );
  }

  return new Promise((resolve, reject) => {
    const child = spawn(codeCmd, [workspacePath], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.on("error", reject);
    child.unref();
    resolve({ codeCmd });
  });
}

module.exports = {
  SAURON_RULES_CONTENT,
  HANDOFF_DIR,
  LEGACY_HANDOFF_FILE,
  generateHandoffId,
  isPendingHandoffFileName,
  buildHandoffPayload,
  buildTaskSummary,
  truncateTaskSummary,
  collectTouchedFiles,
  listPendingHandoffs,
  writeHandoff,
  seedSauronRules,
  launchVSCode,
  resolveVSCodeCommand,
};
