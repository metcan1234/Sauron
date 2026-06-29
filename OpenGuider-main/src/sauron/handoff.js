const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  mergeCostOptimizerConfig,
  computeComplexityHint,
} = require("./finops/cost-optimizer-config");
const { resolveAgentForCline } = require("./finops/agent-matrix");
const {
  resolveGovernorTier,
  buildGovernorAlertPayload,
} = require("./finops/daily-budget-governor");
const {
  resolveAgentWalletState,
  buildWalletFallbackAlert,
  buildExhaustedAgentAlerts,
} = require("./finops/agent-usage");
const {
  launchVSCode,
  focusVSCodeWorkspace,
  resolveVSCodeCommand,
} = require("./vscode-launcher");
const { loadBrief } = require("./web-studio/brief-schema");
const { normalizeProjectType } = require("./clinerules-packs");
const { detectWorkspaceLayout } = require("./workspace-detector");
const { buildWorkspaceTreeHint } = require("./workspace-tree-snapshot");
const {
  resolveWorkspaceHint,
  updateHandoffContextCache,
  readHandoffContextCache,
} = require("./handoff-context-cache");
const { clarifyHandoffTask, extractHandoffClarifySource } = require("./handoff-task-clarify");
const { applyTokenUltraToHandoff } = require("./token-ultra");
const { buildWorkspaceFileIndex, scoreRelevantFiles } = require("./workspace-file-index");
const { attachSubDelegateToHandoff } = require("./handoff-sub-delegate");

const SAURON_RULES_FILENAME = "sauron-workspace.md";
const SAURON_RULES_VERSION = "1.3";
const HANDOFF_DIR = ".sauron";
const LEGACY_HANDOFF_FILE = "handoff.json";

const SAURON_RULES_CONTENT = `<!-- sauron-rules-version: ${SAURON_RULES_VERSION} -->
# Sauron Workspace — Cline Kuralları

## Token / Maliyet Disiplini
1. Her görev öncesi kısa bir plan yaz (2-5 madde), onaysız uzun kod bloklarına girme.
2. Büyük dosyaları (200+ satır) tam okumadan önce, gerçekten gerekli mi diye düşün; sadece ilgili bölümü oku/düzenle.
3. Aynı bağlamı (dosya içeriği, önceki cevaplar) tekrar tekrar modele gönderme; oturum içi hafızayı kullan.
4. Ucuz/yerel model (Ollama) yeterli olan basit işlerde (formatlama, küçük refactor, dosya arama) GPT/Gemini gibi pahalı modellere geçme; görev karmaşıklığına göre model seç.
5. Bir günlük/oturumluk yaklaşık bir bütçe sınırın varsa, sınıra yaklaşınca kullanıcıyı uyar ve ucuz modele düşmeyi öner.

## Token Verimliliği (Yetenek Kaybı Yok)
- Dosyayı okumadan önce grep / list_files ile hedefi daralt; tam dosya okuma son çare.
- Aynı dosyayı aynı oturumda ikinci kez tam okuma — diff veya satır aralığı kullan.
- 3+ dosya değişecekse önce kısa plan, sonra dosya dosya uygula (tek seferde dev prompt yok).
- Test/lint komutunu sadece anlamlı değişiklikten sonra çalıştır.
- "devam et" dediğinde önceki bağlamı özetle, tüm transcript'i tekrar gönderme.

## Onay Kapıları (Approval Gates)
6. Dosya yazma/silme işleminden önce mutlaka diff göster ve onay iste — "yolo" / oto-onay modu sadece kullanıcı açıkça etkinleştirirse kullanılsın.
7. Git commit ve push işlemlerini kullanıcı onayı olmadan yapma; commit mesajını göster, push'tan önce ayrıca sor.
8. Terminalde yıkıcı olabilecek komutları (rm -rf, force push, paket kaldırma vb.) çalıştırmadan önce açıkça belirt ve onay iste.
9. Mimari karar gerektiren değişikliklerde (yeni bağımlılık ekleme, klasör yapısını değiştirme) önce kısa bir gerekçe sun, kullanıcı onaylamadan uygulama.
10. Görev tamamlandığında ne yapıldığını kısa özetle (post-flight); sessizce bitirme.

## Genel
11. Hangi modeli (Gemini/Ollama/GPT/DeepSeek) kullandığını görev başında belirt, böylece maliyet/performans takibi yapılabilsin.
12. Workspace dışına (proje klasörü dışındaki dosyalara) yazma yapma.

## Kod Kalitesi (Cursor tarzı)
13. Değişiklik yapmadan önce ilgili dosyaları oku; gereksiz geniş tarama veya tüm klasörü listeleme yapma.
14. Büyük refactor veya mimari değişiklikten önce kısa bir plan sun (Cline Plan modu veya madde listesi); onaysız sıçrama yapma.
15. Projede test script varsa (ör. \`npm test\`) anlamlı kod değişikliğinden sonra çalıştır; kırıldıysa düzelt veya raporla.
16. Gereksiz yeni dosya veya tek satırlık yardımcı oluşturma; mevcut modülü genişlet, tekrarlayan soyutlama ekleme.
17. Handoff özeti ve kullanıcı mesajı bağlamı kaynaktır; onlarla çelişen varsayımlar yapma.
`;

