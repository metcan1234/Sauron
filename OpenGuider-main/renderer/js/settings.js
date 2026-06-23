// renderer/js/settings.js

import { applyI18nToDocument } from "./i18n/index.js";

let settings = {};
let activeProvider = "gemini";
let recordingButton = null;
const EXECUTION_MODE_HITL = "hitl";
const EXECUTION_MODE_AUTO = "auto";

const toast = document.getElementById("toast");
let toastTimer;
function showToast(msg, isError) {
  toast.textContent = msg;
  toast.classList.remove("hidden");
  toast.style.borderColor = isError ? "rgba(239,68,68,0.4)" : "";
  toast.style.color       = isError ? "#fca5a5" : "";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 3000);
}

async function refreshGooseProbeStatus(gooseBinaryPath) {
  const statusEl = document.getElementById("gooseProbeStatus");
  const fromInput = gooseBinaryPath ?? document.getElementById("gooseBinaryPath")?.value?.trim() ?? "";
  if (statusEl) {
    statusEl.textContent = "Kontrol ediliyor…";
  }
  try {
    const probe = await window.sauron.invoke("probe-goose-binary", {
      gooseBinaryPath: fromInput,
    });
    if (!statusEl) {
      return probe;
    }
    if (probe?.cliCapable) {
      const version = probe.version ? ` v${probe.version}` : "";
      const resolved = probe.resolvedPath && probe.resolvedPath !== fromInput
        ? ` (cozulen: ${probe.resolvedPath})`
        : "";
      statusEl.textContent = `CLI bulundu: ${probe.binaryPath}${version}${resolved}`;
      return probe;
    }
    if (probe?.kind === "desktop") {
      statusEl.textContent = `Desktop bulundu (CLI degil): ${probe.desktopPath || probe.binaryPath || "?"}`;
      return probe;
    }
    statusEl.textContent = probe?.error || "CLI bulunamadi.";
    return probe;
  } catch (error) {
    if (statusEl) {
      statusEl.textContent = `Hata: ${error.message}`;
    }
    return { ok: false, cliCapable: false, error: error.message };
  }
}

async function refreshClineSyncStatus() {
  const statusEl = document.getElementById("clineSyncStatus");
  if (!statusEl) {
    return;
  }
  try {
    const status = await window.sauron.invoke("get-cline-sync-status");
    if (!status?.ok) {
      statusEl.textContent = status?.error || "Senkron durumu okunamadı.";
      return;
    }
    if (!status.hasWorkspace) {
      statusEl.textContent = "Önce Workspace sekmesinde klasör seçin.";
      return;
    }
    if (!status.ready) {
      statusEl.textContent = "AI Agents sekmesinde en az bir provider anahtarı girin.";
      return;
    }
    const providers = Array.isArray(status.configuredProviders) ? status.configuredProviders.join(", ") : "";
    statusEl.textContent = `Hazır: ${providers}${status.pendingRequest ? " · bekleyen senkron isteği var" : ""}`;
  } catch (error) {
    statusEl.textContent = error?.message || "Senkron durumu okunamadı.";
  }
}

