import { createChatHistoryController } from "./chat-history.js";
import { createWebStudioController } from "./web-studio.js";
import { createSelfBuildStudioController } from "./self-build-studio.js";
import { applyOptionalFeatureVisibility } from "./feature-visibility.js";
import { applyI18nToDocument, t } from "../i18n/index.js";
import { createMessagingController } from "./messaging.js";
import { createPlanView } from "./plan-view.js";
import { createPttController } from "./ptt.js";
import { createPanelState } from "./state.js";
import { createTtsPlaybackController } from "./tts.js";
import { createPanelUI, queryPanelDom } from "./ui.js";

const BROWSER_EXECUTION_TERMINAL_STATUSES = new Set(["success", "failed", "aborted"]);
const MODE_BAR_HIDE_DELAY_MS = 150;

function createPanelLogger() {
  return (...args) => {
    console.log("[Sauron][panel]", ...args);
  };
}

function isActiveBrowserExecution(browserExecution) {
  return Boolean(browserExecution) && !BROWSER_EXECUTION_TERMINAL_STATUSES.has(browserExecution.status);
}

function getModeBarPluginLabel(browserExecution) {
  const pluginId = String(
    browserExecution?.pluginId
    || browserExecution?.pluginName
    || browserExecution?.pluginType
    || "browser",
  ).toLowerCase();

  if (pluginId.includes("desktop")) {
    return "◈ DESKTOP EXECUTING";
  }
  if (pluginId.includes("cli")) {
    return "▸ CLI EXECUTING";
  }
  return "⬡ BROWSER EXECUTING";
}

function getTrustPresentation(trustLevel) {
  if (trustLevel === "autopilot") {
    return {
      label: "● AUTOPILOT",
      tone: "autopilot",
      noticeLabel: "autopilot",
    };
  }
  if (trustLevel === "paranoid") {
    return {
      label: "● PARANOID",
      tone: "paranoid",
      noticeLabel: "paranoid",
    };
  }
  return {
    label: "● SUPERVISED",
    tone: "supervised",
    noticeLabel: "supervised",
  };
}

function getCurrentBrowserStepNumber(browserExecution) {
  const substeps = Array.isArray(browserExecution?.substeps) ? browserExecution.substeps : [];
  if (substeps.length === 0) {
    return 0;
  }

  const running = substeps.find((substep) => substep?.status === "running");
  if (running?.stepNumber) {
    return Number(running.stepNumber) || 0;
  }

  return Number(substeps[substeps.length - 1]?.stepNumber) || substeps.length;
}

function formatModeBarStep(stepNumber) {
  const safeStep = Number.isFinite(Number(stepNumber)) ? Math.max(0, Number(stepNumber)) : 0;
  return `STEP ${safeStep} / ?`;
}

function normalizeInlineText(text) {
  return String(text || "").trim().replace(/\s+/g, " ");
}

function getBrowserExecutionTerminalSummary(browserExecution) {
  const finalMessage = normalizeInlineText(browserExecution?.finalMessage);
  if (finalMessage) {
    return finalMessage;
  }

  const goal = normalizeInlineText(browserExecution?.goal);
  if (goal) {
    return goal;
  }

  return browserExecution?.status === "success"
    ? t("taskCompleted")
    : t("taskFinishedIssues");
}

function createStepApprovalController({ dom, log, win = window }) {
  const StepApprovalCardCtor = win.StepApprovalCard;
  if (!dom.stepApprovalCard || !dom.stepApprovalSection) {
    return {
      syncBrowserExecution() {},
    };
  }

  if (typeof StepApprovalCardCtor !== "function") {
    log("step-approval:component unavailable");
    return {
      syncBrowserExecution() {},
    };
  }

  const card = new StepApprovalCardCtor(dom.stepApprovalCard, dom.stepApprovalSection);

  return {
    syncBrowserExecution(browserExecution) {
      const status = browserExecution?.status || null;
      if (!browserExecution || status === "success" || status === "failed" || status === "aborted") {
        card.hide();
      }
    },
  };
}