function isTerminalHandoffName(name) {
  return name.endsWith(".consumed") || name.endsWith(".rejected");
}

const HANDOFF_CONTEXT_CACHE_FILE = "handoff-context-cache.json";

function isPendingHandoffFileName(name) {
  if (isTerminalHandoffName(name)) {
    return false;
  }
  if (name === HANDOFF_CONTEXT_CACHE_FILE) {
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

function truncateMessageText(text, maxChars = 400) {
  const normalized = String(text || "").trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "";
  }
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, maxChars)}…`;
}

function appendRecentChatContext(snapshot, parts, options = {}) {
  const maxCharsPerMessage = Number.isFinite(Number(options.maxCharsPerMessage))
    ? Math.max(80, Number(options.maxCharsPerMessage))
    : 400;
  const messages = Array.isArray(snapshot?.messages) ? snapshot.messages : [];
  const lastUser = [...messages].reverse().find((entry) => entry?.role === "user" && entry?.content);
  const lastAssistant = [...messages].reverse().find((entry) => entry?.role === "assistant" && entry?.content);
  const lines = [];

  if (lastUser?.content) {
    lines.push(`User: ${truncateMessageText(lastUser.content, maxCharsPerMessage)}`);
  }
  if (lastAssistant?.content) {
    lines.push(`Assistant: ${truncateMessageText(lastAssistant.content, maxCharsPerMessage)}`);
  }

  if (lines.length > 0) {
    parts.push(`Latest chat context:\n${lines.join("\n")}`);
  }
}

function formatWebBriefSummary(brief) {
  if (!brief) {
    return "";
  }
  const pages = Array.isArray(brief.pages) && brief.pages.length
    ? brief.pages.join(", ")
    : "home, about, services, contact";
  return [
    "WEB PROJECT BRIEF",
    `Company: ${brief.companyName}`,
    `Tagline: ${brief.tagline}`,
    `Industry: ${brief.industry || "general"}`,
    `Pages: ${pages}`,
    `Brand: primary ${brief.primaryColor}, accent ${brief.accentColor}, tone ${brief.brandTone || brief.tone || "corporate"}`,
    "Stack: Next.js 14 App Router + Tailwind CSS + TypeScript",
    "Use existing components in components/ before creating new ones.",
    "Follow .clinerules/sauron-web-dev.md for SEO, a11y, and responsive quality gates.",
  ].join("\n");
}

function buildTaskSummary(snapshot, options = {}) {
  const includeTranscript = options.includeTranscript === true;
  const handoffMaxChars = Number.isFinite(Number(options.handoffMaxChars))
    ? Math.max(100, Number(options.handoffMaxChars))
    : 4000;

  const parts = [];

  if (options.workspaceHint) {
    parts.push(options.workspaceHint);
  } else if (options.workspacePath) {
    const workspaceHint = buildWorkspaceTreeHint(options.workspacePath);
    if (workspaceHint) {
      parts.push(workspaceHint);
    }
  }

  if (options.webBrief) {
    parts.push(formatWebBriefSummary(options.webBrief));
  }

  if (snapshot?.chatSessionTitle) {
    parts.push(`Chat session: ${String(snapshot.chatSessionTitle).trim()}`);
  }

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
    const recent = messages.slice(-3).filter((m) => m?.content);
    if (recent.length > 0) {
      const transcript = recent
        .map((m) => {
          const role = m.role === "user" ? "User" : "Assistant";
          const content = String(m.content).trim();
          const clipped = content.length > 400 ? `${content.slice(0, 399)}…` : content;
          return `${role}: ${clipped}`;
        })
        .join("\n");
      parts.push(`Recent conversation:\n${transcript}`);
    }
  } else {
    appendRecentChatContext(snapshot, parts, {
      maxCharsPerMessage: Math.min(600, Math.floor(handoffMaxChars / 4)),
    });
  }

  const summary = parts.filter(Boolean).join("\n\n").trim();
  const fallback = summary || "Continue the task discussed in Sauron Core.";
  const truncated = truncateTaskSummary(fallback, handoffMaxChars);
  if (truncated.length <= handoffMaxChars) {
    return truncated;
  }
  return truncated.slice(0, handoffMaxChars);
}

function buildHandoffPayload(sessionSnapshot, workspacePath, handoffId = generateHandoffId(), settings = {}, overrides = {}) {
  const optimizer = mergeCostOptimizerConfig(settings);
  const briefResult = workspacePath ? loadBrief(workspacePath) : { ok: false };
  const webBrief = briefResult.ok ? briefResult.brief : null;
  const layout = workspacePath ? detectWorkspaceLayout(workspacePath) : { suggestedProjectType: "generic" };

  const goalSeed = overrides.goal
    || sessionSnapshot?.goalIntent
    || sessionSnapshot?.activePlan?.goal
    || sessionSnapshot?.browserExecution?.goal
    || (webBrief ? `Build corporate website for ${webBrief.companyName}` : "");

  const workspaceContext = workspacePath
    ? resolveWorkspaceHint(workspacePath, settings, goalSeed)
    : { hint: "", deltaMode: false };

  const taskSummary = buildTaskSummary(sessionSnapshot, {
    includeTranscript: optimizer.routing.includeTranscript,
    handoffMaxChars: optimizer.routing.handoffMaxChars,
    webBrief,
    workspaceHint: workspaceContext.hint,
  });
  const complexityHint = overrides.complexityHint
    || (webBrief ? "high" : computeComplexityHint(taskSummary));

  const budgetGovernorActive = overrides.budgetGovernorActive === true;
  const suggestedClineAgent = resolveAgentForCline(complexityHint, settings, { budgetGovernorActive });

  const payload = {
    version: 2,
    id: handoffId,
    source: "sauron-core",
    workspacePath,
    taskSummary: overrides.taskSummary || taskSummary,
    goal: goalSeed,
    sessionId: overrides.sessionId || sessionSnapshot?.sessionId || "",
    createdAt: new Date().toISOString(),
    autoStart: overrides.autoStart !== undefined ? Boolean(overrides.autoStart) : true,
    autoChain: overrides.autoChain !== undefined ? Boolean(overrides.autoChain) : false,
    complexityHint,
    costContext: {
      coreModelTier: optimizer.coreModelTier,
      optimizerEnabled: optimizer.enabled,
      mode: optimizer.mode,
      budgetGovernorActive,
      deltaHandoff: workspaceContext.deltaMode,
      ...(suggestedClineAgent ? { suggestedClineAgent } : {}),
    },
  };

  if (overrides.pipelineId) payload.pipelineId = overrides.pipelineId;
  if (overrides.pipelinePhase) payload.pipelinePhase = overrides.pipelinePhase;
  if (overrides.pipelineTotalPhases) payload.pipelineTotalPhases = overrides.pipelineTotalPhases;
  if (overrides.parentHandoffId) payload.parentHandoffId = overrides.parentHandoffId;
  if (overrides.verification) payload.verification = overrides.verification;

  const projectType = normalizeProjectType(
    overrides.projectType || (webBrief ? "corporate-web" : layout.suggestedProjectType),
  );
  if (projectType !== "generic") {
    payload.projectType = projectType;
  }

  if (webBrief) {
    payload.projectType = "corporate-web";
    payload.webBrief = webBrief;
    payload.scaffoldPath = ".";
    payload.qualityGates = ["seo", "a11y", "responsive", "performance"];
  }

  if (workspacePath) {
    const index = buildWorkspaceFileIndex(workspacePath);
    const relevantFiles = scoreRelevantFiles(index, goalSeed, 8);
    if (relevantFiles.length) {
      payload.relevantFiles = relevantFiles;
    }
  }

  if (overrides.batchScope) {
    payload.batchScope = overrides.batchScope;
  }
  if (overrides.cacheBreakpoint) {
    payload.cacheBreakpoint = overrides.cacheBreakpoint;
  }

  const ultra = applyTokenUltraToHandoff(payload, settings, { workspacePath });
  const cacheBreakpoint = ultra.payload?.id || handoffId;
  ultra.payload.cacheBreakpoint = ultra.payload.cacheBreakpoint || cacheBreakpoint;
  if (ultra.payload.relevantFiles?.length) {
    const pointerLine = `Relevant files: ${ultra.payload.relevantFiles.slice(0, 6).join(", ")}`;
    if (!String(ultra.payload.taskSummary || "").includes("Relevant files:")) {
      ultra.payload.taskSummary = `${pointerLine}\n\n${ultra.payload.taskSummary || ""}`.trim();
    }
  }
  return attachSubDelegateToHandoff(ultra.payload, overrides.subHandoff || {});
}

function applyClarificationToTaskSummary(taskSummary, clarification) {
  const base = String(taskSummary || "").trim();
  const summary = String(clarification || "").trim();
  if (!summary) {
    return base;
  }
  if (!base) {
    return `Clarified task (for Cline):\n${summary}`;
  }
  return `Clarified task (for Cline):\n${summary}\n\nOriginal context:\n${base}`;
}

async function prepareHandoffPayloadAsync({
  sessionSnapshot,
  workspacePath,
  settings = {},
  streamAIResponse,
  appLogger,
  handoffId,
  overrides = {},
  signal,
}) {
  const clarifySource = extractHandoffClarifySource(sessionSnapshot);
  const lastClarify = workspacePath
    ? readHandoffContextCache(workspacePath)?.lastClarify || ""
    : "";

  const clarification = await clarifyHandoffTask({
    rawText: clarifySource,
    settings,
    streamAIResponse,
    signal,
    appLogger,
    lastClarify,
  });

  const payload = buildHandoffPayload(
    sessionSnapshot,
    workspacePath,
    handoffId,
    settings,
    overrides,
  );

  if (overrides.taskSummary && workspacePath) {
    const { hint } = resolveWorkspaceHint(
      workspacePath,
      settings,
      payload.goal || clarifySource,
    );
    if (hint && !String(payload.taskSummary).includes("Workspace snapshot:")
      && !String(payload.taskSummary).includes("Workspace delta:")) {
      payload.taskSummary = `${hint}\n\n${payload.taskSummary}`;
    }
  }

  if (clarification) {
    payload.taskSummary = applyClarificationToTaskSummary(payload.taskSummary, clarification);
  }

  const finopsEnriched = await enrichHandoffPayloadFinOps(payload, settings, {
    projectType: payload.projectType,
  });

  if (workspacePath) {
    const layout = detectWorkspaceLayout(workspacePath);
    const { hint, deltaMode } = resolveWorkspaceHint(
      workspacePath,
      settings,
      finopsEnriched.payload.goal || clarifySource,
    );
    appLogger?.info?.("handoff-workspace-context", {
      charCount: hint.length,
      layout: layout.layout,
      clarified: Boolean(clarification),
      deltaMode,
    });
  }

  return finopsEnriched;
}

async function enrichHandoffPayloadFinOps(payload, settings = {}, options = {}) {
  const governorTierState = await resolveGovernorTier(settings, {
    projectType: payload.projectType || options.projectType,
  });
  const budgetGovernorActive = governorTierState.level !== "none";

  const { agentWallets } = await resolveAgentWalletState(settings);

  const suggestedClineAgent = resolveAgentForCline(payload.complexityHint, settings, {
    budgetGovernorActive,
    governorTier: governorTierState.level,
    agentWallets,
  });

  payload.costContext = payload.costContext || {};
  payload.costContext.budgetGovernorActive = budgetGovernorActive;
  payload.costContext.governorTier = governorTierState.level;
  if (suggestedClineAgent) {
    payload.costContext.suggestedClineAgent = suggestedClineAgent;
  }

  const alerts = [];
  if (budgetGovernorActive) {
    alerts.push(buildGovernorAlertPayload());
  }
  if (suggestedClineAgent?.walletFallbackFrom && suggestedClineAgent?.agentId) {
    alerts.push(buildWalletFallbackAlert(suggestedClineAgent.walletFallbackFrom, suggestedClineAgent.agentId));
  } else if (suggestedClineAgent?.allCloudExhausted) {
    const exhaustedAlerts = buildExhaustedAgentAlerts(agentWallets);
    if (exhaustedAlerts.length) {
      alerts.push(exhaustedAlerts[0]);
    }
  }

  return {
    payload,
    governorAlert: alerts[0] || null,
    walletAlerts: alerts,
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

  // Compute SHA256 checksum from content without _checksum field
  const serialized = JSON.stringify(nextPayload, null, 2);
  const checksum = crypto.createHash('sha256').update(serialized, 'utf8').digest('hex');
  const payloadWithChecksum = { ...nextPayload, _checksum: checksum };

  // Atomic write: .tmp → .json (fs.renameSync is atomic on same filesystem)
  const tmpPath = handoffPath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(payloadWithChecksum, null, 2), "utf8");
  fs.renameSync(tmpPath, handoffPath);

  const summary = String(nextPayload.taskSummary || "");
  const treeMatch = summary.match(/(?:Workspace snapshot:|Workspace delta:)[\s\S]*?(?:\n\n|$)/);
  const treeHint = treeMatch ? treeMatch[0].trim() : "";
  const clarifyMatch = summary.match(/Clarified task \(for Cline\):\n([\s\S]*?)(?:\n\nOriginal context:|$)/);
  updateHandoffContextCache(workspacePath, {
    goal: nextPayload.goal || "",
    treeHint,
    lastClarify: clarifyMatch ? String(clarifyMatch[1]).trim() : "",
  });

  return { handoffPath, handoffId, fileName, checksum };
}

function parseRulesVersion(fileContent) {
  const text = String(fileContent || "");
  const match = text.match(/sauron-rules-version:\s*([^\s>]+)/i);
  return match ? String(match[1]).trim() : "";
}

function seedSauronRules(workspacePath) {
  const rulesDir = path.join(workspacePath, ".clinerules");
  const rulesPath = path.join(rulesDir, SAURON_RULES_FILENAME);
  if (!fs.existsSync(rulesPath)) {
    fs.mkdirSync(rulesDir, { recursive: true });
    fs.writeFileSync(rulesPath, SAURON_RULES_CONTENT, "utf8");
    return { seeded: true, updated: false, path: rulesPath };
  }
  let existing = "";
  try {
    existing = fs.readFileSync(rulesPath, "utf8");
  } catch {
    existing = "";
  }
  const existingVersion = parseRulesVersion(existing);
  if (existingVersion === SAURON_RULES_VERSION) {
    return { seeded: false, updated: false, path: rulesPath };
  }
  fs.mkdirSync(rulesDir, { recursive: true });
  fs.writeFileSync(rulesPath, SAURON_RULES_CONTENT, "utf8");
  return { seeded: false, updated: true, path: rulesPath };
}

function rejectPendingHandoffs(workspacePath) {
  const pending = listPendingHandoffs(workspacePath);
  for (const item of pending) {
    const rejectedPath = `${item.path}.rejected`;
    try {
      fs.renameSync(item.path, rejectedPath);
    } catch {
      try {
        fs.unlinkSync(item.path);
      } catch {
        // ignore cleanup failures
      }
    }
  }
  return pending.length;
}

function getHandoffStatus(workspacePath, handoffFileName) {
  if (!workspacePath || !handoffFileName) {
    return { status: "unknown", handoffFileName: handoffFileName || "" };
  }

  const sauronDir = getSauronDir(workspacePath);
  const pendingPath = path.join(sauronDir, handoffFileName);

  if (fs.existsSync(pendingPath)) {
    return { status: "pending", handoffFileName, handoffPath: pendingPath };
  }
  if (fs.existsSync(`${pendingPath}.consumed`)) {
    return { status: "consumed", handoffFileName, handoffPath: `${pendingPath}.consumed` };
  }
  if (fs.existsSync(`${pendingPath}.rejected`)) {
    return { status: "rejected", handoffFileName, handoffPath: `${pendingPath}.rejected` };
  }

  return { status: "not_found", handoffFileName };
}

function rejectHandoffFile(workspacePath, handoffFileName) {
  if (!workspacePath || !handoffFileName) {
    throw new Error("Missing workspace path or handoff file name.");
  }

  const sauronDir = getSauronDir(workspacePath);
  const pendingPath = path.join(sauronDir, handoffFileName);
  if (!fs.existsSync(pendingPath)) {
    throw new Error(`Pending handoff not found: ${handoffFileName}`);
  }

  const rejectedPath = `${pendingPath}.rejected`;
  fs.renameSync(pendingPath, rejectedPath);
  return {
    ok: true,
    handoffFileName,
    status: "rejected",
    handoffPath: rejectedPath,
  };
}

function listHandoffHistory(workspacePath, options = {}) {
  const limit = Math.max(1, Math.min(100, Number(options.limit) || 20));
  if (!workspacePath) {
    return [];
  }

  const sauronDir = getSauronDir(workspacePath);
  if (!fs.existsSync(sauronDir)) {
    return [];
  }

  const items = [];
  for (const entry of fs.readdirSync(sauronDir, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }

    const name = entry.name;
    let status = null;
    let fileName = name;

    if (name.endsWith(".consumed")) {
      status = "consumed";
      fileName = name.slice(0, -".consumed".length);
    } else if (name.endsWith(".rejected")) {
      status = "rejected";
      fileName = name.slice(0, -".rejected".length);
    } else if (isPendingHandoffFileName(name)) {
      status = "pending";
    } else {
      continue;
    }

    const fullPath = path.join(sauronDir, name);
    let createdAt = fs.statSync(fullPath).mtime.toISOString();
    let goal = "";
    let taskSummary = "";

    try {
      const parsed = JSON.parse(fs.readFileSync(fullPath, "utf8"));
      if (parsed?.createdAt) {
        createdAt = parsed.createdAt;
      }
      if (parsed?.goal) {
        goal = String(parsed.goal);
      }
      if (parsed?.taskSummary) {
        taskSummary = String(parsed.taskSummary).slice(0, 160);
      }
    } catch {
      // keep stat fallback
    }

    items.push({
      fileName,
      status,
      createdAt,
      goal,
      taskSummary,
      path: fullPath,
    });
  }

  items.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return items.slice(0, limit);
}

/**
 * Verify the _checksum of a handoff file (for use by Bridge or Core readers).
 * @param {string} handoffPath - full path to the handoff JSON file
 * @returns {{ ok: boolean, id: string|null, expected: string|null, computed: string|null, error: string|null }}
 */
function verifyHandoffChecksum(handoffPath) {
  if (!handoffPath || !fs.existsSync(handoffPath)) {
    return { ok: false, id: null, expected: null, computed: null, error: 'file_not_found' };
  }
  try {
    const raw = fs.readFileSync(handoffPath, 'utf8');
    const parsed = JSON.parse(raw);
    const { _checksum, ...content } = parsed;
    if (!_checksum) {
      // Legacy file without checksum — accept but warn
      return { ok: true, id: content.id || null, expected: null, computed: null, error: 'no_checksum_legacy' };
    }
    const serialized = JSON.stringify(content, null, 2);
    const computed = crypto.createHash('sha256').update(serialized, 'utf8').digest('hex');
    const ok = computed === _checksum;
    return { ok, id: content.id || null, expected: _checksum, computed, error: ok ? null : 'checksum_mismatch' };
  } catch (err) {
    return { ok: false, id: null, expected: null, computed: null, error: `parse_error: ${err.message}` };
  }
}

module.exports = {
  SAURON_RULES_CONTENT,
  SAURON_RULES_VERSION,
  parseRulesVersion,
  HANDOFF_DIR,
  LEGACY_HANDOFF_FILE,
  generateHandoffId,
  isPendingHandoffFileName,
  buildHandoffPayload,
  prepareHandoffPayloadAsync,
  applyClarificationToTaskSummary,
  enrichHandoffPayloadFinOps,
  buildTaskSummary,
  truncateTaskSummary,
  collectTouchedFiles,
  listPendingHandoffs,
  listHandoffHistory,
  rejectPendingHandoffs,
  rejectHandoffFile,
  getHandoffStatus,
  writeHandoff,
  verifyHandoffChecksum,
  seedSauronRules,
  launchVSCode,
  focusVSCodeWorkspace,
  resolveVSCodeCommand,
};