async function init() {
  applyI18nToDocument();
  settings = await window.sauron.invoke("get-settings");

  // Provider dropdown
  activeProvider = settings.aiProvider || "gemini";
  const providerSelect = document.getElementById("providerSelect");
  if (providerSelect) {
    providerSelect.value = activeProvider;
    activateProvider(activeProvider);
    providerSelect.addEventListener("change", () => {
      activeProvider = providerSelect.value;
      activateProvider(activeProvider);
    });
  }

  // Fill fields — AI Agents
  document.getElementById("geminiApiKey").value      = settings.geminiApiKey          || "";
  document.getElementById("deepseekApiKey").value    = settings.deepseekApiKey        || "";
  document.getElementById("openaiApiKey").value      = settings.openaiApiKey          || "";
  document.getElementById("ollamaUrl").value         = settings.ollamaUrl             || "http://localhost:11434";
  document.getElementById("claudeApiKey").value      = settings.claudeApiKey          || "";
  document.getElementById("claudeModel").value       = settings.claudeModelCustom     || "";
  document.getElementById("claudeBaseUrl").value     = settings.claudeBaseUrl         || "https://api.anthropic.com";
  document.getElementById("openaiModel").value       = settings.openaiModelCustom     || "";
  document.getElementById("openaiBaseUrl").value     = settings.openaiBaseUrl         || "https://api.openai.com/v1";
  document.getElementById("geminiModel").value       = settings.geminiModelCustom     || "";
  document.getElementById("geminiBaseUrl").value     = settings.geminiBaseUrl         || "https://generativelanguage.googleapis.com/v1beta";
  const deepseekModelEl = document.getElementById("deepseekModel");
  const deepseekBaseUrlEl = document.getElementById("deepseekBaseUrl");
  if (deepseekModelEl) deepseekModelEl.value = settings.deepseekModelCustom || "deepseek-chat";
  if (deepseekBaseUrlEl) deepseekBaseUrlEl.value = settings.deepseekBaseUrl || "https://api.deepseek.com";
  const systemPromptEl = document.getElementById("systemPromptOverride");
  const userMemoryEl = document.getElementById("userMemoryFacts");
  if (systemPromptEl) systemPromptEl.value = settings.systemPromptOverride || "";
  if (userMemoryEl) {
    const facts = Array.isArray(settings.userMemoryFacts) ? settings.userMemoryFacts : [];
    userMemoryEl.value = facts.join("\n");
  }
  document.getElementById("groqApiKey").value        = settings.groqApiKey            || "";
  document.getElementById("groqModel").value         = settings.groqModelCustom       || "";
  document.getElementById("groqBaseUrl").value       = settings.groqBaseUrl           || "https://api.groq.com/openai/v1";
  document.getElementById("openrouterApiKey").value  = settings.openrouterApiKey      || "";
  document.getElementById("openrouterModel").value   = settings.openrouterModelCustom || "";
  document.getElementById("openrouterBaseUrl").value = settings.openrouterBaseUrl     || "https://openrouter.ai/api/v1";
  const openrouterMaxTokensEl = document.getElementById("openrouterMaxTokens");
  if (openrouterMaxTokensEl) openrouterMaxTokensEl.value = String(settings.openrouterMaxTokens ?? 2048);
  document.getElementById("ollamaModel").value       = settings.ollamaModelCustom     || "";
  const gooseEnabledEl = document.getElementById("gooseEnabled");
  const gooseBinaryPathEl = document.getElementById("gooseBinaryPath");
  const gooseDefaultModeEl = document.getElementById("gooseDefaultMode");
  const gooseDailyBudgetTlEl = document.getElementById("gooseDailyBudgetTl");
  const gooseAutoModeEl = document.getElementById("gooseAutoMode");
  if (gooseEnabledEl) gooseEnabledEl.checked = settings.gooseEnabled !== false;
  if (gooseBinaryPathEl) gooseBinaryPathEl.value = settings.gooseBinaryPath || "";
  if (gooseDefaultModeEl) gooseDefaultModeEl.value = settings.gooseDefaultMode || "balanced";
  if (gooseDailyBudgetTlEl) gooseDailyBudgetTlEl.value = String(settings.gooseDailyBudgetTl ?? 0);
  if (gooseAutoModeEl) gooseAutoModeEl.checked = settings.gooseAutoMode !== false;
  void refreshGooseProbeStatus(settings.gooseBinaryPath || "");
  // STT / TTS
  document.getElementById("assemblyaiApiKey").value  = settings.assemblyaiApiKey  || "";
  document.getElementById("whisperApiKey").value     = settings.whisperApiKey     || "";
  document.getElementById("whisperBaseUrl").value    = settings.whisperBaseUrl    || "https://api.openai.com/v1";
  document.getElementById("whisperModel").value      = settings.whisperModel      || "whisper-1";
  document.getElementById("sttLanguage").value       = settings.sttLanguage       || "en-US";
  document.getElementById("pushToTalkShortcut").value = settings.pushToTalkShortcut || "Ctrl+Shift+Space";
  document.getElementById("markStepDoneShortcut").value = settings.markStepDoneShortcut || "Ctrl+Alt+1";
  document.getElementById("requestStepHelpShortcut").value = settings.requestStepHelpShortcut || "Ctrl+Alt+2";
  document.getElementById("recheckCurrentStepShortcut").value = settings.recheckCurrentStepShortcut || "Ctrl+Alt+3";
  document.getElementById("cancelActivePlanShortcut").value = settings.cancelActivePlanShortcut || "Ctrl+Alt+4";
  document.getElementById("previousStepShortcut").value = settings.previousStepShortcut || "Ctrl+Alt+5";
  document.getElementById("skipCurrentStepShortcut").value = settings.skipCurrentStepShortcut || "Ctrl+Alt+6";
  document.getElementById("regenerateCurrentStepShortcut").value = settings.regenerateCurrentStepShortcut || "Ctrl+Alt+7";
  document.getElementById("workspacePath").value = settings.workspacePath || "";
  const vscodePathEl = document.getElementById("vscodePath");
  if (vscodePathEl) vscodePathEl.value = settings.vscodePath || "";
  const chatBackupEnabledEl = document.getElementById("chatBackupEnabled");
  const chatBackupPathEl = document.getElementById("chatBackupPath");
  if (chatBackupEnabledEl) chatBackupEnabledEl.checked = settings.chatBackupEnabled === true;
  if (chatBackupPathEl) chatBackupPathEl.value = settings.chatBackupPath || "";

  initFinOpsSettings();

  // Plugin fields
  const executionMode = normalizeExecutionMode(settings.executionMode);
  document.getElementById("executionMode").value = executionMode;
  document.getElementById("trustLevel").value = normalizeTrustLevel(settings.trustLevel, executionMode);
  document.getElementById("browserAgentEnabled").checked = settings.browserAgentEnabled !== false;
  document.getElementById("browserHeadless").checked = settings.browserHeadless === true;
  const webStudioEnabledEl = document.getElementById("webStudioEnabled");
  const selfBuildEnabledEl = document.getElementById("selfBuildEnabled");
  const codeAgentNativeEnabledEl = document.getElementById("codeAgentNativeEnabled");
  if (webStudioEnabledEl) webStudioEnabledEl.checked = settings.webStudioEnabled !== false;
  if (selfBuildEnabledEl) selfBuildEnabledEl.checked = settings.selfBuildEnabled !== false;
  if (codeAgentNativeEnabledEl) codeAgentNativeEnabledEl.checked = settings.codeAgentNativeEnabled === true;
  document.getElementById("awareAssistanceEnabled").checked = settings.awareAssistanceEnabled === true;

  setSelectValue("sttProvider", normalizeSttProvider(settings.sttProvider));
  setSelectValue("ttsProvider", settings.ttsProvider || "google");

  document.getElementById("elevenlabsApiKey").value  = settings.elevenlabsApiKey  || "";
  document.getElementById("elevenlabsVoiceId").value = settings.elevenlabsVoiceId || "";
  document.getElementById("openaiTtsApiKey").value   = settings.openaiTtsApiKey   || "";
  document.getElementById("openaiTtsBaseUrl").value  = settings.openaiTtsBaseUrl  || "https://api.openai.com/v1";
  document.getElementById("openaiTtsModel").value    = settings.openaiTtsModel    || "tts-1";
  document.getElementById("openaiTtsVoice").value    = settings.openaiTtsVoice    || "nova";
  document.getElementById("ttsEnabled").checked      = settings.ttsEnabled !== false;
  document.getElementById("ttsVolume").value         = String(normalizeTtsVolume(settings.ttsVolume));
  document.getElementById("ttsRate").value           = String(normalizeTtsRate(settings.ttsRate));
  updateTtsVolumeLabel();
  updateTtsRateLabel();

  toggleAssemblyKey();
  toggleElevenLabs();

  document.getElementById("sttProvider").addEventListener("change", toggleAssemblyKey);
  document.getElementById("ttsProvider").addEventListener("change", toggleElevenLabs);
  document.getElementById("ttsVolume").addEventListener("input", updateTtsVolumeLabel);
  document.getElementById("ttsRate").addEventListener("input", updateTtsRateLabel);
  document.getElementById("executionMode").addEventListener("change", updateExecutionModeUi);
  document.getElementById("trustLevel").addEventListener("change", updateExecutionModeUi);
  updateExecutionModeUi();

  document.getElementById("btn-save").addEventListener("click",   saveSettings);
  document.getElementById("btn-sync-cline")?.addEventListener("click", async () => {
    try {
      const capReport = await window.sauron.invoke("get-cline-capability-report");
      if (capReport?.variant && capReport.variant !== "fork") {
        showToast("API anahtarı otomatik senkronu Cline fork gerektirir; Marketplace'te anahtarları Cline içinde elle girin.");
      }
      const result = await window.sauron.invoke("sync-cline-credentials");
      if (!result?.ok) {
        showToast(result?.error || "Cline senkron isteği oluşturulamadı", true);
        return;
      }
      showToast(`Cline senkron isteği hazır (${(result.configuredProviders || []).join(", ")})`);
      await refreshClineSyncStatus();
    } catch (error) {
      showToast(error?.message || "Cline senkron başarısız", true);
    }
  });
  document.getElementById("btn-reset-all").addEventListener("click", resetAllSettings);
  document.getElementById("btn-cancel").addEventListener("click", () => window.sauron.invoke("close-settings"));
  document.getElementById("btn-close").addEventListener("click",  () => window.sauron.invoke("close-settings"));
  document.getElementById("btn-refresh-metrics").addEventListener("click", refreshMetrics);
  document.getElementById("btn-reset-metrics").addEventListener("click", resetMetrics);

  // Plugin UI
  const agentStatusText = document.getElementById("browserAgentStatusText");
  window.sauron.invoke("get-browser-agent-status").then((statusStr) => {
    if (agentStatusText) agentStatusText.textContent = statusStr;
  }).catch(() => {});
  
  window.sauron.on("browser-agent-status-changed", (newStatus) => {
    if (agentStatusText) agentStatusText.textContent = newStatus;
  });
  
  const progressEl = document.getElementById("agent-download-progress");
  window.sauron.on("browser-agent-download-progress", (data) => {
    if (!progressEl) return;
    progressEl.classList.remove("hidden");
    if (data.event === "progress") {
      progressEl.textContent = `${data.step} (${data.percent}%)`;
    } else if (data.event === "done") {
      progressEl.textContent = "Download complete!";
      progressEl.style.color = "#22c55e"; // Success green
      void refreshBrowserRuntimeHint();
    } else if (data.event === "error") {
      progressEl.textContent = "Error: " + data.message;
      progressEl.style.color = "#ef4444"; // Error red
    }
  });

  document.getElementById("btn-restart-agent")?.addEventListener("click", async () => {
    if (agentStatusText) agentStatusText.textContent = "restarting...";
    await window.sauron.invoke("restart-browser-agent");
  });
  
  document.getElementById("btn-download-agent")?.addEventListener("click", async () => {
    if (progressEl) {
      progressEl.classList.remove("hidden");
      progressEl.textContent = "Starting download...";
      progressEl.style.color = "var(--accent)";
    }
    await window.sauron.invoke("download-browser-agent");
  });

  document.getElementById("btn-browse-workspace")?.addEventListener("click", async () => {
    const result = await window.sauron.invoke("pick-workspace-folder");
    if (result?.ok && result.path) {
      document.getElementById("workspacePath").value = result.path;
      showToast("Workspace folder selected");
    }
  });

  document.getElementById("btn-browse-backup")?.addEventListener("click", async () => {
    const result = await window.sauron.invoke("pick-chat-backup-folder");
    if (result?.ok && result.path) {
      document.getElementById("chatBackupPath").value = result.path;
      showToast("Yedek klasörü seçildi");
    }
  });

  document.getElementById("btn-backup-now")?.addEventListener("click", async () => {
    const pathValue = document.getElementById("chatBackupPath")?.value.trim();
    const result = await window.sauron.invoke("backup-chat-sessions", { folderPath: pathValue || undefined });
    if (result?.ok) {
      showToast(`Yedek oluşturuldu: ${result.path}`);
    } else if (!result?.canceled) {
      showToast(result?.error || "Yedekleme başarısız", true);
    }
  });

  document.getElementById("btn-import-backup")?.addEventListener("click", async () => {
    const result = await window.sauron.invoke("import-chat-sessions", { mode: "merge" });
    if (result?.ok) {
      showToast(`İçe aktarıldı (${result.importedCount || 0} sohbet)`);
    } else if (!result?.canceled) {
      showToast(result?.error || "İçe aktarma başarısız", true);
    }
  });

  async function refreshClineCapabilitySummary() {
    const summaryEl = document.getElementById("cline-capability-summary");
    if (!summaryEl) {
      return;
    }
    try {
      const report = await window.sauron.invoke("get-cline-capability-report");
      if (!report?.ok && report?.error) {
        summaryEl.textContent = report.error;
        return;
      }
      const summary = report?.report?.summary || "Cline durumu okunamadı";
      const limited = Array.isArray(report?.report?.limited) && report.report.limited.length > 0
        ? ` — ${report.report.limited.slice(0, 2).join("; ")}`
        : "";
      summaryEl.textContent = `${summary}${limited}`;
    } catch {
      summaryEl.textContent = "Cline capability durumu okunamadı";
    }
  }

  async function refreshBrowserRuntimeHint() {
    const hintEl = document.getElementById("browser-runtime-doctor-hint");
    if (!hintEl) {
      return;
    }
    try {
      const info = await window.sauron.invoke("get-browser-runtime-info");
      if (info?.installed) {
        hintEl.textContent = "Browser runtime indirildi — Sistem tanısından ayrıntılı durumu görebilirsiniz.";
        return;
      }
      hintEl.textContent = "Browser runtime indirilmemiş — Download Runtime ile kurun veya sistem Python 3.11+ kullanın.";
    } catch {
      hintEl.textContent = "Runtime durumu okunamadı";
    }
  }

  async function refreshWorkspaceStackStatus() {
    const statusEl = document.getElementById("workspace-stack-status");
    if (!statusEl) {
      return;
    }
    try {
      const prerequisites = await window.sauron.invoke("check-workspace-prerequisites");
      const bridgeOk = Boolean(prerequisites?.bridgeExtension);
      const clineOk = Boolean(prerequisites?.clineExtension);
      if (bridgeOk && clineOk) {
        statusEl.textContent = "Hazır — Bridge + Cline kurulu";
      } else if (bridgeOk) {
        statusEl.textContent = "Bridge kurulu — Cline eksik";
      } else if (clineOk) {
        statusEl.textContent = "Cline kurulu — Bridge eksik (⌘ ile otomatik kurulur)";
      } else {
        statusEl.textContent = "Bridge ve Cline eksik";
      }
    } catch {
      statusEl.textContent = "Durum okunamadı";
    }
  }

  document.getElementById("btn-install-workspace-stack")?.addEventListener("click", async () => {
    const statusEl = document.getElementById("workspace-stack-status");
    const button = document.getElementById("btn-install-workspace-stack");
    if (button) {
      button.disabled = true;
    }
    if (statusEl) {
      statusEl.textContent = "Bridge kuruluyor…";
    }
    try {
      const result = await window.sauron.invoke("install-workspace-stack", { force: true });
      if (result?.ok) {
        if (statusEl) {
          statusEl.textContent = "Bridge kuruldu";
        }
      } else if (statusEl) {
        statusEl.textContent = result?.error || "Kurulum başarısız";
      }
      await refreshWorkspaceStackStatus();
    } finally {
      if (button) {
        button.disabled = false;
      }
    }
  });

  void refreshWorkspaceStackStatus();
  void refreshClineCapabilitySummary();
  void refreshBrowserRuntimeHint();
  void refreshClineSyncStatus();

  runDoctorCheck = async () => {
    const button = document.getElementById("btn-run-doctor");
    const summaryEl = document.getElementById("doctor-summary");
    if (button) {
      button.disabled = true;
    }
    if (summaryEl) {
      summaryEl.textContent = "Tanı çalışıyor…";
    }
    try {
      const result = await window.sauron.invoke("run-sauron-doctor");
      renderDoctorResults(result);
      await refreshWorkspaceStackStatus();
      await refreshClineCapabilitySummary();
      await refreshBrowserRuntimeHint();
    } catch (error) {
      renderDoctorResults({ error: error?.message || "Tanı başarısız", checks: [] });
    } finally {
      if (button) {
        button.disabled = false;
      }
    }
  };

  document.getElementById("btn-run-doctor")?.addEventListener("click", () => {
    void runDoctorCheck();
  });

  document.getElementById("btn-probe-goose")?.addEventListener("click", () => {
    void refreshGooseProbeStatus();
  });

  bindSettingsTabs();
  initAboutSection();
  bindPluginCards();
  bindShortcutRecordButtons();
  bindFinOpsControls();
  window.sauron.on("finops-budget-alert", (payload) => {
    showToast(payload?.message || "AI bütçe uyarısı", true);
    void refreshFinOpsSummary();
  });
  await refreshMetrics();
  await refreshFinOpsSummary();
}