export function createPanelController({
  api = window.sauron || window.openguider,
  doc = document,
  win = window,
} = {}) {
  const state = createPanelState();
  const dom = queryPanelDom(doc);
  const log = createPanelLogger();

  const ui = createPanelUI({ api, doc, dom, log, state });
  const planView = createPlanView({ doc, dom });
  const stepApproval = createStepApprovalController({ dom, log, win });
  const webStudio = createWebStudioController({ api, ui, win, doc });
  const selfBuildStudio = createSelfBuildStudioController({ api, ui, doc });
  const messaging = createMessagingController({ api, doc, dom, log, state, ui, webStudio });
  const chatHistory = createChatHistoryController({ api, doc, dom, log, ui, state, win });
  const tts = createTtsPlaybackController({ api, log, state, win });
  const ptt = createPttController({ api, dom, log, messaging, state, ui, win });
  let lastBrowserExecutionSnapshot = null;
  let modeBarHideTimer = null;
  let workspacePollTimer = null;
  let focusInProgress = false;

  const HANDOFF_POLL_INTERVAL_MS = 2000;
  const HANDOFF_POLL_TIMEOUT_MS = 90000;
  const HANDOFF_HISTORY_REFRESH_MS = 30000;
  let handoffHistoryRefreshTimer = null;
  let panelEventsBound = false;
  let panelIpcListenersBound = false;
  let gamedevUiEngaged = false;
  let lastGamedevOpenAt = 0;

  async function refreshGamePipeline() {
    try {
      const status = await api.invoke("get-game-pipeline-status");
      if (status?.pipeline?.status === "active" || status?.pipeline?.status === "completed") {
        const phase = status.phase;
        if (dom.gamedevPipelineBar) {
          const label = status.pipeline?.status === "completed"
            ? "Pipeline tamamlandı"
            : (status.pendingComplete ? "Doğrulanıyor…" : `Faz ${phase?.phase || "?"}/${phase?.totalPhases || "?"}`);
          dom.gamedevPipelineBar.textContent = phase
            ? `${label}: ${String(phase.goal || "").slice(0, 48)}`
            : label;
        }
      }
      if (status?.pendingComplete && status?.pipeline?.status === "active") {
        const advanced = await api.invoke("advance-game-pipeline");
        if (advanced?.ok && advanced.action === "next-phase") {
          ui.showToast(`Game Dev faz ${advanced.pipeline?.currentPhase}/${advanced.pipeline?.totalPhases} handoff yazıldı`);
        } else if (advanced?.ok && advanced.action === "completed") {
          ui.showToast("Game Dev pipeline tamamlandı");
        } else if (advanced?.ok && advanced.action === "fix-handoff") {
          ui.showToast("Doğrulama hatası — düzeltme handoff yazıldı", true);
        }
        await refreshGamePipeline();
      }
    } catch (error) {
      log("game pipeline refresh error", error);
    }
  }

  async function refreshBuildPipeline() {
    try {
      const status = await api.invoke("get-build-pipeline-status");
      ui.renderBuildPipeline(status);
      if (status?.pendingComplete && status?.pipeline?.status === "active") {
        const advanced = await api.invoke("advance-build-pipeline");
        if (advanced?.ok && advanced.action === "next-phase") {
          ui.showToast(`Faz ${advanced.pipeline?.currentPhase}/${advanced.pipeline?.totalPhases} handoff yazıldı`);
        } else if (advanced?.ok && advanced.action === "completed") {
          ui.showToast("Üretim hattı tamamlandı");
        }
        await refreshBuildPipeline();
      await refreshGamePipeline();
      }
    } catch (error) {
      log("build pipeline refresh error", error);
    }
  }

  async function refreshHandoffHistory() {
    try {
      const result = await api.invoke("list-handoff-history", { limit: 10 });
      if (result?.ok) {
        ui.renderHandoffHistory(result.items || []);
      }
      await refreshBuildPipeline();
      await refreshGamePipeline();
    } catch (error) {
      log("handoff history refresh error", error);
    }
  }

  function startHandoffHistoryRefresh() {
    if (handoffHistoryRefreshTimer) {
      return;
    }
    void refreshHandoffHistory();
    handoffHistoryRefreshTimer = win.setInterval(() => {
      void refreshHandoffHistory();
    }, HANDOFF_HISTORY_REFRESH_MS);
  }

  state.refreshHandoffHistory = refreshHandoffHistory;

  function stopWorkspaceHandoffPoll() {
    if (workspacePollTimer) {
      win.clearInterval(workspacePollTimer);
      workspacePollTimer = null;
    }
  }

  async function focusWorkspaceVSCode() {
    if (focusInProgress) {
      return { ok: false, skipped: true, reason: "in_flight" };
    }

    focusInProgress = true;
    if (dom.workspaceStatusFocus) {
      dom.workspaceStatusFocus.disabled = true;
    }

    try {
      ui.showToast("VS Code açılıyor…", false);
      const result = await api.invoke("focus-workspace-vscode");
      if (!result?.ok) {
        ui.showToast(result?.error || "VS Code odaklanamadı", true);
      } else if (!result?.skipped) {
        if (result?.verified) {
          ui.showToast("VS Code açıldı", false);
        }
      }
      return result;
    } catch (error) {
      log("ipc:focus-workspace-vscode error", error);
      ui.showToast(error?.message || "VS Code odaklanamadı", true);
      return { ok: false, error: error?.message };
    } finally {
      focusInProgress = false;
      if (dom.workspaceStatusFocus) {
        dom.workspaceStatusFocus.disabled = false;
      }
    }
  }

  function syncIncludeScreenBadge() {
    const pendingCount = state.getPendingScreenshots()?.length || 0;
    if (pendingCount > 0) {
      ui.updateScreenPendingBadge(pendingCount);
      return;
    }
    if (state.getIncludeScreen() && dom.screenPendingBadge) {
      dom.screenPendingBadge.classList.remove("hidden");
      dom.screenPendingBadge.textContent = "📷 Otomatik";
      dom.screenPendingBadge.title = "Gönderimde ekran görüntüsü eklenecek";
      return;
    }
    ui.updateScreenPendingBadge(0);
  }

  function formatSetupWarnings(prerequisites) {
    const steps = Array.isArray(prerequisites?.steps) ? prerequisites.steps : [];
    const missing = steps.filter((step) => !step.ok);
    if (missing.length === 0) {
      return "";
    }
    return missing.map((step) => `• ${step.title}: ${step.docHint}`).join("\n");
  }

  async function pollHandoffUntilSettled(workspacePath, handoffFileName) {
    stopWorkspaceHandoffPoll();
    const startedAt = Date.now();

    return new Promise((resolve) => {
      const checkStatus = async () => {
        try {
          const statusResult = await api.invoke("get-handoff-status", {
            workspacePath,
            handoffFileName,
          });
          const status = statusResult?.status;

          if (status === "consumed") {
            stopWorkspaceHandoffPoll();
            ui.showWorkspaceStatus({
              title: "Cline görevi yüklendi",
              message: "Bridge handoff'u işledi. VS Code + Cline sidebar'da görevi görebilirsiniz.",
              tone: "success",
              onFocus: () => focusWorkspaceVSCode(),
            });
            resolve("consumed");
            return;
          }

          if (status === "rejected") {
            stopWorkspaceHandoffPoll();
            ui.showWorkspaceStatus({
              title: "Görev reddedildi",
              message: "VS Code'da aktif Cline görevi vardı ve yeni görev reddedildi.",
              tone: "warning",
              onFocus: () => focusWorkspaceVSCode(),
            });
            resolve("rejected");
            return;
          }

          if (Date.now() - startedAt >= HANDOFF_POLL_TIMEOUT_MS) {
            stopWorkspaceHandoffPoll();
            ui.showWorkspaceStatus({
              title: "Bridge yanıt vermedi",
              message: "VS Code açıldı ama handoff henüz işlenmedi. Cline sidebar'ını açın (saoudrizwan.claude-dev) ve Bridge kurulumunu kontrol edin.",
              tone: "warning",
              onFocus: () => focusWorkspaceVSCode(),
            });
            resolve("timeout");
          }
        } catch (error) {
          log("workspace handoff poll error", error);
        }
      };

      workspacePollTimer = win.setInterval(checkStatus, HANDOFF_POLL_INTERVAL_MS);
      void checkStatus();
    });
  }

  async function updateWorkspaceButtonState() {
    if (!dom.btnWorkspace) {
      return;
    }
    try {
      const prerequisites = await api.invoke("check-workspace-prerequisites");
      dom.btnWorkspace.classList.remove("workspace-ready", "workspace-warning");
      if (prerequisites?.ok) {
        dom.btnWorkspace.classList.add("workspace-ready");
        dom.btnWorkspace.title = "Çalışma Kısmı — hazır";
      } else if (prerequisites?.canOpenWorkspace) {
        dom.btnWorkspace.classList.add("workspace-warning");
        dom.btnWorkspace.title = "Çalışma Kısmı — eklenti kurulumu eksik";
      } else {
        dom.btnWorkspace.title = "Çalışma Kısmı — VS Code kurulumu gerekli";
      }
    } catch (error) {
      log("check-workspace-prerequisites error", error);
    }
  }

  async function openWorkspaceHandoff() {
    log("ipc:open-workspace-handoff invoke");
    if (dom.btnWorkspace.disabled) {
      return;
    }

    dom.btnWorkspace.disabled = true;
    ui.hideWorkspaceStatus();

    try {
      let prerequisites = await api.invoke("check-workspace-prerequisites");
      if (!prerequisites?.canOpenWorkspace) {
        ui.showErrorBanner({
          title: "VS Code kurulumu eksik",
          message: formatSetupWarnings(prerequisites) || prerequisites?.error || "code CLI bulunamadı.",
          actionLabel: "Kurulum rehberi",
          onAction: () => api.invoke("open-external-link", "https://github.com/metcan1234/Sauron#kurulum"),
        });
        return;
      }

      if (!prerequisites?.bridgeExtension) {
        ui.showToast("Sauron Bridge kuruluyor…", false);
        const installResult = await api.invoke("install-workspace-stack");
        if (!installResult?.ok) {
          ui.showErrorBanner({
            title: "Bridge kurulamadı",
            message: installResult?.error || formatSetupWarnings(installResult?.prerequisites) || "VS Code eklentisi kurulamadı.",
            actionLabel: "Kurulum rehberi",
            onAction: () => api.invoke("open-external-link", "https://github.com/metcan1234/Sauron#kurulum"),
          });
          return;
        }
        prerequisites = installResult.prerequisites || await api.invoke("check-workspace-prerequisites");
        ui.showToast("Sauron Bridge kuruldu", false);
      }

      if (!prerequisites?.clineExtension) {
        const proceedWithoutCline = await ui.confirmDialog({
          title: "Cline extension eksik",
          message: "Cline yüklü değil. VS Code açılır ama görev otomatik başlamaz.\n\nMarketplace'ten Cline (saoudrizwan.claude-dev) kurup devam edilsin mi?",
          confirmLabel: "Devam",
          cancelLabel: "İptal",
          confirmDanger: false,
        });
        if (!proceedWithoutCline) {
          return;
        }
      }

      let result = await api.invoke("open-workspace-handoff");
      if (result?.needsConfirm) {
        const proceed = await ui.confirmDialog({
          title: "Çalışma Kısmına geçilsin mi?",
          message: result.message || "Önceki görev henüz VS Code tarafında işlenmedi. Yine de devam edilsin mi?",
          confirmLabel: "Devam",
          cancelLabel: "İptal",
          confirmDanger: false,
        });
        if (!proceed) {
          return;
        }
        result = await api.invoke("open-workspace-handoff", { force: true });
      }

      if (!result?.ok) {
        if (result?.prerequisites) {
          ui.showErrorBanner({
            title: "Çalışma Kısmı açılamadı",
            message: formatSetupWarnings(result.prerequisites) || result.error,
            actionLabel: "Kurulum rehberi",
            onAction: () => api.invoke("open-external-link", "https://github.com/metcan1234/Sauron#kurulum"),
          });
        } else {
          ui.showToast(result?.error || "Çalışma Kısmı açılamadı", true);
        }
        return;
      }

      if (
        !result?.launchResult?.verified
        && result?.launchResult
        && !result.launchResult.skipped
        && result.launchResult.verificationReason !== "spawn_ok"
      ) {
        ui.showToast(
          result.launchResult.verificationReason === "process_only"
            ? "VS Code arka planda — pencere görünmüyor"
            : "VS Code başlatılamadı — Görev Yöneticisi'nde Code.exe kontrol edin",
          true,
        );
      }

      ui.showWorkspaceStatus({
        title: result?.launchResult?.verified ? "VS Code açıldı" : "VS Code bekleniyor",
        message: result?.launchResult?.verified
          ? "Bridge'in Cline'a görev yüklemesi bekleniyor…"
          : "VS Code penceresi doğrulanamadı. VS Code'a git ile tekrar deneyin.",
        tone: result?.launchResult?.verified ? "default" : "warning",
        onFocus: () => focusWorkspaceVSCode(),
      });

      if (Array.isArray(result.setupWarnings) && result.setupWarnings.length > 0) {
        ui.showToast("Eklenti eksik — otomatik görev başlamayabilir", true);
      }

      if (result.handoffFileName && result.workspacePath) {
        await pollHandoffUntilSettled(result.workspacePath, result.handoffFileName);
      }
    } catch (error) {
      ui.showToast(error?.message || "Çalışma Kısmı açılamadı", true);
    } finally {
      dom.btnWorkspace.disabled = false;
    }
  }

  function resolveGooseTaskText() {
    const plan = String(dom.planGoal?.value || "").trim();
    if (plan) {
      return plan;
    }
    return String(dom.textInput?.value || "").trim();
  }

  function setGooseUiActive(active, payload = {}) {
    dom.gooseBadge?.classList.toggle("hidden", !active);
    dom.btnGooseCancel?.classList.toggle("hidden", !active);
    if (active && dom.gooseBadge && payload.mode) {
      dom.gooseBadge.textContent = `🪿 Goose · ${payload.mode}`;
      dom.gooseBadge.title = `${payload.provider || ""} / ${payload.model || ""}`.trim();
    }
  }

  async function openGooseSession() {
    if (!dom.btnGoose || dom.btnGoose.disabled) {
      return;
    }

    const settings = await api.invoke("get-settings");
    if (settings?.gooseEnabled === false) {
      ui.showToast("Goose Kısmı devre dışı — Ayarlar → AI Ajanları", true);
      return;
    }

    const taskText = resolveGooseTaskText();
    if (!taskText) {
      ui.showToast("Goose için görev metni girin (sohbet veya plan alanı)", true);
      dom.textInput?.focus();
      return;
    }

    if (!String(settings?.workspacePath || "").trim()) {
      ui.showToast("Workspace path ayarlanmamış — Ayarlar → Çalışma Kısmı", true);
      return;
    }

    dom.btnGoose.disabled = true;

    try {
      const probe = await api.invoke("probe-goose-binary");
      if (!probe?.cliCapable) {
        const isDesktop = probe?.kind === "desktop";
        ui.showErrorBanner({
          title: isDesktop ? "Goose Desktop bulundu (CLI gerekli)" : "Goose CLI bulunamadı",
          message: [
            probe?.error || (isDesktop
              ? "Start Menu'deki Goose masaüstü uygulaması terminal komutlarini desteklemez."
              : "Block Goose CLI kurulu degil veya PATH'te yok."),
            probe?.installHint || "PowerShell: Goose CLI icin download_cli.ps1 calistirin.",
            isDesktop && probe?.desktopPath ? `Bulunan: ${probe.desktopPath}` : "",
          ].filter(Boolean).join("\n\n"),
          actionLabel: "Ayarları aç",
          onAction: () => api.invoke("open-settings"),
        });
        return;
      }

      let mode = null;
      if (settings.gooseAutoMode === false) {
        const preview = await api.invoke("preview-goose-mode", { taskText });
        const defaultMode = settings.gooseDefaultMode || "balanced";
        const recommended = preview?.mode || defaultMode;
        const proceed = await ui.confirmDialog({
          title: "Goose modu",
          message: `Önerilen: ${recommended}\nVarsayılan: ${defaultMode}\n\nÖnerilen modla başlatılsın mı? (Hayır = varsayılan mod)`,
          confirmLabel: "Önerilen",
          cancelLabel: "Varsayılan",
          confirmDanger: false,
        });
        mode = proceed ? recommended : defaultMode;
      } else if (settings.gooseShowModeHint !== false) {
        const preview = await api.invoke("preview-goose-mode", { taskText });
        const recommended = preview?.mode || "balanced";
        const noticeParts = [`Önerilen mod: ${recommended} — devam ediliyor`];
        if (Array.isArray(preview?.notices) && preview.notices.length > 0) {
          noticeParts.push(preview.notices[0]);
        }
        ui.showToast(noticeParts.join(" · "), false);
      }

      const result = await api.invoke("start-goose-session", { taskText, mode });
      if (!result?.ok) {
        ui.showToast(result?.error || "Goose başlatılamadı", true);
        return;
      }

      if (Array.isArray(result.notices) && result.notices.length > 0) {
        ui.showToast(result.notices.join(" "), false);
      }

      setGooseUiActive(true, result);
      const terminalLabel = result.terminal === "windows-terminal" ? "Windows Terminal" : "PowerShell";
      ui.showToast(`Goose ${terminalLabel} penceresi açıldı (${result.mode})`, false);
    } catch (error) {
      ui.showToast(error?.message || "Goose başlatılamadı", true);
    } finally {
      dom.btnGoose.disabled = false;
    }
  }

  async function cancelGooseSession() {
    const result = await api.invoke("cancel-goose-session");
    setGooseUiActive(false);
    if (result?.ok) {
      ui.showToast("Goose oturumu durduruldu");
    } else if (result?.error) {
      ui.showToast(result.error, true);
    }
  }

  function resolveGamedevMasterPrompt() {
    return String(dom.gamedevMasterPrompt?.value || "").trim();
  }

  function resolveGamedevTaskText() {
    const planPanel = dom.planPanel;
    const planVisible = planPanel && !planPanel.classList.contains("hidden");
    if (planVisible && dom.planGoal) {
      const planText = String(dom.planGoal.textContent || "").trim();
      if (planText && planText !== "Active plan") {
        return planText;
      }
    }
    return String(dom.textInput?.value || "").trim();
  }

  function logGamedevUi(active, payload = {}, source = "unknown") {
    log("gamedev-ui", {
      active,
      modeActive: payload?.modeActive,
      source,
      engaged: gamedevUiEngaged,
    });
  }

  function applyGamedevUiFromResult(result, source = "invoke") {
    if (!result?.ok) {
      return false;
    }
    gamedevUiEngaged = true;
    logGamedevUi(true, { ...result, modeActive: true }, source);
    setGamedevUiActive(true, { ...result, modeActive: true });
    return true;
  }

  function setGamedevUiActive(active, payload = {}) {
    if (active) {
      gamedevUiEngaged = true;
    } else if (payload?.forceDeactivate === true || payload?.modeActive === false) {
      gamedevUiEngaged = false;
    } else if (gamedevUiEngaged) {
      return;
    }

    dom.gamedevBadge?.classList.toggle("hidden", !active);
    dom.btnGamedevCancel?.classList.toggle("hidden", !active);
    dom.gamedevStudioBar?.classList.toggle("hidden", !active);
    dom.btnGamedev?.classList.toggle("gamedev-active", active);
    if (active && dom.gamedevBadge) {
      const engineLabel = payload.engineLabel || payload.engine || "Unity";
      const connector = payload.status?.connector;
      const dot = connector?.connected ? "🟢" : "🟡";
      const phase = payload.phase || payload.gamePipeline?.phase || payload.status?.gamePipeline?.phase;
      const phaseSuffix = phase
        ? ` · Faz ${phase.phase}/${phase.totalPhases}`
        : "";
      dom.gamedevBadge.textContent = `🎮 Game Dev · ${engineLabel}${phaseSuffix} ${dot}`;
      const finops = payload.finops || payload.status?.finops;
      const finopsHint = finops
        ? `MCP: ${finops.mcpToolCalls || 0} · LLM est: ${finops.llmTokensEst || 0} · Faz est: ${finops.phaseTokensEst || 0}`
        : "";
      dom.gamedevBadge.title = finopsHint
        || payload.tokenPolicy?.note
        || "MCP tool calls are local — minimal LLM token usage.";
    }
    if (active && dom.gamedevPipelineBar) {
      const phase = payload.phase || payload.gamePipeline?.phase || payload.status?.gamePipeline?.phase;
      const briefSummary = payload.status?.brief?.summary || payload.brief?.summary || "";
      const briefLine = briefSummary ? ` · ${briefSummary.slice(0, 40)}` : "";
      dom.gamedevPipelineBar.textContent = phase
        ? `Faz ${phase.phase}/${phase.totalPhases}: ${String(phase.goal || "").slice(0, 48)}${briefLine}`
        : briefSummary ? briefSummary.slice(0, 80) : "";
    }
    if (active && dom.gamedevDashboardLink) {
      const url = payload.dashboardUrl || payload.status?.dashboardUrl || "http://127.0.0.1:3100";
      dom.gamedevDashboardLink.href = url;
    }
  }

  async function syncGamedevUiFromStatus() {
    try {
      const status = await api.invoke("get-gamedev-status");
      const active = status?.modeActive === true;
      if (active) {
        gamedevUiEngaged = true;
      }
      setGamedevUiActive(active, {
        ...status,
        forceDeactivate: !active,
        modeActive: active,
      });
    } catch {
      if (!gamedevUiEngaged) {
        setGamedevUiActive(false, { forceDeactivate: true, modeActive: false });
      }
    }
  }

  function showGamedevLaunchFeedback(result, settings = {}) {
    const launchResult = result?.launchResult || result?.vscode?.launchResult;
    const verified = launchResult?.verified === true;
    const skipped = launchResult?.skipped === true;

    if (!verified && launchResult && !skipped && launchResult.verificationReason !== "spawn_ok") {
      ui.showToast(
        launchResult.verificationReason === "process_only"
          ? "VS Code arka planda — Görev Yöneticisi'nden Code penceresine geçin"
          : "VS Code başlatılamadı — ⌘ Çalışma Kısmı ile tekrar deneyin",
        true,
      );
    }

    ui.showWorkspaceStatus({
      title: verified || skipped ? "Game Dev · VS Code açıldı" : "Game Dev · VS Code bekleniyor",
      message: result?.handoffFileName
        ? "Cline handoff hazır — Bridge görevi yükleyecek."
        : "MCP config yazıldı. Cline'da gamedev-all-in-one MCP'yi başlatın.",
      tone: verified || skipped ? "default" : "warning",
      onFocus: () => focusWorkspaceVSCode(),
    });

    if (result?.dashboardUrl) {
      ui.showToast(`Dashboard: ${result.dashboardUrl}`, false);
    }
  }

  let gamedevSessionInFlight = false;

  let gamedevSetupStep = 1;

  function setGamedevSetupStep(step) {
    gamedevSetupStep = Math.max(1, Math.min(3, step));
    for (let i = 1; i <= 3; i += 1) {
      doc.getElementById(`gamedev-setup-step-${i}`)?.classList.toggle("hidden", i !== gamedevSetupStep);
    }
    const progress = doc.getElementById("gamedev-setup-progress");
    if (progress) {
      progress.textContent = `Adım ${gamedevSetupStep} / 3`;
    }
    doc.getElementById("gamedev-setup-prev")?.classList.toggle("hidden", gamedevSetupStep === 1);
    doc.getElementById("gamedev-setup-next")?.classList.toggle("hidden", gamedevSetupStep === 3);
    doc.getElementById("gamedev-setup-done")?.classList.toggle("hidden", gamedevSetupStep !== 3);
  }

  async function refreshGamedevSetupProbe(step) {
    const settings = await api.invoke("get-settings");
    if (step === 1) {
      const ws = String(settings?.workspacePath || "").trim();
      const layout = ws ? await api.invoke("detect-workspace-layout", { workspacePath: ws }) : null;
      const el = doc.getElementById("gamedev-setup-workspace-status");
      if (el) {
        if (!ws) {
          el.textContent = "Workspace ayarlanmamış — Ayarlar → Çalışma Kısmı";
        } else if (layout?.layout === "electron-core" || layout?.isOpenGuider) {
          el.textContent = "Uyarı: Sauron kaynak kodu seçili — Unity proje klasörü gerekli";
        } else {
          el.textContent = `Workspace: ${ws}`;
        }
      }
    }
    if (step === 2) {
      const status = await api.invoke("get-gamedev-status").catch(() => null);
      const el = doc.getElementById("gamedev-setup-bridge-status");
      if (el) {
        const connected = status?.connector?.connected === true;
        el.textContent = connected
          ? `${status.engineLabel || "Unity"} bridge bağlı`
          : "Bridge bekleniyor — Unity Editor + MCP başlatın";
      }
    }
    if (step === 3) {
      const doctor = await api.invoke("run-doctor", { live: true }).catch(() => null);
      const checks = doctor?.checks || [];
      const autoChain = checks.find((c) => c.id === "gamedev-pipeline-autochain");
      const mcp = checks.find((c) => c.id === "gamedev-mcp-entry");
      const el = doc.getElementById("gamedev-setup-doctor-status");
      if (el) {
        el.textContent = [
          mcp?.message || "MCP kontrol ediliyor…",
          autoChain?.message || "",
        ].filter(Boolean).join(" · ");
      }
    }
  }

  function showGamedevSetupWizard(settings = {}) {
    const templateEl = doc.getElementById("gamedev-setup-template");
    if (templateEl && settings.gamedevDefaultTemplate) {
      templateEl.value = settings.gamedevDefaultTemplate;
    }
    setGamedevSetupStep(1);
    dom.gamedevSetupOverlay?.classList.remove("hidden");
    void refreshGamedevSetupProbe(1);
  }

  async function completeGamedevSetup() {
    const template = doc.getElementById("gamedev-setup-template")?.value || "custom";
    await api.invoke("save-settings", {
      gamedevDefaultTemplate: template,
      gamedevSetupComplete: true,
    });
    dom.gamedevSetupOverlay?.classList.add("hidden");
    if (dom.gamedevTemplateSelect) {
      dom.gamedevTemplateSelect.value = template;
    }
    void openGamedevSession({ skipSetupCheck: true });
  }

  async function openGamedevSession(options = {}) {
    if (!dom.btnGamedev || dom.btnGamedev.disabled || gamedevSessionInFlight) {
      return;
    }

    const now = Date.now();
    if (now - lastGamedevOpenAt < 800) {
      return;
    }
    lastGamedevOpenAt = now;

    const settings = await api.invoke("get-settings");
    if (settings?.gamedevEnabled === false) {
      ui.showToast("Game Dev devre dışı — Ayarlar → Eklentiler", true);
      return;
    }

    if (!String(settings?.workspacePath || "").trim()) {
      ui.showToast("Workspace path ayarlanmamış — Ayarlar → Çalışma Kısmı", true);
      return;
    }

    if (!options.skipSetupCheck && !settings?.gamedevSetupComplete && dom.gamedevSetupOverlay) {
      showGamedevSetupWizard(settings);
      return;
    }

    if (dom.gamedevTemplateSelect && settings?.gamedevDefaultTemplate) {
      dom.gamedevTemplateSelect.value = settings.gamedevDefaultTemplate;
    }

    const taskText = resolveGamedevTaskText();
    const masterPrompt = resolveGamedevMasterPrompt();
    if (!taskText && !masterPrompt) {
      ui.showToast("Kısa görev veya Oyun planım yazın", true);
      return;
    }
    if (masterPrompt) {
      await api.invoke("save-settings", { gamedevMasterPrompt: masterPrompt });
    }
    dom.btnGamedev.disabled = true;
    gamedevSessionInFlight = true;

    try {
      const probe = await api.invoke("probe-gamedev-mcp");
      if (!probe?.ok) {
        ui.showErrorBanner({
          title: "gamedev-all-in-one bulunamadı",
          message: probe?.error || "extensions/gamedev-all-in-one/dist/index.js eksik.",
          actionLabel: "Ayarları aç",
          onAction: () => api.invoke("open-settings"),
        });
        return;
      }

      if (taskText || masterPrompt) {
        const result = await api.invoke("start-gamedev-session", { taskText, masterPrompt });
        if (!result?.ok) {
          ui.showToast(result?.error || "Game Dev oturumu başlatılamadı", true);
          return;
        }
        applyGamedevUiFromResult(result, "start-gamedev-session");
        if (result.truncated) {
          ui.showToast("Görev özeti token tasarrufu için kısaltıldı", false);
        }
        ui.showToast(`Game Dev · ${result.engineLabel || "Unity"} — Cline handoff hazır`, false);
        showGamedevLaunchFeedback(result, settings);
        if (result.handoffFileName) {
          await pollHandoffUntilSettled(result.workspacePath || settings.workspacePath, result.handoffFileName);
        }
        return;
      }

      const activate = await api.invoke("activate-gamedev-mode");
      if (!activate?.ok) {
        ui.showToast(activate?.error || "Game Dev modu açılamadı", true);
        return;
      }
      applyGamedevUiFromResult(activate, "activate-gamedev-mode");
      showGamedevLaunchFeedback(activate, settings);
      ui.showToast(
        activate.alreadyActive
          ? `Game Dev zaten açık · ${activate.engineLabel || "Unity"} — VS Code odaklandı`
          : `Game Dev açıldı · ${activate.engineLabel || "Unity"} (görev yazıp 🎮 ile handoff)`,
        false,
      );
    } catch (error) {
      log("openGamedevSession error", error);
      ui.showToast(error?.message || "Game Dev başlatılamadı", true);
    } finally {
      dom.btnGamedev.disabled = false;
      gamedevSessionInFlight = false;
    }
  }

  async function cancelGamedevMode() {
    const result = await api.invoke("deactivate-gamedev-mode");
    setGamedevUiActive(false, { forceDeactivate: true, modeActive: false });
    if (result?.ok) {
      ui.showToast("Game Dev modu kapatıldı");
    } else if (result?.error) {
      ui.showToast(result.error, true);
    }
  }

  function getActionShortcutMap() {
    return [
      { settingKey: "previousStepShortcut", action: () => api.invoke("previous-step"), button: dom.btnPlanPrev, title: t("shortcutPlanPrev") },
      { settingKey: "markStepDoneShortcut", action: () => api.invoke("mark-step-done"), button: dom.btnPlanDone, title: t("shortcutPlanDone") },
      { settingKey: "skipCurrentStepShortcut", action: () => api.invoke("skip-current-step"), button: dom.btnPlanSkip, title: t("shortcutPlanSkip") },
      { settingKey: "requestStepHelpShortcut", action: () => api.invoke("request-step-help"), button: dom.btnPlanHelp, title: t("shortcutPlanHelp") },
      { settingKey: "regenerateCurrentStepShortcut", action: () => api.invoke("regenerate-current-step"), button: dom.btnPlanRegenerate, title: t("shortcutPlanRegenerate") },
      { settingKey: "recheckCurrentStepShortcut", action: () => api.invoke("recheck-current-step"), button: dom.btnPlanRecheck, title: t("shortcutPlanRecheck") },
      { settingKey: "cancelActivePlanShortcut", action: () => api.invoke("cancel-active-plan"), button: dom.btnPlanCancel, title: t("shortcutPlanCancel") },
    ];
  }

  function applyShortcutTitles() {
    getActionShortcutMap().forEach(({ settingKey, button, title }) => {
      if (!button) {
        return;
      }
      if (!settingKey) {
        button.title = title;
        return;
      }
      const value = state.getSetting(settingKey);
      button.title = value ? `${title} (${value})` : title;
    });
  }

  function updatePlanActionButtons(snapshot) {
    const currentStep = snapshot?.activePlan?.steps?.[snapshot?.activePlan?.currentStepIndex];
    const enabled = Boolean(currentStep) && snapshot?.status === "waiting_user";
    dom.btnPlanDone.disabled = !enabled;
    dom.btnPlanPrev.disabled = !enabled;
    dom.btnPlanSkip.disabled = !enabled;
    dom.btnPlanHelp.disabled = !enabled;
    dom.btnPlanRegenerate.disabled = !enabled;
    dom.btnPlanRecheck.disabled = !enabled;
    dom.btnPlanCancel.disabled = !enabled;
  }

  function normalizeAssistantMode(mode) {
    if (mode === "guide" || mode === "planning") {
      return "guide";
    }
    return "assistant";
  }

  async function invokePlanAction(channel) {
    let images = state.getPendingScreenshots();
    if (channel === "mark-step-done" && (!images || images.length === 0)) {
      if (state.getIncludeScreen()) {
        try {
          images = await api.invoke("capture-screenshot", { forceFresh: true });
          state.setPendingScreenshots(images);
          ui.renderScreenshotPreviewStrip(images, null);
          ui.updateScreenPendingBadge(images?.length || 0);
        } catch (error) {
          log("plan-action auto-capture error", error);
          ui.showToast("Ekran görüntüsü alınamadı — 📷 ile manuel deneyin.", true);
          return;
        }
      }
      if (!images?.length) {
        ui.showToast("Tamamladım için önce Ekran Al butonuna basın.", true);
        return;
      }
    }
    try {
      await api.invoke(channel, images?.length ? { images } : {});
      if (images?.length) {
        state.setPendingScreenshots(null);
        ui.renderScreenshotPreviewStrip(null);
        ui.updateScreenPendingBadge(0);
      }
    } catch (error) {
      log(`ipc:${channel} error`, error);
      ui.showToast(error?.message || "Plan işlemi başarısız", true);
    }
  }

  async function toggleAssistantMode() {
    const current = normalizeAssistantMode(state.getSetting("assistantMode"));
    const nextMode = current === "guide" ? "assistant" : "guide";
    state.setSetting("assistantMode", nextMode);
    ui.renderPanelModeState({
      assistantMode: nextMode,
      sessionSnapshot: state.getSessionSnapshot(),
    });
    updatePlanActionVisibility(nextMode, state.getSessionSnapshot());
    try {
      await api.invoke("save-settings", { assistantMode: nextMode });
    } catch (error) {
      log("ipc:save-settings assistantMode error", error);
    }
    ui.showToast(nextMode === "guide" ? "Rehber modu: ekran + adım adım yönlendirme" : "Asistan modu: hızlı sohbet");
  }

  function updatePlanActionVisibility(_assistantMode, sessionSnapshot = null) {
    if (!dom.panelActions) {
      return;
    }
    const snapshot = sessionSnapshot || state.getSessionSnapshot();
    const microActive = Boolean(snapshot?.microGuideSession?.active);
    const hasActivePlan = Boolean(snapshot?.activePlan);
    const waitingUser = snapshot?.status === "waiting_user";
    const browserActive = isActiveBrowserExecution(snapshot?.browserExecution || state.getBrowserExecution());
    const shouldShow = hasActivePlan && waitingUser && !browserActive && !microActive;
    dom.panelActions.classList.toggle("hidden", !shouldShow);
    updateMicroGuideActionVisibility(snapshot);
  }

  function updateMicroGuideActionVisibility(sessionSnapshot = null) {
    if (!dom.microGuideActions) {
      return;
    }
    const snapshot = sessionSnapshot || state.getSessionSnapshot();
    const micro = snapshot?.microGuideSession;
    const active = Boolean(micro?.active);
    const waiting = micro?.status === "waiting_user" || micro?.status === "limit_reached";
    const shouldShow = active && waiting;
    dom.microGuideActions.classList.toggle("hidden", !shouldShow);
    ui.renderPanelModeState({
      assistantMode: normalizeAssistantMode(state.getSetting("assistantMode")),
      sessionSnapshot: snapshot,
    });

    if (dom.btnMicroGuideDone) {
      dom.btnMicroGuideDone.disabled = !active || micro?.status === "limit_reached";
    }
    if (dom.btnMicroGuideContinue) {
      dom.btnMicroGuideContinue.classList.toggle("hidden", micro?.status !== "limit_reached");
    }
    if (dom.btnMicroGuideCancel) {
      dom.btnMicroGuideCancel.disabled = !active;
    }
  }

  function updateModeBarStepCounter(stepNumber) {
    if (!dom.modeBarStep) {
      return;
    }
    dom.modeBarStep.textContent = formatModeBarStep(stepNumber);
  }

  function showModeBar(browserExecution) {
    if (!dom.modeBar) {
      return;
    }

    const trust = getTrustPresentation(browserExecution?.trustLevel);
    const shouldAnimateIn = dom.modeBar.classList.contains("hidden") || dom.modeBar.classList.contains("is-leaving");
    if (modeBarHideTimer) {
      win.clearTimeout(modeBarHideTimer);
      modeBarHideTimer = null;
    }

    dom.modeBarPlugin.textContent = getModeBarPluginLabel(browserExecution);
    dom.modeBarTrust.textContent = trust.label;
    dom.modeBarTrust.dataset.tone = trust.tone;
    updateModeBarStepCounter(getCurrentBrowserStepNumber(browserExecution));

    dom.modeBar.classList.remove("hidden", "is-leaving");
    dom.modeBar.setAttribute("aria-hidden", "false");
    if (shouldAnimateIn) {
      dom.modeBar.classList.remove("is-sweeping");
      void dom.modeBar.offsetWidth;
      dom.modeBar.classList.add("is-visible", "is-sweeping");
      win.setTimeout(() => {
        dom.modeBar?.classList.remove("is-sweeping");
      }, 320);
    } else {
      dom.modeBar.classList.add("is-visible");
    }
  }

  function hideModeBar() {
    if (!dom.modeBar || dom.modeBar.classList.contains("hidden")) {
      return;
    }

    if (modeBarHideTimer) {
      win.clearTimeout(modeBarHideTimer);
    }

    dom.modeBar.classList.remove("is-visible", "is-sweeping");
    dom.modeBar.classList.add("is-leaving");
    dom.modeBar.setAttribute("aria-hidden", "true");

    modeBarHideTimer = win.setTimeout(() => {
      dom.modeBar?.classList.add("hidden");
      dom.modeBar?.classList.remove("is-leaving");
      modeBarHideTimer = null;
    }, MODE_BAR_HIDE_DELAY_MS);
  }

  function injectBrowserExecutionNotice(previousExecution, nextExecution) {
    const wasActive = isActiveBrowserExecution(previousExecution);
    const isActive = isActiveBrowserExecution(nextExecution);

    if (!wasActive && isActive) {
      const trust = getTrustPresentation(nextExecution?.trustLevel);
      ui.injectSystemNotice(`⬡ Browser automation started · ${trust.noticeLabel}`, "start");
      return;
    }

    if (!wasActive) {
      return;
    }

    const nextStatus = nextExecution?.status || null;
    if (!nextStatus || !BROWSER_EXECUTION_TERMINAL_STATUSES.has(nextStatus)) {
      return;
    }

    const stepCount = Array.isArray(nextExecution?.substeps) ? nextExecution.substeps.length : 0;
    const summary = getBrowserExecutionTerminalSummary(nextExecution);
    const prefix = nextStatus === "success" ? "⬡ Done" : "⬡ Failed";
    ui.injectSystemNotice(
      `${prefix} · ${stepCount} step${stepCount === 1 ? "" : "s"} · ${summary}`,
      nextStatus === "success" ? "success" : "error",
      { richText: true },
    );
  }

  function syncBrowserExecution(browserExecution) {
    const activeExecution = isActiveBrowserExecution(browserExecution) ? browserExecution : null;
    state.setBrowserExecution(activeExecution);
    if (dom.panelRoot) {
      dom.panelRoot.classList.toggle("browser-task-active", Boolean(activeExecution));
    }
    if (browserExecution) {
      planView.renderBrowserExecution(browserExecution);
    } else {
      planView.clearBrowserExecution();
    }
    if (activeExecution) {
      showModeBar(activeExecution);
    } else {
      hideModeBar();
    }
    stepApproval.syncBrowserExecution(browserExecution || null);
    updatePlanActionVisibility(state.getSetting("assistantMode") || "fast");
  }

  function setupAttachmentHandlers() {
    const MAX_ATTACHMENTS = 5;
    const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

    function refreshAttachmentStrip() {
      ui.renderAttachmentPreviewStrip(state.getPendingAttachments(), (index) => {
        state.removePendingAttachment(index);
        refreshAttachmentStrip();
      });
    }

    async function readFileAsAttachment(file) {
      if (file.type.startsWith("image/")) {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(reader.error || new Error("read failed"));
          reader.readAsDataURL(file);
        });
        const base64Jpeg = dataUrl.split(",")[1] || "";
        return { type: "image", name: file.name, base64Jpeg, size: file.size };
      }

      const content = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error || new Error("read failed"));
        reader.readAsText(file);
      });
      return { type: "text", name: file.name, content, size: file.size };
    }

    async function addFiles(fileList) {
      const files = Array.from(fileList || []);
      for (const file of files) {
        if (state.getPendingAttachments().length >= MAX_ATTACHMENTS) {
          ui.showToast("En fazla 5 ek eklenebilir", true);
          break;
        }
        if (file.size > MAX_ATTACHMENT_BYTES) {
          ui.showToast(`${file.name} çok büyük (max 5MB)`, true);
          continue;
        }
        try {
          const attachment = await readFileAsAttachment(file);
          state.addPendingAttachment(attachment);
        } catch (error) {
          log("attachment-read-error", error);
          ui.showToast(`${file.name} okunamadı`, true);
        }
      }
      refreshAttachmentStrip();
    }

    const dropTargets = [dom.chatArea, dom.chatMessages].filter(Boolean);
    for (const target of dropTargets) {
      target.addEventListener("dragover", (event) => {
        event.preventDefault();
        target.classList.add("is-dragover");
      });
      target.addEventListener("dragleave", () => {
        target.classList.remove("is-dragover");
      });
      target.addEventListener("drop", (event) => {
        event.preventDefault();
        target.classList.remove("is-dragover");
        if (event.dataTransfer?.files?.length) {
          void addFiles(event.dataTransfer.files);
        }
      });
    }

    dom.chatArea?.addEventListener("paste", (event) => {
      const items = Array.from(event.clipboardData?.items || []);
      const files = items
        .filter((item) => item.kind === "file")
        .map((item) => item.getAsFile())
        .filter(Boolean);
      if (files.length > 0) {
        event.preventDefault();
        void addFiles(files);
      }
    });

    if (dom.btnAttachFile && dom.attachmentFileInput) {
      dom.btnAttachFile.addEventListener("click", () => {
        dom.attachmentFileInput.click();
      });
      dom.attachmentFileInput.addEventListener("change", () => {
        if (dom.attachmentFileInput.files?.length) {
          void addFiles(dom.attachmentFileInput.files);
        }
        dom.attachmentFileInput.value = "";
      });
    }

    return { addFiles };
  }

  function bindEvents() {
    if (panelEventsBound) {
      return;
    }
    panelEventsBound = true;

    const requiredControls = [
      ["textInput", dom.textInput],
      ["sendBtn", dom.sendBtn],
      ["pttBtn", dom.pttBtn],
      ["modelSelect", dom.modelSelect],
      ["btnSettings", dom.btnSettings],
      ["btnWorkspace", dom.btnWorkspace],
      ["btnClose", dom.btnClose],
      ["btnClear", dom.btnClear],
    ];
    const missingControls = requiredControls
      .filter(([, element]) => !element)
      .map(([name]) => name);
    if (missingControls.length > 0) {
      throw new Error(`Missing panel controls: ${missingControls.join(", ")}`);
    }

    dom.textInput.addEventListener("focus", () => {
      if (state.isStreaming()) {
        messaging.cancelMessage();
      }
    });

    dom.textInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        messaging.sendMessage();
      }
    });

    dom.textInput.addEventListener("input", () => {
      dom.textInput.style.height = "auto";
      dom.textInput.style.height = Math.min(dom.textInput.scrollHeight, 120) + "px";
    });

    dom.sendBtn.addEventListener("click", messaging.sendMessage);

    doc.getElementById("empty-cta-micro-guide")?.addEventListener("click", () => {
      void messaging.startMicroGuideSession("Ekranımda yardım et");
    });
    doc.getElementById("empty-cta-workspace")?.addEventListener("click", () => {
      void openWorkspaceHandoff();
    });
    doc.getElementById("empty-cta-gamedev")?.addEventListener("click", () => {
      void openGamedevSession();
    });
    doc.getElementById("empty-cta-code-agent")?.addEventListener("click", async () => {
      const goal = await ui.promptDialog({
        title: "Kod agent",
        message: "Workspace'te ne yapılmasını istersiniz?",
        defaultValue: "Projede küçük bir iyileştirme yap",
      });
      if (goal) {
        void messaging.startCodeAgentSession(goal);
      }
    });
    doc.getElementById("btn-code-studio")?.addEventListener("click", () => {
      void api.invoke("open-code-studio");
    });

    const stopBtn = doc.getElementById("stop-btn");
    if (stopBtn) {
      stopBtn.addEventListener("click", messaging.cancelMessage);
    }
    dom.btnPlanPrev.addEventListener("click", () => invokePlanAction("previous-step"));
    dom.btnPlanDone.addEventListener("click", () => invokePlanAction("mark-step-done"));
    dom.btnPlanSkip.addEventListener("click", () => invokePlanAction("skip-current-step"));
    dom.btnPlanHelp.addEventListener("click", () => invokePlanAction("request-step-help"));
    dom.btnPlanRegenerate.addEventListener("click", () => invokePlanAction("regenerate-current-step"));
    dom.btnPlanRecheck.addEventListener("click", () => invokePlanAction("recheck-current-step"));
    dom.btnPlanCancel.addEventListener("click", () => api.invoke("cancel-active-plan"));

    if (dom.btnCaptureScreen) {
      dom.btnCaptureScreen.addEventListener("click", () => messaging.captureScreenshot());
    }
    if (dom.btnMicroGuide) {
      dom.btnMicroGuide.addEventListener("click", async () => {
        if (state.isStreaming()) {
          return;
        }
        const goal = await ui.promptDialog({
          title: "Mikro rehber",
          message: "Ne konuda ekran yardımı istersiniz?",
          defaultValue: "Ekranımda yardım et",
          confirmLabel: "Başlat",
          cancelLabel: "İptal",
        });
        if (!goal) {
          return;
        }
        await messaging.startMicroGuideSession(goal);
      });
    }
    if (dom.btnMicroGuideDone) {
      dom.btnMicroGuideDone.addEventListener("click", () => messaging.ackMicroGuide());
    }
    if (dom.btnMicroGuideContinue) {
      dom.btnMicroGuideContinue.addEventListener("click", async () => {
        try {
          await api.invoke("micro-guide-continue");
        } catch (error) {
          log("ipc:micro-guide-continue error", error);
          ui.showToast(error?.message || "Devam edilemedi", true);
        }
      });
    }
    if (dom.btnMicroGuideCancel) {
      dom.btnMicroGuideCancel.addEventListener("click", async () => {
        try {
          await api.invoke("micro-guide-cancel");
        } catch (error) {
          log("ipc:micro-guide-cancel error", error);
          ui.showToast(error?.message || "İptal edilemedi", true);
        }
      });
    }
    if (dom.assistantModeBadge) {
      dom.assistantModeBadge.addEventListener("click", () => toggleAssistantMode());
    }

    const pipelineAdvanceBtn = doc.getElementById("build-pipeline-advance");
    if (pipelineAdvanceBtn) {
      pipelineAdvanceBtn.addEventListener("click", async () => {
        const result = await api.invoke("advance-build-pipeline");
        if (result?.ok) {
          await refreshBuildPipeline();
      await refreshGamePipeline();
          await refreshHandoffHistory();
        } else {
          ui.showToast(result?.error || "Faz ilerletilemedi", true);
        }
      });
    }

    dom.modelSelect.addEventListener("change", async () => {
      const selectedModel = dom.modelSelect.value;
      if (!selectedModel) {
        return;
      }

      state.setSetting("aiModel", selectedModel);
      const providerKey = (state.getSetting("aiProvider") || "claude") + "ModelCustom";
      state.setSetting(providerKey, selectedModel);

      log("ipc:save-settings invoke", providerKey);
      await api.invoke("save-settings", {
        aiModel: selectedModel,
        [providerKey]: selectedModel,
      });
    });

    dom.btnSettings.addEventListener("click", () => {
      log("ipc:open-settings invoke");
      api.invoke("open-settings");
    });

    dom.btnWorkspace.addEventListener("click", () => {
      void openWorkspaceHandoff();
    });

    dom.btnGoose?.addEventListener("click", () => {
      void openGooseSession();
    });

    dom.btnGooseCancel?.addEventListener("click", () => {
      void cancelGooseSession();
    });

    dom.btnGamedev?.addEventListener("click", () => {
      void openGamedevSession();
    });

    dom.btnGamedevCancel?.addEventListener("click", () => {
      void cancelGamedevMode();
    });

    doc.getElementById("gamedev-setup-prev")?.addEventListener("click", () => {
      setGamedevSetupStep(gamedevSetupStep - 1);
      void refreshGamedevSetupProbe(gamedevSetupStep);
    });

    doc.getElementById("gamedev-setup-next")?.addEventListener("click", () => {
      setGamedevSetupStep(gamedevSetupStep + 1);
      void refreshGamedevSetupProbe(gamedevSetupStep);
    });

    doc.getElementById("gamedev-setup-done")?.addEventListener("click", () => {
      void completeGamedevSetup();
    });

    dom.gamedevTemplateSelect?.addEventListener("change", async () => {
      const value = dom.gamedevTemplateSelect?.value || "auto";
      await api.invoke("save-settings", { gamedevDefaultTemplate: value });
    });

    dom.gamedevMasterPrompt?.addEventListener("blur", async () => {
      const value = resolveGamedevMasterPrompt();
      await api.invoke("save-settings", { gamedevMasterPrompt: value });
    });

    dom.gamedevDashboardLink?.addEventListener("click", (event) => {
      event.preventDefault();
      const url = dom.gamedevDashboardLink?.href || "http://127.0.0.1:3100";
      api.invoke("open-external-url", url).catch(() => {});
    });

    if (dom.workspaceStatusFocus) {
      dom.workspaceStatusFocus.addEventListener("click", async () => {
        const handled = await ui.invokeWorkspaceStatusFocus();
        if (!handled) {
          await focusWorkspaceVSCode();
        }
      });
    }

    if (dom.workspaceStatusDismiss) {
      dom.workspaceStatusDismiss.addEventListener("click", () => {
        ui.hideWorkspaceStatus();
      });
    }

    dom.btnClose.addEventListener("click", () => {
      log("ipc:minimize-panel invoke");
      api.invoke("minimize-panel");
    });

    dom.btnClear.addEventListener("click", async () => {
      const shouldDelete = await ui.confirmClearConversation();
      if (!shouldDelete) {
        return;
      }
      log("ipc:reset-session invoke");
      await api.invoke("reset-session");
    });
    dom.pttBtn.addEventListener("mousedown", ptt.startPTT);
    dom.pttBtn.addEventListener("mouseup", ptt.stopPTT);
    dom.pttBtn.addEventListener("mouseleave", ptt.stopPTT);

    // Click anywhere in chat area focuses the text input for typing.
    dom.chatArea.addEventListener("click", (event) => {
      // Don't steal focus from links or interactive elements inside messages.
      if (event.target.closest("a, button, select, input, textarea, details")) {
        return;
      }
      dom.textInput.focus();
    });

    // Safety: reset stuck UI state when user focuses the text input.
    dom.textInput.addEventListener("focus", () => {
      if (state.isStreaming()) {
        log("safety:focus reset stuck streaming state");
        api.invoke("abort-message");
        state.setStreaming(false);
        dom.sendBtn.disabled = false;
        ui.renderAgentState("idle");
        ui.removeAllTypingIndicators();
      }
      if (state.isRecording()) {
        log("safety:focus reset stuck recording state");
        ptt.stopPTT();
      }
    });

    dom.onboardingSkip?.addEventListener("click", async () => {
      state.setSetting("onboardingCompleted", true);
      await api.invoke("save-settings", { onboardingCompleted: true });
      ui.hideOnboarding();
    });

    dom.onboardingOpenSettings?.addEventListener("click", async () => {
      state.setSetting("onboardingCompleted", true);
      await api.invoke("save-settings", { onboardingCompleted: true });
      ui.hideOnboarding();
      await api.invoke("open-settings");
    });

    doc.addEventListener("openguide:regenerate-response", () => {
      void messaging.regenerateLastResponse();
    });

    doc.addEventListener("openguide:edit-message", (event) => {
      const index = Number(event.detail?.index);
      if (!Number.isFinite(index)) {
        return;
      }
      void messaging.editMessage(index);
    });

    doc.addEventListener("openguide:delete-message", (event) => {
      const index = Number(event.detail?.index);
      if (!Number.isFinite(index)) {
        return;
      }
      void messaging.deleteMessage(index);
    });

    setupAttachmentHandlers();

    doc.addEventListener("keydown", (event) => {
      const isMod = event.ctrlKey || event.metaKey;
      if (isMod && event.key.toLowerCase() === "n" && !event.shiftKey) {
        event.preventDefault();
        void chatHistory.createNewChat();
        return;
      }
      if (isMod && event.key.toLowerCase() === "k" && !event.shiftKey) {
        event.preventDefault();
        chatHistory.openDrawer();
        return;
      }
      if (isMod && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        chatHistory.openDrawer();
        return;
      }
      if (isMod && event.key === "Enter" && document.activeElement === dom.textInput) {
        event.preventDefault();
        messaging.sendMessage();
        return;
      }
      if (event.key === "Escape") {
        if (chatHistory.isDrawerOpen()) {
          chatHistory.closeDrawer();
          return;
        }
        if (state.isStreaming()) {
          messaging.cancelMessage();
        }
      }
    });
  }

  function setupIPCListeners() {
    if (panelIpcListenersBound) {
      return;
    }
    panelIpcListenersBound = true;

    api.on("panel-opened", () => {
      dom.textInput?.focus();
    });

    api.on("push-to-talk-start", () => {
      log("ipc:push-to-talk-start received");
      ptt.startPTT();
    });

    api.on("push-to-talk-stop", () => {
      log("ipc:push-to-talk-stop received");
      ptt.stopPTT();
    });

    api.on("ai-chunk", (chunk) => messaging.appendStreamChunk(chunk));
    api.on("ai-done", (parsed) => messaging.onAIDone(parsed));
    api.on("ai-error", (errorMessage) => messaging.onAIError(errorMessage));
    api.on("tts-start", (base64Audio) => tts.handleTtsStart(base64Audio));
    api.on("tts-webspeech", (data) => tts.handleWebSpeech(data));
    api.on("tts-webspeech-stop", (options) => tts.handleWebSpeechStop(options));
    api.on("tts-google", (chunksBase64) => tts.handleGoogleTts(chunksBase64));

    api.on("settings-changed", (nextSettings) => {
      log("ipc:settings-changed received");
      state.setSettings(nextSettings);
      ui.buildModelSelector();
      ui.updateProviderDot();
      applyShortcutTitles();
      const assistantMode = normalizeAssistantMode(nextSettings?.assistantMode);
      state.setSetting("assistantMode", assistantMode);
      ui.renderPanelModeState({
        assistantMode,
        sessionSnapshot: state.getSessionSnapshot(),
      });
      updatePlanActionVisibility(assistantMode);
      state.setIncludeScreen(nextSettings?.includeScreenshotByDefault === true);
      syncIncludeScreenBadge();
      void updateWorkspaceButtonState();
      applyOptionalFeatureVisibility(doc, nextSettings);
    });

    api.on("finops-budget-alert", (payload) => {
      const message = payload?.message || "AI bütçe uyarısı";
      ui.showToast(message, payload?.level === "exhausted" || payload?.level === "warning");
    });

    api.on("pipeline-updated", (payload) => {
      ui.renderBuildPipeline(payload);
    });

    api.on("code-agent-diff-pending", async (payload) => {
      const preview = String(payload?.diff || "").slice(0, 1200);
      const confirmed = await ui.confirmDialog({
        title: `Dosya değişikligi: ${payload?.path || ""}`,
        message: preview || "Degisiklik onayini bekliyor.",
        confirmLabel: "Onayla",
        cancelLabel: "Reddet",
      });
      await api.invoke(confirmed ? "code-agent-approve-change" : "code-agent-reject-change", {
        sessionId: payload?.sessionId,
      });
    });

    api.on("code-agent-step-updated", (payload) => {
      const logEl = doc.getElementById("code-agent-log");
      if (logEl) {
        logEl.classList.remove("hidden");
        const line = payload?.tool || payload?.phase || "adim";
        logEl.textContent = `${line}: ${payload?.message || ""}`.trim();
      }
    });

    api.on("code-agent-complete", (payload) => {
      doc.getElementById("code-agent-badge")?.classList.add("hidden");
      ui.showToast(payload?.summary || "Kod agent tamamlandi");
    });

    api.on("code-agent-error", (payload) => {
      doc.getElementById("code-agent-badge")?.classList.add("hidden");
      ui.showToast(payload?.error || "Kod agent hatasi", true);
    });

    api.on("goose-session-started", (payload) => {
      setGooseUiActive(true, payload || {});
    });

    api.on("goose-session-cancelled", () => {
      setGooseUiActive(false);
    });

    api.on("gamedev-mode-changed", (payload) => {
      if (payload?.modeActive !== false) {
        return;
      }
      logGamedevUi(false, payload, "ipc:gamedev-mode-changed");
      setGamedevUiActive(false, { ...payload, forceDeactivate: true, modeActive: false });
    });

    api.on("game-pipeline-updated", (payload) => {
      if (!payload?.phase) {
        return;
      }
      setGamedevUiActive(true, {
        modeActive: true,
        gamePipeline: payload,
        phase: payload.phase,
      });
    });

    api.on("browser-agent-status-changed", (status) => {
      const statusText = String(status || "");
      if (!statusText.startsWith("crashed")) {
        return;
      }
      const detail = statusText.replace(/^crashed:\s*/i, "").trim();
      ui.showErrorBanner({
        title: t("browserCrashTitle"),
        message: detail || t("browserCrashMessage"),
        actionLabel: t("openSettings"),
        onAction: () => api.invoke("open-settings"),
      });
    });

    api.on("session-updated", (snapshot) => {
      log("ipc:session-updated received");
      injectBrowserExecutionNotice(lastBrowserExecutionSnapshot, snapshot?.browserExecution || null);
      lastBrowserExecutionSnapshot = snapshot?.browserExecution || null;
      messaging.syncSession(snapshot);
      planView.renderPlan(snapshot?.activePlan || null);
      syncBrowserExecution(snapshot?.browserExecution || null);
      ui.renderAgentState(snapshot?.status === "executing" ? "idle" : (snapshot?.status || "idle"));
      updatePlanActionVisibility(normalizeAssistantMode(state.getSetting("assistantMode")), snapshot);
      updatePlanActionButtons(snapshot);
      void chatHistory.refreshSessionList();
      void ui.refreshFinOpsBadge();
    });

    api.on("execution:substep-progress", (substep) => {
      if (!isActiveBrowserExecution(lastBrowserExecutionSnapshot)) {
        return;
      }
      updateModeBarStepCounter(substep?.stepNumber || getCurrentBrowserStepNumber(lastBrowserExecutionSnapshot));
    });

    api.on("plan-updated", (plan) => {
      log("ipc:plan-updated received");
      state.setActivePlan(plan || null);
      planView.renderPlan(plan || null);
      updatePlanActionVisibility(normalizeAssistantMode(state.getSetting("assistantMode")), {
        activePlan: plan || null,
        browserExecution: state.getBrowserExecution(),
      });
    });

    api.on("agent-state-changed", (nextState) => {
      log("ipc:agent-state-changed received", nextState);
      state.setAgentState(nextState);
      ui.renderAgentState(nextState);
    });

    api.on("pointer-updated", (pointer) => {
      log("ipc:pointer-updated received");
      state.setPointer(pointer);
    });
  }

  async function ensureRuntimePermissions() {
    try {
      const permissionState = await api.invoke("ensure-runtime-permissions");
      if (permissionState?.screenNeedsSettings) {
        ui.showErrorBanner({
          title: "Ekran kaydı izni gerekli",
          message: "Sauron Core, ekran görüntüsü rehberliği için macOS Ekran Kaydı iznine ihtiyaç duyar.",
          actionLabel: "Sistem ayarlarını aç",
          onAction: () => {
            api.invoke("open-permission-settings", "screen");
          },
        });
      }
    } catch (error) {
      log("ipc:ensure-runtime-permissions error", error);
    }
  }

  async function init() {
    log("init:start");
    try {
      applyI18nToDocument(doc);
      const settings = await api.invoke("get-settings");
      const session = await api.invoke("get-active-session");
      state.setSettings(settings);
      state.setSessionSnapshot(session);
      ui.buildModelSelector();
      ui.updateProviderDot();
      ui.renderConversation(session?.messages || []);
      planView.renderPlan(session?.activePlan || null);
      lastBrowserExecutionSnapshot = session?.browserExecution || null;
      syncBrowserExecution(session?.browserExecution || null);
      ui.renderAgentState(session?.status === "executing" ? "idle" : (session?.status || "idle"));
      applyShortcutTitles();
      updatePlanActionButtons(session);
      const assistantMode = normalizeAssistantMode(settings?.assistantMode);
      state.setSetting("assistantMode", assistantMode);
      if (dom.gamedevMasterPrompt && settings?.gamedevMasterPrompt) {
        dom.gamedevMasterPrompt.value = settings.gamedevMasterPrompt;
      }
      ui.renderPanelModeState({
        assistantMode,
        sessionSnapshot: state.getSessionSnapshot(),
      });
      updatePlanActionVisibility(assistantMode, session);
      dom.sendBtn.disabled = false;
      dom.pttBtn.disabled = false;
      state.setIncludeScreen(settings?.includeScreenshotByDefault === true);
      syncIncludeScreenBadge();
      bindEvents();
      chatHistory.bindEvents();
      setupIPCListeners();
      if (!settings?.onboardingCompleted) {
        ui.showOnboarding();
      }
      await ensureRuntimePermissions();
      await updateWorkspaceButtonState();
      applyOptionalFeatureVisibility(doc, settings);
      await syncGamedevUiFromStatus();
      startHandoffHistoryRefresh();
      await ui.refreshFinOpsBadge();
      dom.textInput.focus();
      log("init:complete");
    } catch (error) {
      log("init:failed", error);
      ui.showErrorBanner({
        title: "Panel başlatılamadı",
        message: error?.message || "Bilinmeyen hata",
      });
    }
  }

  return {
    init,
  };
}

export async function initPanelApp() {
  try {
    const controller = createPanelController();
    await controller.init();
  } catch (error) {
    console.error("[Sauron][panel] init:failed", error);
  }
}