function activateProvider(provider) {
  document.querySelectorAll(".provider-section").forEach(sec => {
    sec.classList.toggle("active", sec.id === `section-${provider}`);
  });
}

function setSelectValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function normalizeSttProvider(provider) {
  if (provider === "whisper") return "whisper";
  if (provider === "assemblyai") return "assemblyai";
  // Legacy values like "webspeech" are remapped to assemblyai.
  return "assemblyai";
}

function normalizeTtsVolume(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.max(0, Math.min(1, numeric));
}

function normalizeTtsRate(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1.5;
  return Math.max(1, Math.min(2, numeric));
}

function normalizeExecutionMode(mode) {
  if (mode === EXECUTION_MODE_AUTO) return EXECUTION_MODE_AUTO;
  if (mode === EXECUTION_MODE_HITL || mode === "supervised" || mode === "guide" || mode === "human-in-the-loop") {
    return EXECUTION_MODE_HITL;
  }
  return EXECUTION_MODE_HITL;
}

function normalizeTrustLevel(trustLevel, executionMode = EXECUTION_MODE_HITL) {
  if (normalizeExecutionMode(executionMode) === EXECUTION_MODE_AUTO) {
    return "autopilot";
  }
  return trustLevel === "paranoid" ? "paranoid" : "balanced";
}

function updateExecutionModeUi() {
  const executionMode = normalizeExecutionMode(document.getElementById("executionMode")?.value);
  const trustLevelSelect = document.getElementById("trustLevel");
  const trustSection = document.getElementById("trustSettingsSection");
  const executionModeDescription = document.getElementById("executionModeDescription");
  const trustDescription = document.getElementById("trustLevelDescription");
  const trustLevel = normalizeTrustLevel(trustLevelSelect?.value, executionMode);

  if (trustLevelSelect) {
    trustLevelSelect.value = trustLevel;
    trustLevelSelect.disabled = executionMode === EXECUTION_MODE_AUTO;
  }

  if (trustSection) {
    trustSection.style.display = executionMode === EXECUTION_MODE_AUTO ? "none" : "";
  }

  if (executionModeDescription) {
    executionModeDescription.textContent = executionMode === EXECUTION_MODE_AUTO
      ? "Sauron Core runs browser tasks fully automatically with 100% trust and does not wait for per-step approval."
      : "Sauron Core runs the browser for you, but pauses according to your trust policy when human approval is needed.";
  }

  if (trustDescription) {
    trustDescription.textContent = trustLevel === "paranoid"
      ? "Every single browser step waits for your approval before it runs."
      : "Low-risk steps continue automatically; risky steps pause so you can approve, re-plan, or abort.";
  }
}

function updateTtsVolumeLabel() {
  const slider = document.getElementById("ttsVolume");
  const label = document.getElementById("ttsVolumeValue");
  if (!slider || !label) return;
  const volume = normalizeTtsVolume(slider.value);
  label.textContent = `${Math.round(volume * 100)}%`;
}

function updateTtsRateLabel() {
  const slider = document.getElementById("ttsRate");
  const label = document.getElementById("ttsRateValue");
  if (!slider || !label) return;
  const rate = normalizeTtsRate(slider.value);
  label.textContent = `${rate.toFixed(2)}x`;
}

function toggleAssemblyKey() {
  const stt = document.getElementById("sttProvider").value;
  document.getElementById("assemblyKey-group").style.display =
    (stt === "assemblyai") ? "flex" : "none";
    
  const showWhisper = (stt === "whisper");
  document.getElementById("whisperKey-group").style.display   = showWhisper ? "flex" : "none";
  document.getElementById("whisperApi-group").style.display   = showWhisper ? "flex" : "none";
  document.getElementById("whisperModel-group").style.display = showWhisper ? "flex" : "none";
}

function toggleElevenLabs() {
  const tts = document.getElementById("ttsProvider").value;
  const showEleven = tts === "elevenlabs";
  document.getElementById("elevenlabs-group").style.display       = showEleven ? "flex" : "none";
  document.getElementById("elevenlabs-voice-group").style.display = showEleven ? "flex" : "none";
  document.getElementById("openaiTts-group").style.display        = (tts === "openai") ? "flex" : "none";
}

let finopsRefreshTimer = null;
let runDoctorCheck = async () => {};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const DOCTOR_ACTION_TAB_LINKS = {
  "ai-credentials": "agents",
  "workspace-path": "workspace",
  "sauron-dir": "workspace",
  "vscode-cli": "workspace",
  "vscode-not-cursor": "workspace",
  "bridge-extension": "workspace",
  "cline-extension": "workspace",
};

function renderDoctorResults(result) {
  const summaryEl = document.getElementById("doctor-summary");
  const bannerEl = document.getElementById("doctor-readiness-banner");
  const listEl = document.getElementById("doctor-results");
  if (!summaryEl || !listEl) {
    return;
  }
  if (!result?.checks?.length) {
    summaryEl.textContent = result?.error || "Tanı başarısız";
    if (bannerEl) {
      bannerEl.classList.add("hidden");
      bannerEl.innerHTML = "";
    }
    listEl.innerHTML = "";
    return;
  }
  const { pass, warn, fail } = result.summary || {};
  summaryEl.textContent = `${pass || 0} geçti · ${warn || 0} uyarı · ${fail || 0} hata`;

  if (bannerEl && result.readiness) {
    const ready = result.readiness.status === "ready";
    bannerEl.classList.remove("hidden");
    bannerEl.classList.toggle("is-ready", ready);
    bannerEl.classList.toggle("is-blocked", !ready);
    const actionItems = result.readiness.actionItems || [];
    const actionList = actionItems.length
      ? `<ol class="doctor-readiness-actions">${actionItems.map((item) => {
        const tab = DOCTOR_ACTION_TAB_LINKS[item.id];
        const link = tab
          ? ` <button type="button" class="doctor-action-link" data-doctor-tab="${escapeHtml(tab)}">Ayarla →</button>`
          : "";
        return `<li>${escapeHtml(item.fixHint || item.label)}${link}</li>`;
      }).join("")}</ol>`
      : "";
    const warningText = (result.readiness.warnings || []).length
      ? `<p class="doctor-readiness-detail"><strong>Uyarı:</strong> ${escapeHtml(result.readiness.warnings.join("; "))}</p>`
      : "";
    bannerEl.innerHTML = `<strong>${escapeHtml(result.readiness.headline || (ready ? "Kullanıma Hazır" : "Eksikler var"))}</strong>${actionList}${warningText}`;
    bannerEl.querySelectorAll("[data-doctor-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        const tabId = button.getAttribute("data-doctor-tab");
        if (tabId) {
          activateSettingsTab(tabId);
          if (tabId === "workspace") {
            document.getElementById("workspacePath")?.focus();
          }
        }
      });
    });
  }

  listEl.innerHTML = result.checks.map((check) => {
    const statusClass = check.status === "pass" ? "pass" : (check.status === "warn" ? "warn" : "fail");
    const optionalTag = check.tier === "optional" ? " <em>(opsiyonel)</em>" : "";
    const hint = check.fixHint
      ? `<span class="doctor-fix-hint">${escapeHtml(check.fixHint)}</span>`
      : "";
    return `<li class="doctor-check ${statusClass}"><strong>${escapeHtml(check.message)}</strong>${optionalTag}${hint}</li>`;
  }).join("");
}

function activateSettingsTab(tabId) {
  const tabButtons = [...document.querySelectorAll(".settings-tab-btn")];
  const tabContents = [...document.querySelectorAll(".settings-tab-section")];
  tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabId);
  });
  tabContents.forEach((section) => {
    section.classList.toggle("active", section.dataset.tabContent === tabId);
  });
  if (tabId === "finops") {
    void refreshFinOpsSummary();
    void refreshFinOpsAnalytics();
    if (finopsRefreshTimer) clearInterval(finopsRefreshTimer);
    finopsRefreshTimer = setInterval(() => {
      void refreshFinOpsSummary();
      void refreshFinOpsAnalytics();
    }, 10000);
  } else if (finopsRefreshTimer) {
    clearInterval(finopsRefreshTimer);
    finopsRefreshTimer = null;
  }
}

function initAboutSection() {
  const info = window.sauronAppInfo || {};
  const nameEl = document.getElementById("aboutAppName");
  const versionEl = document.getElementById("aboutAppVersion");
  const publisherEl = document.getElementById("aboutPublisher");
  if (nameEl) {
    nameEl.textContent = info.name || "Sauron";
  }
  if (versionEl) {
    versionEl.textContent = `Sürüm ${info.version || "—"}`;
  }
  if (publisherEl) {
    const publisher = info.publisher || "Mehmet Can Bayatlı";
    publisherEl.textContent = `Geliştirici: ${publisher}`;
  }
}

function bindSettingsTabs() {
  const tabButtons = [...document.querySelectorAll(".settings-tab-btn")];
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.tab;
      activateSettingsTab(target);
      if (target === "workspace") {
        void runDoctorCheck();
      }
    });
  });
}

const AGENT_WALLET_IDS = ["gemini", "deepseek", "openai", "ollama"];
const AGENT_WALLET_LABELS = {
  gemini: "Gemini",
  deepseek: "DeepSeek",
  openai: "OpenAI",
  ollama: "Ollama",
};

function defaultAgentWallets() {
  return Object.fromEntries(AGENT_WALLET_IDS.map((id) => [id, { limitUsd: 0, topUpUsd: 0 }]));
}

function renderAgentWalletRows(wallets = {}, summaryWallets = {}) {
  const container = document.getElementById("finopsAgentWallets");
  if (!container) return;
  container.innerHTML = "";

  for (const agentId of AGENT_WALLET_IDS) {
    const wallet = wallets[agentId] || { limitUsd: 0, topUpUsd: 0 };
    const live = summaryWallets[agentId] || {};
    const row = document.createElement("div");
    row.className = "finops-agent-wallet-row";
    row.dataset.agentId = agentId;
    row.style.border = "1px solid rgba(255,255,255,0.08)";
    row.style.borderRadius = "8px";
    row.style.padding = "12px";
    row.style.marginBottom = "10px";

    const spentUsd = Number(live.spentUsd) || 0;
    const remainingUsd = live.unlimited ? null : Number(live.remainingUsd);
    const promptTokens = Number(live.promptTokens) || 0;
    const completionTokens = Number(live.completionTokens) || 0;
    const remainingText = live.unlimited
      ? "Sınırsız"
      : `$${Math.max(0, remainingUsd ?? 0).toFixed(4)}`;
    const isExhausted = !live.unlimited && Number(remainingUsd) <= 0 && Number(live.totalCreditUsd) > 0;
    const isLow = !live.unlimited && !isExhausted && Number(live.remainingPct) <= 20;
    const statusBadge = isExhausted
      ? '<span style="color:#f87171;font-weight:600">Tükendi</span>'
      : isLow
        ? '<span style="color:#fbbf24;font-weight:600">Azalıyor</span>'
        : "";

    row.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:8px">
        <strong>${AGENT_WALLET_LABELS[agentId] || agentId}</strong>
        <span style="display:flex;gap:10px;align-items:center">
          ${statusBadge}
          <span class="hint">Token: ${promptTokens.toLocaleString()} in / ${completionTokens.toLocaleString()} out</span>
        </span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:8px">
        <label>Limit (USD)
          <input class="form-input" type="number" min="0" step="0.01" data-wallet-limit value="${Number(wallet.limitUsd) || 0}"/>
        </label>
        <label>Harcanan (USD)
          <input class="form-input" type="text" readonly value="$${spentUsd.toFixed(4)}"/>
        </label>
        <label>Kalan (USD)
          <input class="form-input" type="text" readonly value="${remainingText}"/>
        </label>
        <label>Top-up toplam (USD)
          <input class="form-input" type="text" readonly value="$${(Number(wallet.topUpUsd) || 0).toFixed(4)}"/>
        </label>
      </div>
      <div style="display:flex;gap:8px;align-items:end">
        <label style="flex:1">+ Bakiye ekle (USD)
          <input class="form-input" type="number" min="0" step="0.01" data-wallet-topup-input placeholder="0.00"/>
        </label>
        <button class="btn btn-secondary" type="button" data-wallet-topup-btn>Ekle</button>
      </div>
    `;

    row.querySelector("[data-wallet-topup-btn]")?.addEventListener("click", () => {
      const input = row.querySelector("[data-wallet-topup-input]");
      const amount = Number(input?.value);
      if (!Number.isFinite(amount) || amount <= 0) {
        showToast("Geçerli bir bakiye miktarı girin", true);
        return;
      }
      if (!settings.finopsAgentWallets) {
        settings.finopsAgentWallets = defaultAgentWallets();
      }
      const current = settings.finopsAgentWallets[agentId] || { limitUsd: 0, topUpUsd: 0 };
      current.topUpUsd = (Number(current.topUpUsd) || 0) + amount;
      settings.finopsAgentWallets[agentId] = current;
      if (input) input.value = "";
      renderAgentWalletRows(settings.finopsAgentWallets, summaryWallets);
      showToast(`${AGENT_WALLET_LABELS[agentId]} bakiyesine $${amount.toFixed(2)} eklendi — kaydetmeyi unutmayın`);
    });

    container.appendChild(row);
  }
}

function collectAgentWallets() {
  const container = document.getElementById("finopsAgentWallets");
  const result = defaultAgentWallets();
  if (!container) return result;

  for (const row of container.querySelectorAll(".finops-agent-wallet-row")) {
    const agentId = row.dataset.agentId;
    if (!agentId || !result[agentId]) continue;
    const limitRaw = row.querySelector("[data-wallet-limit]")?.value;
    result[agentId].limitUsd = Number(limitRaw) || 0;
    result[agentId].topUpUsd = Number(settings.finopsAgentWallets?.[agentId]?.topUpUsd) || 0;
  }

  return result;
}

function initFinOpsSettings() {
  document.getElementById("finopsTotalBudgetTl").value = String(settings.finopsTotalBudgetTl ?? 0);
  const hardBudgetEl = document.getElementById("finopsHardBudgetEnabled");
  if (hardBudgetEl) hardBudgetEl.checked = settings.finopsHardBudgetEnabled === true;
  document.getElementById("finopsUsdToTl").value = String(settings.finopsUsdToTl ?? 34.5);
  document.getElementById("finopsDefaultPricePerMillionTl").value = String(settings.finopsDefaultPricePerMillionTl ?? 50);
  renderOverrideRows("finopsProviderOverrides", settings.finopsProviderPriceOverrides || {}, "provider");
  renderOverrideRows("finopsModelOverrides", settings.finopsModelPriceOverrides || {}, "model");

  document.getElementById("finopsCostOptimizerEnabled").checked = settings.finopsCostOptimizerEnabled !== false;
  const modeEl = document.getElementById("finopsCostOptimizerMode");
  if (modeEl) modeEl.value = settings.finopsCostOptimizerMode || "balanced";
  const tierEl = document.getElementById("finopsCoreModelTier");
  if (tierEl) tierEl.value = settings.finopsCoreModelTier || "economy";
  document.getElementById("finopsHandoffMaxChars").value = String(settings.finopsHandoffMaxChars ?? 4000);
  const finopsCodeContextMaxCharsEl = document.getElementById("finopsCodeContextMaxChars");
  if (finopsCodeContextMaxCharsEl) {
    finopsCodeContextMaxCharsEl.value = String(settings.finopsCodeContextMaxChars ?? 4000);
  }
  document.getElementById("finopsHandoffIncludeTranscript").checked = settings.finopsHandoffIncludeTranscript === true;
  document.getElementById("finopsDailyBudgetTl").value = String(settings.finopsDailyBudgetTl ?? 0);
  const deltaHandoffEl = document.getElementById("finopsDeltaHandoffEnabled");
  if (deltaHandoffEl) deltaHandoffEl.checked = settings.finopsDeltaHandoffEnabled !== false;
  const clarifySkipEl = document.getElementById("finopsClarifySkipEnabled");
  if (clarifySkipEl) clarifySkipEl.checked = settings.finopsClarifySkipEnabled !== false;
  const ollamaLowEl = document.getElementById("finopsClineOllamaForLow");
  if (ollamaLowEl) ollamaLowEl.checked = settings.finopsClineOllamaForLow === true;
  const panelContextEl = document.getElementById("finopsPanelContextMessages");
  if (panelContextEl) panelContextEl.value = String(settings.finopsPanelContextMessages ?? 20);
  if (!settings.finopsAgentWallets) {
    settings.finopsAgentWallets = defaultAgentWallets();
  }
  renderAgentWalletRows(settings.finopsAgentWallets, {});
  void refreshFinOpsSummary();
  void refreshFinOpsAnalytics();
}

function renderFinOpsAnalyticsChart(series = []) {
  const canvas = document.getElementById("finopsAnalyticsCanvas");
  const hintEl = document.getElementById("finopsAnalyticsHint");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const points = Array.isArray(series) ? series : [];
  if (!points.length) {
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "12px sans-serif";
    ctx.fillText("Henüz analitik veri yok", 12, height / 2);
    if (hintEl) hintEl.textContent = "Günlük TL harcaması";
    return;
  }

  const maxCost = Math.max(0.01, ...points.map((entry) => Number(entry.costTl) || 0));
  const barWidth = Math.max(16, Math.floor((width - 40) / points.length) - 8);
  const chartHeight = height - 36;

  points.forEach((entry, index) => {
    const cost = Number(entry.costTl) || 0;
    const barHeight = Math.max(2, (cost / maxCost) * chartHeight);
    const x = 20 + index * (barWidth + 8);
    const y = height - 20 - barHeight;
    ctx.fillStyle = "rgba(124, 58, 237, 0.85)";
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "10px sans-serif";
    ctx.fillText(String(entry.date || "").slice(5), x, height - 6);
  });

  if (hintEl) {
    const total = points.reduce((sum, entry) => sum + (Number(entry.costTl) || 0), 0);
    hintEl.textContent = `Son ${points.length} gün · toplam ${total.toFixed(2)} ₺`;
  }
}

async function refreshFinOpsAnalytics() {
  try {
    const analytics = await window.sauron.invoke("get-finops-analytics", { days: 7 });
    if (analytics?.ok) {
      renderFinOpsAnalyticsChart(analytics.series || []);
    }
  } catch (error) {
    renderFinOpsAnalyticsChart([]);
  }
}

function renderOverrideRows(containerId, overrides, kind) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  const entries = Object.entries(overrides || {});
  if (!entries.length) {
    container.appendChild(createOverrideRow(kind, "", ""));
    return;
  }
  for (const [name, price] of entries) {
    container.appendChild(createOverrideRow(kind, name, price));
  }
}

function createOverrideRow(kind, name = "", price = "") {
  const row = document.createElement("div");
  row.className = "finops-override-row";
  row.style.display = "flex";
  row.style.gap = "8px";
  row.style.marginBottom = "8px";

  const nameInput = document.createElement("input");
  nameInput.className = "form-input";
  nameInput.type = "text";
  nameInput.placeholder = kind === "provider" ? "provider (örn. openai)" : "model (örn. gpt-4o)";
  nameInput.value = name;
  nameInput.dataset.overrideName = "1";
  nameInput.style.flex = "1";

  const priceInput = document.createElement("input");
  priceInput.className = "form-input";
  priceInput.type = "number";
  priceInput.min = "0";
  priceInput.step = "0.01";
  priceInput.placeholder = "TL / 1M";
  priceInput.value = price === "" ? "" : String(price);
  priceInput.dataset.overridePrice = "1";
  priceInput.style.width = "140px";

  const removeBtn = document.createElement("button");
  removeBtn.className = "btn btn-secondary";
  removeBtn.type = "button";
  removeBtn.textContent = "Sil";
  removeBtn.addEventListener("click", () => row.remove());

  row.appendChild(nameInput);
  row.appendChild(priceInput);
  row.appendChild(removeBtn);
  return row;
}

function collectOverrideMap(containerId) {
  const container = document.getElementById(containerId);
  const result = {};
  if (!container) return result;

  for (const row of container.querySelectorAll(".finops-override-row")) {
    const name = row.querySelector("[data-override-name]")?.value?.trim();
    const priceRaw = row.querySelector("[data-override-price]")?.value;
    const price = Number(priceRaw);
    if (!name || !Number.isFinite(price)) continue;
    result[name] = price;
  }
  return result;
}

function bindFinOpsControls() {
  document.getElementById("btn-add-provider-override")?.addEventListener("click", () => {
    document.getElementById("finopsProviderOverrides")?.appendChild(createOverrideRow("provider"));
  });
  document.getElementById("btn-add-model-override")?.addEventListener("click", () => {
    document.getElementById("finopsModelOverrides")?.appendChild(createOverrideRow("model"));
  });
  document.getElementById("btn-refresh-finops")?.addEventListener("click", () => {
    void refreshFinOpsSummary();
  });
  document.getElementById("btn-finops-solo-preset")?.addEventListener("click", () => {
    applySoloUltraEconomyPreset();
  });
  document.getElementById("btn-finops-preset-restore")?.addEventListener("click", () => {
    restoreFinOpsPresetBackup();
  });
}

const FINOPS_PRESET_KEYS = [
  "finopsCostOptimizerMode",
  "finopsHandoffMaxChars",
  "finopsClineOllamaForLow",
  "finopsPanelContextMessages",
  "finopsMemoryCompressThreshold",
  "finopsMemoryCompressBatch",
  "finopsDeltaHandoffEnabled",
  "finopsClarifySkipEnabled",
];

function collectFinOpsPresetSnapshot() {
  const snapshot = {};
  for (const key of FINOPS_PRESET_KEYS) {
    if (settings[key] !== undefined) {
      snapshot[key] = settings[key];
    }
  }
  return snapshot;
}

function applySoloUltraEconomyPreset() {
  if (!settings.finopsPresetBackup || !Object.keys(settings.finopsPresetBackup).length) {
    settings.finopsPresetBackup = collectFinOpsPresetSnapshot();
  }
  settings.finopsCostOptimizerMode = "economy";
  settings.finopsHandoffMaxChars = 2500;
  settings.finopsClineOllamaForLow = true;
  settings.finopsPanelContextMessages = 10;
  settings.finopsMemoryCompressThreshold = 28;
  settings.finopsMemoryCompressBatch = 15;
  settings.finopsDeltaHandoffEnabled = true;
  settings.finopsClarifySkipEnabled = true;
  initFinOpsSettings();
  showToast("Solo Ultra Economy preset uygulandı — Kaydet ile kalıcı yapın");
}

function restoreFinOpsPresetBackup() {
  const backup = settings.finopsPresetBackup || {};
  if (!Object.keys(backup).length) {
    showToast("Geri alınacak preset yedeği yok", true);
    return;
  }
  for (const key of FINOPS_PRESET_KEYS) {
    if (backup[key] !== undefined) {
      settings[key] = backup[key];
    }
  }
  settings.finopsPresetBackup = {};
  initFinOpsSettings();
  showToast("FinOps preset geri alındı — Kaydet ile kalıcı yapın");
}

async function refreshFinOpsSummary() {
  try {
    const summary = await window.sauron.invoke("get-finops-summary");
    const spentEl = document.getElementById("finopsTotalSpentTl");
    const hintEl = document.getElementById("finopsSummaryHint");
    const breakdownEl = document.getElementById("finopsBreakdown");
    if (spentEl) {
      spentEl.value = `${(summary?.totalSpentTl ?? 0).toFixed(4)} TL`;
    }
    if (hintEl) {
      const parts = [`${summary?.entryCount ?? 0} kayıt`];
      if (summary?.logPath) parts.push(summary.logPath);
      if (summary?.remainingTl != null) {
        parts.push(`Kalan: ${summary.remainingTl.toFixed(4)} TL`);
      }
      if (summary?.clineReadonlyNote) {
        parts.push(summary.clineReadonlyNote);
      }
      hintEl.textContent = parts.join(" · ");
    }
    if (breakdownEl) {
      const lines = [];
      const byOperation = summary?.byOperation || {};
      const byProvider = summary?.byProvider || {};
      const byAgent = summary?.byAgent || {};
      if (Object.keys(byOperation).length) {
        lines.push("İşlem:");
        for (const [key, value] of Object.entries(byOperation)) {
          const suffix = key === "cline-task-readonly" ? " (tahmini, Cline geçmişinden)" : "";
          lines.push(`  ${key}${suffix}: ${Number(value).toFixed(4)} TL`);
        }
      }
      if (Object.keys(byAgent).length) {
        lines.push("Agent:");
        for (const agentId of AGENT_WALLET_IDS) {
          const stats = byAgent[agentId];
          if (!stats) continue;
          lines.push(`  ${agentId}: $${Number(stats.spentUsd || 0).toFixed(4)} · ${Number(stats.promptTokens || 0)} in / ${Number(stats.completionTokens || 0)} out`);
        }
      }
      if (Object.keys(byProvider).length) {
        lines.push("Provider:");
        for (const [key, value] of Object.entries(byProvider)) {
          lines.push(`  ${key}: ${Number(value).toFixed(4)} TL`);
        }
      }
      breakdownEl.textContent = lines.length ? lines.join("\n") : "Henüz kayıt yok.";
    }
    renderAgentWalletRows(collectAgentWallets(), summary?.agentWallets || {});
    try {
      const gooseSpend = await window.sauron.invoke("get-goose-daily-spend");
      const gooseSpentEl = document.getElementById("gooseDailySpentTl");
      const gooseHintEl = document.getElementById("gooseDailySpendHint");
      if (gooseSpentEl) {
        gooseSpentEl.value = `${(gooseSpend?.spentTl ?? 0).toFixed(4)} TL`;
      }
      if (gooseHintEl) {
        const parts = [`${gooseSpend?.summary?.count ?? 0} oturum (tahmini)`];
        if (gooseSpend?.dailyBudgetTl > 0) {
          parts.push(`Bütçe: ${gooseSpend.dailyBudgetTl.toFixed(2)} TL`);
          if (gooseSpend.remainingTl != null) {
            parts.push(`Kalan: ${gooseSpend.remainingTl.toFixed(4)} TL`);
          }
        }
        gooseHintEl.textContent = parts.join(" · ");
      }
    } catch {
      // optional row
    }
  } catch (error) {
    const hintEl = document.getElementById("finopsSummaryHint");
    if (hintEl) hintEl.textContent = `Özet alınamadı: ${error.message}`;
  }
}

function bindPluginCards() {
  const pluginCards = [...document.querySelectorAll("[data-plugin-card]")];
  const pluginPanels = [...document.querySelectorAll("[data-plugin-panel]")];

  function setPluginPanelState(pluginId, expanded) {
    pluginCards.forEach((card) => {
      const isTarget = card.dataset.pluginCard === pluginId;
      const trigger = card.querySelector(".plugin-card-trigger");
      card.classList.toggle("is-open", Boolean(expanded) && isTarget);
      trigger?.setAttribute("aria-expanded", Boolean(expanded) && isTarget ? "true" : "false");
    });

    pluginPanels.forEach((panel) => {
      const isTarget = panel.dataset.pluginPanel === pluginId;
      panel.classList.toggle("hidden", !(Boolean(expanded) && isTarget));
    });
  }

  pluginCards.forEach((card) => {
    const trigger = card.querySelector(".plugin-card-trigger");
    trigger?.addEventListener("click", () => {
      const pluginId = card.dataset.pluginCard;
      const nextExpanded = trigger.getAttribute("aria-expanded") !== "true";
      setPluginPanelState(pluginId, nextExpanded);

      if (nextExpanded) {
        card.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    });
  });
}

function formatMetricsSnapshot(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.metrics) || snapshot.metrics.length === 0) {
    return "No telemetry yet.";
  }

  const lines = [];
  lines.push(`Generated: ${snapshot.generatedAt}`);
  lines.push("");
  for (const metric of snapshot.metrics) {
    lines.push(
      `${metric.name}\n` +
      `  count=${metric.count} ok=${metric.successCount} err=${metric.errorCount}\n` +
      `  avg=${metric.avgDurationMs}ms p95=${metric.p95DurationMs}ms min=${metric.minDurationMs}ms max=${metric.maxDurationMs}ms last=${metric.lastDurationMs}ms`,
    );
    if (metric.lastMeta && Object.keys(metric.lastMeta).length > 0) {
      lines.push(`  lastMeta=${JSON.stringify(metric.lastMeta)}`);
    }
    lines.push("");
  }

  if (Array.isArray(snapshot.events) && snapshot.events.length > 0) {
    lines.push("Recent events:");
    snapshot.events.slice(0, 5).forEach((eventItem) => {
      lines.push(`- ${eventItem.ts} ${eventItem.name} ${JSON.stringify(eventItem.payload)}`);
    });
  }

  return lines.join("\n");
}

async function refreshMetrics() {
  const output = document.getElementById("metrics-output");
  if (!output) return;
  try {
    const snapshot = await window.sauron.invoke("get-performance-metrics");
    output.textContent = formatMetricsSnapshot(snapshot);
  } catch (error) {
    output.textContent = "Failed to load metrics.";
    showToast("Could not fetch metrics: " + error.message, true);
  }
}

async function resetMetrics() {
  try {
    await window.sauron.invoke("reset-performance-metrics");
    await refreshMetrics();
    showToast("Telemetry metrics reset");
  } catch (error) {
    showToast("Could not reset metrics: " + error.message, true);
  }
}

function normalizeShortcutFromEvent(event) {
  const acceleratorKey = normalizeAcceleratorKey(event);
  if (!acceleratorKey) return "";
  const parts = [];
  if (event.ctrlKey) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  if (event.metaKey) parts.push("Meta");
  parts.push(acceleratorKey);
  return parts.join("+");
}

function normalizeAcceleratorKey(event) {
  const code = String(event.code || "");
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^Numpad[0-9]$/.test(code)) return `num${code.slice(6)}`;
  if (/^F([1-9]|1\d|2[0-4])$/.test(code)) return code;

  const codeMap = {
    Space: "Space",
    Tab: "Tab",
    Enter: "Return",
    NumpadEnter: "Return",
    Backspace: "Backspace",
    Delete: "Delete",
    Insert: "Insert",
    Escape: "Esc",
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    Home: "Home",
    End: "End",
    PageUp: "PageUp",
    PageDown: "PageDown",
    Minus: "Minus",
    Equal: "Plus",
  };
  if (codeMap[code]) return codeMap[code];

  const key = String(event.key || "").toLowerCase();
  if (!key || key === "control" || key === "shift" || key === "alt" || key === "meta") {
    return "";
  }

  const keyMap = {
    " ": "Space",
    spacebar: "Space",
    enter: "Return",
    return: "Return",
    escape: "Esc",
    esc: "Esc",
    arrowup: "Up",
    arrowdown: "Down",
    arrowleft: "Left",
    arrowright: "Right",
    pageup: "PageUp",
    pagedown: "PageDown",
    "+": "Plus",
    "-": "Minus",
  };
  if (keyMap[key]) return keyMap[key];

  if (key.length === 1) {
    if (/[a-z]/.test(key)) return key.toUpperCase();
    return key;
  }
  return key[0].toUpperCase() + key.slice(1);
}

function stopShortcutRecording(button) {
  if (!button) return;
  button.classList.remove("recording");
  button.textContent = "Record";
  if (recordingButton === button) {
    recordingButton = null;
  }
}

function bindShortcutRecordButtons() {
  const recordButtons = [...document.querySelectorAll(".record-shortcut-btn[data-target-input]")];
  document.addEventListener("keydown", (event) => {
    if (!recordingButton) return;
    event.preventDefault();
    if (event.key === "Escape") {
      stopShortcutRecording(recordingButton);
      return;
    }
    const shortcut = normalizeShortcutFromEvent(event);
    if (!shortcut) return;
    const inputId = recordingButton.dataset.targetInput;
    const input = document.getElementById(inputId);
    if (input) {
      input.value = shortcut;
    }
    stopShortcutRecording(recordingButton);
  });

  recordButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (recordingButton && recordingButton !== button) {
        stopShortcutRecording(recordingButton);
      }
      if (recordingButton === button) {
        stopShortcutRecording(button);
        return;
      }
      recordingButton = button;
      recordingButton.classList.add("recording");
      recordingButton.textContent = "Press keys";
    });
  });
}

async function saveSettings() {
  // Collect model names typed by user for each provider
  const modelMap = {
    claude:     document.getElementById("claudeModel")?.value.trim() || "",
    openai:     document.getElementById("openaiModel")?.value.trim() || "",
    gemini:     document.getElementById("geminiModel")?.value.trim() || "",
    deepseek:   document.getElementById("deepseekModel")?.value.trim() || "",
    groq:       document.getElementById("groqModel")?.value.trim() || "",
    openrouter: document.getElementById("openrouterModel")?.value.trim() || "",
    ollama:     document.getElementById("ollamaModel")?.value.trim() || "",
  };

  const activeModel = modelMap[activeProvider] || modelMap.gemini || "";
  const executionMode = normalizeExecutionMode(document.getElementById("executionMode").value);
  const trustLevel = normalizeTrustLevel(document.getElementById("trustLevel").value, executionMode);

  const newSettings = {
    aiProvider:              "gemini",
    aiModel:                 activeModel,
    claudeModelCustom:       modelMap.claude,
    openaiModelCustom:       modelMap.openai,
    geminiModelCustom:       modelMap.gemini,
    deepseekModelCustom:     modelMap.deepseek,
    groqModelCustom:         modelMap.groq,
    openrouterModelCustom:   modelMap.openrouter,
    ollamaModelCustom:       modelMap.ollama,
    claudeApiKey:            document.getElementById("claudeApiKey")?.value.trim() || "",
    claudeBaseUrl:           document.getElementById("claudeBaseUrl")?.value.trim() || "https://api.anthropic.com",
    geminiApiKey:            document.getElementById("geminiApiKey").value.trim(),
    deepseekApiKey:          document.getElementById("deepseekApiKey").value.trim(),
    deepseekBaseUrl:         document.getElementById("deepseekBaseUrl")?.value.trim() || "https://api.deepseek.com",
    openaiApiKey:            document.getElementById("openaiApiKey").value.trim(),
    openaiBaseUrl:           document.getElementById("openaiBaseUrl")?.value.trim() || "https://api.openai.com/v1",
    geminiBaseUrl:           document.getElementById("geminiBaseUrl")?.value.trim() || "https://generativelanguage.googleapis.com/v1beta",
    groqApiKey:              document.getElementById("groqApiKey")?.value.trim() || "",
    groqBaseUrl:             document.getElementById("groqBaseUrl")?.value.trim() || "https://api.groq.com/openai/v1",
    openrouterApiKey:        document.getElementById("openrouterApiKey")?.value.trim() || "",
    openrouterBaseUrl:       document.getElementById("openrouterBaseUrl")?.value.trim() || "https://openrouter.ai/api/v1",
    openrouterMaxTokens:     Number(document.getElementById("openrouterMaxTokens")?.value) || 2048,
    ollamaUrl:               document.getElementById("ollamaUrl").value.trim() || "http://localhost:11434",
    assemblyaiApiKey:        document.getElementById("assemblyaiApiKey").value.trim(),
    whisperApiKey:           document.getElementById("whisperApiKey").value.trim(),
    whisperBaseUrl:          document.getElementById("whisperBaseUrl").value.trim() || "https://api.openai.com/v1",
    whisperModel:            document.getElementById("whisperModel").value.trim() || "whisper-1",
    elevenlabsApiKey:        document.getElementById("elevenlabsApiKey").value.trim(),
    elevenlabsVoiceId:       document.getElementById("elevenlabsVoiceId").value.trim(),
    openaiTtsApiKey:         document.getElementById("openaiTtsApiKey").value.trim(),
    openaiTtsBaseUrl:        document.getElementById("openaiTtsBaseUrl").value.trim() || "https://api.openai.com/v1",
    openaiTtsModel:          document.getElementById("openaiTtsModel").value.trim() || "tts-1",
    openaiTtsVoice:          document.getElementById("openaiTtsVoice").value.trim() || "nova",
    ttsRate:                 normalizeTtsRate(document.getElementById("ttsRate").value),
    ttsVolume:               normalizeTtsVolume(document.getElementById("ttsVolume").value),
    sttProvider:             normalizeSttProvider(document.getElementById("sttProvider").value),
    sttLanguage:             document.getElementById("sttLanguage").value,
    ttsProvider:             document.getElementById("ttsProvider").value,
    ttsEnabled:              document.getElementById("ttsEnabled").checked,
    pushToTalkShortcut:      document.getElementById("pushToTalkShortcut").value.trim(),
    markStepDoneShortcut:    document.getElementById("markStepDoneShortcut").value.trim(),
    requestStepHelpShortcut: document.getElementById("requestStepHelpShortcut").value.trim(),
    recheckCurrentStepShortcut: document.getElementById("recheckCurrentStepShortcut").value.trim(),
    cancelActivePlanShortcut: document.getElementById("cancelActivePlanShortcut").value.trim(),
    previousStepShortcut: document.getElementById("previousStepShortcut").value.trim(),
    skipCurrentStepShortcut: document.getElementById("skipCurrentStepShortcut").value.trim(),
    regenerateCurrentStepShortcut: document.getElementById("regenerateCurrentStepShortcut").value.trim(),
    executionMode,
    trustLevel,
    browserAgentEnabled:     document.getElementById("browserAgentEnabled").checked,
    browserHeadless:         document.getElementById("browserHeadless").checked,
    webStudioEnabled:        document.getElementById("webStudioEnabled")?.checked !== false,
    selfBuildEnabled:        document.getElementById("selfBuildEnabled")?.checked !== false,
    codeAgentNativeEnabled:  document.getElementById("codeAgentNativeEnabled")?.checked === true,
    gooseEnabled:            document.getElementById("gooseEnabled")?.checked !== false,
    gooseBinaryPath:         document.getElementById("gooseBinaryPath")?.value.trim() || "",
    gooseDefaultMode:        document.getElementById("gooseDefaultMode")?.value || "balanced",
    gooseDailyBudgetTl:      Number(document.getElementById("gooseDailyBudgetTl")?.value) || 0,
    gooseAutoMode:           document.getElementById("gooseAutoMode")?.checked !== false,
    awareAssistanceEnabled:  document.getElementById("awareAssistanceEnabled").checked,
    includeScreenshotByDefault: false,
    workspacePath:           document.getElementById("workspacePath").value.trim(),
    vscodePath:              document.getElementById("vscodePath")?.value.trim() || "",
    finopsTotalBudgetTl:     Number(document.getElementById("finopsTotalBudgetTl")?.value) || 0,
    finopsHardBudgetEnabled: document.getElementById("finopsHardBudgetEnabled")?.checked === true,
    finopsUsdToTl:           Number(document.getElementById("finopsUsdToTl")?.value) || 34.5,
    finopsDefaultPricePerMillionTl: Number(document.getElementById("finopsDefaultPricePerMillionTl")?.value) || 50,
    finopsProviderPriceOverrides: collectOverrideMap("finopsProviderOverrides"),
    finopsModelPriceOverrides: collectOverrideMap("finopsModelOverrides"),
    finopsCostOptimizerEnabled: document.getElementById("finopsCostOptimizerEnabled")?.checked !== false,
    finopsCostOptimizerMode: document.getElementById("finopsCostOptimizerMode")?.value || "balanced",
    finopsCoreModelTier: document.getElementById("finopsCoreModelTier")?.value || "economy",
    finopsHandoffMaxChars: Number(document.getElementById("finopsHandoffMaxChars")?.value) || 4000,
    finopsCodeContextMaxChars: Number(document.getElementById("finopsCodeContextMaxChars")?.value) || 4000,
    finopsHandoffIncludeTranscript: document.getElementById("finopsHandoffIncludeTranscript")?.checked === true,
    finopsDailyBudgetTl: Number(document.getElementById("finopsDailyBudgetTl")?.value) || 0,
    finopsDeltaHandoffEnabled: document.getElementById("finopsDeltaHandoffEnabled")?.checked !== false,
    finopsClarifySkipEnabled: document.getElementById("finopsClarifySkipEnabled")?.checked !== false,
    finopsClineOllamaForLow: document.getElementById("finopsClineOllamaForLow")?.checked === true,
    finopsPanelContextMessages: Number(document.getElementById("finopsPanelContextMessages")?.value) || 20,
    finopsMemoryCompressThreshold: Number(settings.finopsMemoryCompressThreshold) || 40,
    finopsMemoryCompressBatch: Number(settings.finopsMemoryCompressBatch) || 20,
    finopsPresetBackup: settings.finopsPresetBackup || {},
    finopsAgentWallets: collectAgentWallets(),
    systemPromptOverride: document.getElementById("systemPromptOverride")?.value.trim() || "",
    userMemoryFacts: String(document.getElementById("userMemoryFacts")?.value || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
    chatBackupEnabled: document.getElementById("chatBackupEnabled")?.checked === true,
    chatBackupPath: document.getElementById("chatBackupPath")?.value.trim() || "",
  };

  try {
    const result = await window.sauron.invoke("save-settings", newSettings);
    if (result?.warnings?.length) {
      showToast(result.warnings[0], true);
    }
    const gooseProbe = await refreshGooseProbeStatus(newSettings.gooseBinaryPath);
    if (gooseProbe?.cliCapable) {
      showToast(`✓ Ayarlar kaydedildi — Goose CLI v${gooseProbe.version || "?"}`);
    } else if (newSettings.gooseBinaryPath) {
      showToast(gooseProbe?.error || "Ayarlar kaydedildi — Goose CLI dogrulanamadi", true);
    } else {
      showToast("✓ Settings saved");
    }
    setTimeout(() => window.sauron.invoke("close-settings"), 1200);
  } catch (err) {
    showToast("Save failed: " + err.message, true);
  }
}

async function resetAllSettings() {
  const confirmed = await confirmResetSettings();
  if (!confirmed) return;

  try {
    await window.sauron.invoke("reset-settings");
    showToast("✓ Factory defaults restored");
    setTimeout(() => window.location.reload(), 400);
  } catch (err) {
    showToast("Reset failed: " + err.message, true);
  }
}

function confirmResetSettings() {
  const overlay = document.getElementById("confirm-overlay");
  const cancelBtn = document.getElementById("confirm-cancel");
  const confirmBtn = document.getElementById("confirm-confirm");
  const message = document.getElementById("confirm-message");

  if (!overlay || !cancelBtn || !confirmBtn) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    if (message) {
      message.textContent = "This will remove all saved settings and restore factory defaults.";
    }
    overlay.classList.remove("hidden");
    confirmBtn.focus();

    let settled = false;

    function finish(result) {
      if (settled) return;
      settled = true;
      overlay.classList.add("hidden");
      cancelBtn.removeEventListener("click", onCancel);
      confirmBtn.removeEventListener("click", onConfirm);
      overlay.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onKeydown);
      resolve(result);
    }

    function onCancel() {
      finish(false);
    }

    function onConfirm() {
      finish(true);
    }

    function onBackdrop(event) {
      if (event.target === overlay) finish(false);
    }

    function onKeydown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        finish(false);
      } else if (event.key === "Enter") {
        event.preventDefault();
        finish(true);
      }
    }

    cancelBtn.addEventListener("click", onCancel);
    confirmBtn.addEventListener("click", onConfirm);
    overlay.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKeydown);
  });
}

init();
