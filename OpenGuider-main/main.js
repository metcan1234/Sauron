// main.js — Electron main process
// Handles: system tray, windows lifecycle, global hotkeys, IPC, AI streaming,
// screenshot capture, TTS, cursor overlay management.

const { app } = require("electron");
if (process.platform === "win32" && process.env.SAURON_DISABLE_GPU === "1") {
  app.disableHardwareAcceleration();
}
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  console.warn("");
  console.warn("[Sauron] Zaten çalışan bir örnek var (sistem tepsisi / arka plan).");
  console.warn("[Sauron] Yeni pencere açılmadı — mevcut örnek odaklanmaya çalışıyor.");
  console.warn("[Sauron] Tamamen kapatmak için terminalde:");
  console.warn("         Get-Process electron,Sauron -ErrorAction SilentlyContinue | Stop-Process -Force");
  console.warn("[Sauron] Geliştirme modu: npm run terminal");
  console.warn("");
  app.quit();
  process.exit(0);
}
const {
  BrowserWindow, Tray, Menu, ipcMain, screen,
  nativeImage, globalShortcut, shell, safeStorage, systemPreferences, dialog,
} = require("electron");
const path   = require("path");
const fs = require("fs");
const { createStore }     = require("./src/store");
const { getPreloadPath, getRendererDir } = require("./src/app-paths");
const { SecureStore, SECRET_KEYS } = require("./src/secure-store");
const { captureAllScreens } = require("./src/screenshot");
const { streamAIResponse, parsePointTag, fetchOllamaModels } = require("./src/ai/index");
const {
  buildHandoffPayload,
  enrichHandoffPayloadFinOps,
  writeHandoff,
  seedSauronRules,
  launchVSCode,
  listPendingHandoffs,
  listHandoffHistory,
  rejectHandoffFile,
  rejectPendingHandoffs,
  getHandoffStatus,
  focusVSCodeWorkspace,
} = require("./src/sauron/handoff");
const { checkWorkspacePrerequisites } = require("./src/sauron/workspace-setup");
const { bootstrapWorkspace } = require("./src/sauron/workspace-bootstrap");
const { installWorkspaceStack } = require("./src/sauron/workspace-stack-installer");
const { runSauronDoctor } = require("./src/sauron/doctor");
const { setConfiguredVscodePath } = require("./src/sauron/vscode-launcher");
const { SessionManager } = require("./src/session/session-manager");
const {
  clearSessionSnapshot,
  loadSessionSnapshot,
  saveSessionSnapshot,
} = require("./src/session/session-persistence");
const {
  createEphemeralChatSession,
  createChatFolder,
  createMemoryChatSession,
  createNewChatSession,
  deleteChatFolder,
  deleteChatSession,
  listChatSessionSummaries,
  listChatFolders,
  loadChatSession,
  migrateLegacySessionSnapshot,
  moveChatSession,
  persistActiveSession,
  duplicateChatSession,
  exportAllSessionsJson,
  formatChatExportMarkdown,
  getActiveChatSessionTitle,
  getActiveChatSessionRecord,
  getChatSessionById,
  importChatSessionsFromJson,
  renameChatFolder,
  renameChatSession,
  sanitizeExportFilename,
  toggleChatSessionPin,
  ensureChatSessionsState,
  loadChatSessionsState,
  MAX_AI_CONTEXT_MESSAGES,
  MAX_STORED_MESSAGES,
} = require("./src/session/chat-sessions");
const { emitPointerTool } = require("./src/agent/tools/pointer-tool");
const { TaskOrchestrator } = require("./src/agent/task-orchestrator");
const { formatStructuredUserError } = require("./src/ai/structured");
const { configureFinOpsContext } = require("./src/sauron/finops/llm-tracker");
const { emitBudgetAlert } = require("./src/sauron/finops/budget-alert");
const { getUsageSummary, getUsageTimeSeries } = require("./src/sauron/finops/usage-tracker");
const { syncClineUsageFromDisk } = require("./src/sauron/finops/cline-usage-reader");
const { startClineUsagePoller, stopClineUsagePoller } = require("./src/sauron/finops/cline-usage-poller");
const { syncFinOpsConfigToWorkspace } = require("./src/sauron/finops/workspace-config");
const {
  writeCredentialRequest,
  getCredentialSyncStatus,
} = require("./src/sauron/cline-credential-bridge");
const { syncAgentMatrixFromSettings } = require("./src/sauron/finops/agent-matrix");
const { createLogger, createRequestContext, initializeLogger } = require("./src/logger");
const { PerformanceMetrics } = require("./src/performance-metrics");
const {
  getPlatformCapabilities,
  normalizeSettingsForPlatform,
  resolveEffectiveTtsProvider,
} = require("./src/platform-capabilities");
const { registry } = require("./src/core/plugin-registry");
const { BrowserPlugin } = require("./src/plugins/browser/index");
const { prepareBrowserPluginLlmConfig } = require("./src/plugins/browser/llm-config");
const { createBrowserExecutionTtsController } = require("./src/tts/browser-execution-tts");
const { registerChatSessionsIpc } = require("./src/ipc/chat-sessions-ipc");
const { registerAiIpc } = require("./src/ipc/ai-ipc");
const { registerWorkspaceIpc } = require("./src/ipc/workspace-ipc");
const { registerFinOpsIpc } = require("./src/ipc/finops-ipc");
const { registerBrowserIpc } = require("./src/ipc/browser-ipc");
const { registerWebStudioIpc } = require("./src/ipc/web-studio-ipc");
const { registerMicroGuideIpc } = require("./src/ipc/micro-guide-ipc");
const { registerBuildPipelineIpc } = require("./src/ipc/build-pipeline-ipc");
const { createWindowManager } = require("./src/main/window-manager");
const { createTrayMenu } = require("./src/main/tray-menu");
const { raisePanelAboveOverlay, resetPanelAlwaysOnTop } = require("./src/main/panel-window-focus");

// ── Constants ─────────────────────────────────────────────────────────────────
const PANEL_WIDTH  = 440;
const PANEL_HEIGHT = 660;
const WIDGET_WIDTH = 220;
const WIDGET_COLLAPSED_HEIGHT = 68;
const PANEL_WINDOW_MARGIN = 16;
const WIDGET_EXPANDED_HEIGHT = 248;
const ASSISTANT_CHAT_PROMPT = [
  "ASSISTANT CHAT MODE:",
  "This panel is for conversation, guidance, and questions only — not coding tasks.",
  "Do NOT create step-by-step plans, task lists, or file-edit instructions.",
  "Do NOT ask the user to create files, write code, or run terminal commands in this panel.",
  "When the user wants coding, refactoring, git, or terminal work, briefly explain and direct them to the Çalışma Kısmı (Workspace) button.",
  "For casual greetings or small talk, reply naturally and briefly.",
  "Always append a [POINT:x,y:label] tag when a clickable target is likely on screen.",
  "If uncertain, still provide your best click estimate with a concise label.",
].join(" ");
const TERMINAL_BROWSER_EXECUTION_STATUSES = new Set(["success", "failed", "aborted"]);

// ── Global state ──────────────────────────────────────────────────────────────
let tray                 = null;
let panelWindow          = null;
let settingsWindow       = null;
let cursorOverlayWindow  = null;
let widgetWindow         = null;
let store                = null;
let secureStore          = null;
let appLogger            = createLogger("main");
let isPanelVisible       = false;
let currentAIController  = null; // AbortController for in-flight AI requests
let assemblySocket       = null; // AssemblyAI WebSocket
let sessionManager       = null;
let taskOrchestrator     = null;
let perfMetrics          = new PerformanceMetrics();
let pointerCalibration   = {
  byScreenNumber: {},
  byDisplayId: {},
  updatedAt: null,
};
let isPushToTalkRecording = false;
let isPlanShortcutInFlight = false;
let panelOpenAnimationTimer = null;
let lastPanelShowRequestAt = 0;
let lastPushToTalkToggleAt = 0;
let browserExecutionTts = null;
let windowManager = null;
let trayController = null;
let panelReady = false;
let panelOpenIpcRegistered = false;

function ensureWindowManager() {
  if (windowManager) {
    return windowManager;
  }

  windowManager = createWindowManager({
    BrowserWindow,
    screen,
    path,
    fs,
    nativeImage,
    appLogger,
    preloadPath: getPreloadPath(),
    rendererDir: getRendererDir(),
    constants: {
      PANEL_WIDTH,
      PANEL_HEIGHT,
      WIDGET_WIDTH,
      WIDGET_COLLAPSED_HEIGHT,
    },
    getRefs: () => ({
      panelWindow,
      settingsWindow,
      cursorOverlayWindow,
      widgetWindow,
      isPanelVisible,
    }),
    setRefs: (patch) => {
      if (Object.prototype.hasOwnProperty.call(patch, "panelWindow")) panelWindow = patch.panelWindow;
      if (Object.prototype.hasOwnProperty.call(patch, "settingsWindow")) settingsWindow = patch.settingsWindow;
      if (Object.prototype.hasOwnProperty.call(patch, "cursorOverlayWindow")) cursorOverlayWindow = patch.cursorOverlayWindow;
      if (Object.prototype.hasOwnProperty.call(patch, "widgetWindow")) widgetWindow = patch.widgetWindow;
    },
    callbacks: {
      showPanel: () => openOpenGuiderPanel({ source: "panel-crash-recovery" }),
      recreatePanelWindow: () => createPanelWindow(),
      onPanelReady: () => {
        panelReady = true;
      },
      onPanelHide: () => {
        isPanelVisible = false;
      },
      broadcastSessionSnapshot: () => {
        if (sessionManager) {
          broadcastSessionSnapshot(sessionManager.getSnapshot());
        }
      },
    },
  });
  return windowManager;
}

function getVirtualDisplayBounds() {
  return ensureWindowManager().getVirtualDisplayBounds();
}

function resizeCursorOverlayToVirtualBounds() {
  ensureWindowManager().resizeCursorOverlayToVirtualBounds();
}

function createPanelWindow() {
  panelReady = false;
  isPanelVisible = false;
  ensureWindowManager().createPanelWindow();
  applyPanelBounds();
}

function createSettingsWindow() {
  ensureWindowManager().createSettingsWindow();
}

function createCursorOverlay() {
  ensureWindowManager().createCursorOverlay();
}

function ensureCursorOverlay() {
  return ensureWindowManager().ensureCursorOverlay();
}

function createWidgetWindow() {
  ensureWindowManager().createWidgetWindow();
}

function ensureWidgetWindow() {
  return ensureWindowManager().ensureWidgetWindow();
}

function resizeWidgetPreservingPosition(nextHeight) {
  ensureWindowManager().resizeWidgetPreservingPosition(nextHeight);
}

function createTray() {
  if (!trayController) {
    trayController = createTrayMenu({
      Tray,
      Menu,
      buildTrayIcon: () => ensureWindowManager().buildTrayIcon(),
      callbacks: {
        showPanel: () => openOpenGuiderPanel({ source: "tray" }),
        hidePanel: () => hidePanel(),
        isPanelVisible: () => isPanelVisible,
        createSettingsWindow: () => createSettingsWindow(),
        quitApp: () => app.quit(),
      },
    });
  }
  tray = trayController.createTray();
}

const BROWSER_PLUGIN_RELEVANT_SETTINGS = new Set([
  "aiProvider",
  "aiModel",
  "claudeApiKey",
  "claudeModelCustom",
  "openaiApiKey",
  "openaiModelCustom",
  "geminiApiKey",
  "geminiModelCustom",
  "groqApiKey",
  "groqModelCustom",
  "openrouterApiKey",
  "openrouterModelCustom",
  "ollamaModelCustom",
  "browserAgentEnabled",
  "browserHeadless",
]);

function debugLog(...args) {
  const [message, ...rest] = args;
  appLogger.debug(String(message || ""), { data: rest });
}

function recordPerformanceMetric(name, startedAt, { ok = true, meta = {} } = {}) {
  const durationMs = Date.now() - startedAt;
  perfMetrics.recordDuration(name, durationMs, { ok, meta });
}

function buildPointerCalibration(screenshots = []) {
  const displays = screen.getAllDisplays();
  const byScreenNumber = {};
  const byDisplayId = {};

  (screenshots || []).forEach((shot, index) => {
    const requestedDisplayId = String(shot?.displayId || "").trim();
    let matchedDisplay = null;
    if (requestedDisplayId) {
      matchedDisplay = displays.find((display) => String(display.id) === requestedDisplayId) || null;
    }
    if (!matchedDisplay && Number(shot?.screenNumber) > 0) {
      matchedDisplay = displays[Number(shot.screenNumber) - 1] || null;
    }
    if (!matchedDisplay) {
      matchedDisplay = displays[index] || displays[0] || null;
    }
    if (!matchedDisplay) {
      return;
    }

    const sourceWidth = Math.max(1, Number(shot?.width) || matchedDisplay.bounds.width);
    const sourceHeight = Math.max(1, Number(shot?.height) || matchedDisplay.bounds.height);
    const calibration = {
      sourceWidth,
      sourceHeight,
      scaleX: matchedDisplay.bounds.width / sourceWidth,
      scaleY: matchedDisplay.bounds.height / sourceHeight,
      displayId: String(matchedDisplay.id),
      screenNumber: Number(shot?.screenNumber) || index + 1,
    };
    byScreenNumber[calibration.screenNumber] = calibration;
    byDisplayId[calibration.displayId] = calibration;
  });

  return {
    byScreenNumber,
    byDisplayId,
    updatedAt: new Date().toISOString(),
  };
}

function updatePointerCalibration(screenshots = []) {
  pointerCalibration = buildPointerCalibration(screenshots);
}

function wrapUserFacingError(error) {
  return new Error(formatStructuredUserError(error));
}

function classifyErrorForUI(error) {
  const message = String(error?.message || "");
  if (/api key|authentication|unauthorized|forbidden|401|403/i.test(message)) {
    return {
      code: "auth_error",
      action: "open-settings",
      actionLabel: "Open settings",
    };
  }
  if (/rate limit|429|quota/i.test(message)) {
    return {
      code: "rate_limit",
      action: "retry",
      actionLabel: "Try again",
    };
  }
  if (/credits|402|insufficient/i.test(message)) {
    return {
      code: "credits",
      action: "open-settings",
      actionLabel: "Open settings",
    };
  }
  return {
    code: "unknown_error",
    action: "open-settings",
    actionLabel: "Open settings",
  };
}

function toUiErrorPayload(error, requestContext) {
  const base = classifyErrorForUI(error);
  return {
    ...base,
    message: error?.message || "Unexpected error",
    requestId: requestContext?.requestId || null,
  };
}

function applyPlatformSettingsGuards(settings) {
  const capabilities = getPlatformCapabilities(process.platform);
  const normalized = normalizeSettingsForPlatform(settings, capabilities);
  return {
    capabilities,
    normalizedSettings: normalized.settings,
    warnings: normalized.warnings,
  };
}

async function persistFinOpsSettings(patch = {}) {
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === null) {
      store.delete(key);
    } else {
      store.set(key, value);
    }
  }
}

function getFinOpsAlertWindows() {
  return [panelWindow, settingsWindow].filter((window) => window && !window.isDestroyed());
}

async function getRuntimeSettings() {
  if (!secureStore) {
    return mergeUserMemoryIntoSettings(applyPlatformSettingsGuards(store?.store || {}).normalizedSettings);
  }
  const hydrated = await secureStore.fillSecrets(store.store);
  return mergeUserMemoryIntoSettings(applyPlatformSettingsGuards(hydrated).normalizedSettings);
}

function mergeUserMemoryIntoSettings(settings = {}) {
  const facts = Array.isArray(settings.userMemoryFacts)
    ? settings.userMemoryFacts.map((entry) => String(entry || "").trim()).filter(Boolean)
    : [];
  if (facts.length === 0) {
    return settings;
  }
  const memoryBlock = `\n\nKullanıcı hafızası:\n${facts.map((entry) => `- ${entry}`).join("\n")}`;
  const basePrompt = String(settings.systemPromptOverride || "").trim();
  return {
    ...settings,
    systemPromptOverride: `${basePrompt}${memoryBlock}`.trim(),
  };
}

async function maybeAutoBackupChatSessions(trigger = "manual") {
  if (!store || store.get("chatBackupEnabled") !== true) {
    return null;
  }
  const folderPath = String(store.get("chatBackupPath") || "").trim();
  if (!folderPath) {
    return null;
  }
  try {
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    const payload = exportAllSessionsJson(store);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filePath = path.join(folderPath, `sauron-chats-${trigger}-${stamp}.json`);
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
    appLogger.info("chat-backup-created", { trigger, filePath });
    return filePath;
  } catch (error) {
    appLogger.warn("chat-backup-failed", { trigger, error: error?.message || error });
    return null;
  }
}

function shouldRefreshBrowserPlugin(changedSettings = {}) {
  return Object.keys(changedSettings || {}).some((key) => BROWSER_PLUGIN_RELEVANT_SETTINGS.has(key));
}

function emitBrowserAgentStatus(status) {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send("browser-agent-status-changed", status);
  }
  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.webContents.send("browser-agent-status-changed", status);
  }
}

function createBrowserPluginCrashHandler() {
  return (err) => {
    appLogger.error("browser-plugin-crashed", { error: err?.message });
    emitBrowserAgentStatus(`crashed: ${err?.message}`);
  };
}

function resolveChildProcessAssetPath(...segments) {
  const directPath = path.join(__dirname, ...segments);
  const asarSegment = `${path.sep}app.asar${path.sep}`;
  if (!directPath.includes(asarSegment)) {
    return directPath;
  }

  const unpackedPath = directPath.replace(asarSegment, `${path.sep}app.asar.unpacked${path.sep}`);
  return fs.existsSync(unpackedPath) ? unpackedPath : directPath;
}

function getBrowserRuntimeInstallDir() {
  return path.join(app.getPath("userData"), "python-runtime");
}

async function buildBrowserPluginConfig(runtimeSettings) {
  const llmConfig = await prepareBrowserPluginLlmConfig(runtimeSettings);
  if (llmConfig.warning) {
    appLogger.warn("browser-plugin-llm-model-adjusted", {
      provider: llmConfig.llmProvider,
      requestedModel: llmConfig.requestedModel,
      warning: llmConfig.warning,
    });
  }
  return {
    headless: store.get("browserHeadless") === true,
    llmProvider: llmConfig.llmProvider,
    llmApiKey: llmConfig.llmApiKey,
    llmModel: llmConfig.llmModel,
    onCrash: createBrowserPluginCrashHandler(),
  };
}

async function syncBrowserPluginWithRuntimeSettings(runtimeSettings, { forceRestart = false } = {}) {
  let plugin;
  try {
    plugin = registry.getPlugin("browser");
  } catch (_error) {
    return { ok: false, skipped: true, error: "browser plugin is not registered" };
  }

  const browserEnabled = store.get("browserAgentEnabled") !== false;
  if (!browserEnabled) {
    try {
      await plugin.shutdown();
    } catch (err) {
      appLogger.warn("browser-plugin-shutdown-error", { error: err?.message });
    }
    emitBrowserAgentStatus("stopped");
    return { ok: true, enabled: false };
  }

  if (forceRestart) {
    try {
      await plugin.shutdown();
    } catch (err) {
      appLogger.warn("browser-plugin-restart-shutdown-error", { error: err?.message });
    }
  }

  await plugin.initialize(await buildBrowserPluginConfig(runtimeSettings));
  const status = plugin._sidecar?.isRunning ? "running" : "stopped";
  emitBrowserAgentStatus(status);
  return { ok: true, enabled: true, status };
}

function registerCrashTracking() {
  process.on("uncaughtException", (error) => {
    appLogger.error("uncaught-exception", { error });
  });
  process.on("unhandledRejection", (reason) => {
    appLogger.error("unhandled-rejection", {
      error: reason instanceof Error ? reason : new Error(String(reason)),
    });
  });
}

function getApprovalWindow() {
  return panelWindow && !panelWindow.isDestroyed() ? panelWindow : null;
}

function updateWidgetState(state) {
  debugLog("widget:state", state);
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.webContents.send("state-change", state);
  }
}

function broadcastAgentState(state) {
  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.webContents.send("agent-state-changed", state);
  }
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.webContents.send("agent-state-changed", state);
  }
}

function broadcastSessionSnapshot(snapshot) {
  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.webContents.send("session-updated", snapshot);
    panelWindow.webContents.send("plan-updated", snapshot.activePlan);
    panelWindow.webContents.send("agent-state-changed", snapshot.status);
  }

  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.webContents.send("session-updated", snapshot);
    widgetWindow.webContents.send("plan-updated", snapshot.activePlan);
    widgetWindow.webContents.send("agent-state-changed", snapshot.status);
  }

  const widgetState = mapSessionStatusToWidgetState(snapshot.status);
  updateWidgetState(widgetState);
}

function broadcastBrowserExecutionSubstepProgress(progress) {
  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.webContents.send("execution:substep-progress", progress);
  }

  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.webContents.send("execution:substep-progress", progress);
  }
}

function mapSessionStatusToWidgetState(status) {
  switch (status) {
    case "planning":
    case "executing":
    case "evaluating":
      return "thinking";
    case "waiting_user":
      return "idle";
    default:
      return status || "idle";
  }
}

function hideCursorOverlay() {
  if (cursorOverlayWindow && !cursorOverlayWindow.isDestroyed()) {
    cursorOverlayWindow.hide();
  }

  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.webContents.send("pointer-updated", null);
  }

  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.webContents.send("pointer-updated", null);
  }
}

function showPointer(pointer) {
  const payload = emitPointerTool({
    pointer,
    screen,
    cursorOverlayWindow,
    pointerCalibration,
  });

  if (!payload) {
    hideCursorOverlay();
    return null;
  }

  debugLog("pointer:show", {
    hasCoordinate: Boolean(pointer?.coordinate),
    isPanelVisible,
    label: pointer?.label || null,
  });

  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.webContents.send("pointer-updated", payload);
  }

  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.webContents.send("pointer-updated", payload);
  }

  return payload;
}

// ── Panel position (top-right by default, persistent if moved) ───────────────
function isValidSavedPanelCoord(value) {
  return Number.isFinite(value) && value > -1;
}

function getPanelPosition() {
  const displays = screen.getAllDisplays();
  const primaryWorkArea = screen.getPrimaryDisplay().workArea;
  const defaultX = primaryWorkArea.x + primaryWorkArea.width - PANEL_WIDTH - PANEL_WINDOW_MARGIN;
  const defaultY = primaryWorkArea.y + PANEL_WINDOW_MARGIN;

  const rawX = store?.get("panelWindowX");
  const rawY = store?.get("panelWindowY");

  if (!isValidSavedPanelCoord(Number(rawX)) || !isValidSavedPanelCoord(Number(rawY))) {
    return { x: defaultX, y: defaultY };
  }

  const savedX = Number(rawX);
  const savedY = Number(rawY);

  // Find which display the saved position belongs to (handles multi-monitor setups)
  const targetDisplay =
    displays.find(
      (d) =>
        savedX >= d.workArea.x &&
        savedX < d.workArea.x + d.workArea.width &&
        savedY >= d.workArea.y &&
        savedY < d.workArea.y + d.workArea.height,
    ) || screen.getPrimaryDisplay();

  const wa = targetDisplay.workArea;
  const maxX = wa.x + wa.width - PANEL_WIDTH - PANEL_WINDOW_MARGIN;
  const maxY = wa.y + wa.height - PANEL_HEIGHT - PANEL_WINDOW_MARGIN;
  const clampedX = Math.max(wa.x + PANEL_WINDOW_MARGIN, Math.min(savedX, maxX));
  const clampedY = Math.max(wa.y + PANEL_WINDOW_MARGIN, Math.min(savedY, maxY));
  return { x: clampedX, y: clampedY };
}

function applyPanelBounds(panel = panelWindow) {
  if (!panel || panel.isDestroyed()) {
    return null;
  }
  const { x, y } = getPanelPosition();
  panel.setBounds({
    x,
    y,
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
  });
  return { x, y };
}

function notifyPanelOpened(panel = panelWindow) {
  if (!panel || panel.isDestroyed()) {
    return;
  }
  panel.webContents.send("panel-opened");
}

function revealPanelImmediate(panel, x, y) {
  if (!panel || panel.isDestroyed()) {
    return false;
  }

  hideCursorOverlay();

  if (panelOpenAnimationTimer) {
    clearInterval(panelOpenAnimationTimer);
    panelOpenAnimationTimer = null;
  }

  panel.setBounds({
    x,
    y,
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
  });
  panel.setOpacity(1);
  panel.show();
  raisePanelAboveOverlay(panel);
  panel.focus();
  notifyPanelOpened(panel);
  const bounds = panel.getBounds();
  appLogger.info("open-openguider:revealed", {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    visible: panel.isVisible(),
    opacity: panel.getOpacity(),
  });
  if (process.env.SAURON_TERMINAL === "1") {
    console.log(
      `[Sauron][terminal] Panel konumu: x=${bounds.x} y=${bounds.y} ` +
      `(${bounds.width}x${bounds.height}) visible=${panel.isVisible()}`,
    );
  }
  return true;
}

function animatePanelIn(targetX, targetY) {
  if (!panelWindow || panelWindow.isDestroyed()) {
    return;
  }

  if (panelOpenAnimationTimer) {
    clearInterval(panelOpenAnimationTimer);
    panelOpenAnimationTimer = null;
  }

  const startY = targetY - 10;
  const steps = 8;
  let step = 0;
  panelWindow.setPosition(targetX, startY);
  panelWindow.setOpacity(0);
  panelWindow.show();

  panelOpenAnimationTimer = setInterval(() => {
    if (!panelWindow || panelWindow.isDestroyed()) {
      clearInterval(panelOpenAnimationTimer);
      panelOpenAnimationTimer = null;
      return;
    }
    step += 1;
    const progress = Math.min(1, step / steps);
    const eased = 1 - (1 - progress) * (1 - progress);
    const nextY = Math.round(startY + (targetY - startY) * eased);
    panelWindow.setPosition(targetX, nextY);
    panelWindow.setOpacity(progress);

    if (progress >= 1) {
      clearInterval(panelOpenAnimationTimer);
      panelOpenAnimationTimer = null;
      panelWindow.setPosition(targetX, targetY);
      panelWindow.setOpacity(1);
      notifyPanelOpened(panelWindow);
    }
  }, 16);
}

function ensurePanelWindow() {
  if (!panelWindow || panelWindow.isDestroyed()) {
    createPanelWindow();
  }
  return panelWindow && !panelWindow.isDestroyed() ? panelWindow : null;
}

function waitForPanelReady(timeoutMs = 5000) {
  if (panelReady && panelWindow && !panelWindow.isDestroyed()) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const poll = () => {
      if (panelReady && panelWindow && !panelWindow.isDestroyed()) {
        resolve(true);
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        resolve(false);
        return;
      }
      setTimeout(poll, 25);
    };
    poll();
  });
}

function registerPanelOpenIpc() {
  if (panelOpenIpcRegistered) {
    return;
  }
  panelOpenIpcRegistered = true;

  ipcMain.on("widget-open-openguider", () => {
    appLogger.info("widget-open-openguider:request", { source: "widget-send" });
    openOpenGuiderPanel({ source: "widget-send" });
  });

  ipcMain.handle("open-openguider", async (_event, meta) => {
    const source = meta?.source || "widget-invoke";
    appLogger.info("widget-open-openguider:request", { source, via: "invoke" });
    return openOpenGuiderPanel({ source });
  });
  ipcMain.handle("show-main", async (_event, meta) => {
    return openOpenGuiderPanel({ source: meta?.source || "show-main-fallback" });
  });
}

async function openOpenGuiderPanel({ source = "unknown" } = {}) {
  appLogger.info("open-openguider:request", { source });
  ensurePanelWindow();
  const ready = await waitForPanelReady();
  if (!ready) {
    appLogger.warn("open-openguider:panel-not-ready");
  }
  const shown = showPanel({ force: true, immediate: true });
  if (shown) {
    appLogger.info("open-openguider:shown", { source });
  } else {
    appLogger.warn("open-openguider:failed", { source });
  }
  return shown;
}

function showPanel({ force = false, immediate = false } = {}) {
  debugLog("window:panel show", { force, immediate });
  const now = Date.now();
  if (!force && now - lastPanelShowRequestAt < 180) {
    return false;
  }
  lastPanelShowRequestAt = now;

  const panel = ensurePanelWindow();
  if (!panel) {
    appLogger.warn("show-panel-failed", { reason: "panel-unavailable" });
    return false;
  }

  const { x, y } = applyPanelBounds(panel) || getPanelPosition();

  // Widget/tray/recovery paths use force — always re-reveal so the panel is on-screen and clickable.
  if (force || immediate) {
    isPanelVisible = true;
    return revealPanelImmediate(panel, x, y);
  }

  if (panel.isVisible() && panel.getOpacity() > 0.05) {
    hideCursorOverlay();
    isPanelVisible = true;
    raisePanelAboveOverlay(panel);
    panel.focus();
    notifyPanelOpened(panel);
    return true;
  }

  isPanelVisible = true;

  animatePanelIn(x, y);
  panel.focus();
  return true;
}
function hidePanel() {
  debugLog("window:panel hide");
  if (panelOpenAnimationTimer) {
    clearInterval(panelOpenAnimationTimer);
    panelOpenAnimationTimer = null;
  }
  if (store && panelWindow && !panelWindow.isDestroyed()) {
    const [x, y] = panelWindow.getPosition();
    store.set("panelWindowX", x);
    store.set("panelWindowY", y);
  }
  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.hide();
    resetPanelAlwaysOnTop(panelWindow);
  }
  isPanelVisible = false;
  showWidgetOnStartup();
}

function showPanelOnStartup() {
  debugLog("window:panel startup-show");
  void openOpenGuiderPanel({ source: "startup" });
}

function showWidgetOnStartup() {
  debugLog("window:widget show");
  const widget = ensureWidgetWindow();
  if (widget && !widget.isDestroyed()) {
    widget.show();
  }
}

function getDefaultSender() {
  if (panelWindow && !panelWindow.isDestroyed()) {
    return panelWindow.webContents;
  }
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    return widgetWindow.webContents;
  }
  return null;
}

function canRunPlanShortcutAction() {
  const snapshot = sessionManager?.getSnapshot?.();
  const currentStep = snapshot?.activePlan?.steps?.[snapshot?.activePlan?.currentStepIndex];
  return Boolean(currentStep) && snapshot?.status === "waiting_user";
}

async function runPlanShortcutAction(actionName) {
  if (!canRunPlanShortcutAction()) {
    debugLog("hotkey:plan-action skipped", actionName, "inactive");
    return;
  }

  if (isPlanShortcutInFlight) {
    debugLog("hotkey:plan-action skipped", actionName, "busy");
    return;
  }

  isPlanShortcutInFlight = true;
  const sender = getDefaultSender();
  if (!sender) {
    isPlanShortcutInFlight = false;
    return;
  }

  if (currentAIController) {
    currentAIController.abort();
  }
  currentAIController = new AbortController();

  try {
    let result = null;
    if (actionName === "mark-step-done") {
      result = await taskOrchestrator.markStepDone({
        settings: store.store,
        signal: currentAIController.signal,
      });
    } else if (actionName === "request-step-help") {
      result = await taskOrchestrator.requestStepHelp({
        settings: store.store,
        signal: currentAIController.signal,
      });
    } else if (actionName === "recheck-current-step") {
      result = await taskOrchestrator.recheckCurrentStep({
        settings: store.store,
        signal: currentAIController.signal,
      });
    } else if (actionName === "previous-step") {
      result = await taskOrchestrator.previousStep({
        settings: store.store,
        signal: currentAIController.signal,
      });
    } else if (actionName === "skip-current-step") {
      result = await taskOrchestrator.skipCurrentStep({
        settings: store.store,
        signal: currentAIController.signal,
      });
    } else if (actionName === "regenerate-current-step") {
      result = await taskOrchestrator.regenerateCurrentStep({
        settings: store.store,
        signal: currentAIController.signal,
      });
    } else if (actionName === "cancel-active-plan") {
      result = taskOrchestrator.cancelActivePlan();
    }

    if (result) {
      await handleOrchestratorResult(result, store.store, sender);
    }
  } catch (err) {
    if (err?.name !== "AbortError") {
      debugLog("hotkey:plan-action error", actionName, err?.message || err);
      appLogger.error("global-shortcut-action failed", { actionName, error: err });
    }
  } finally {
    currentAIController = null;
    isPlanShortcutInFlight = false;
  }
}

function registerShortcut(accelerator, onPress, label) {
  const shortcut = (accelerator || "").trim();
  if (!shortcut) {
    debugLog("hotkey:skip empty", label);
    return;
  }
  const ok = globalShortcut.register(shortcut, onPress);
  if (!ok) {
    debugLog("hotkey:register failed", label, shortcut);
    return;
  }
  debugLog("hotkey:registered", label, shortcut);
}

// ── Global hotkey ─────────────────────────────────────────────────────────────
function registerHotkeys() {
  globalShortcut.unregisterAll();
  isPushToTalkRecording = false;

  const pushToTalkShortcut = store.get("pushToTalkShortcut") || "Ctrl+Shift+Space";
  const markStepDoneShortcut = store.get("markStepDoneShortcut") || "Ctrl+Alt+1";
  const requestStepHelpShortcut = store.get("requestStepHelpShortcut") || "Ctrl+Alt+2";
  const recheckCurrentStepShortcut = store.get("recheckCurrentStepShortcut") || "Ctrl+Alt+3";
  const cancelActivePlanShortcut = store.get("cancelActivePlanShortcut") || "Ctrl+Alt+4";
  const previousStepShortcut = store.get("previousStepShortcut") || "Ctrl+Alt+5";
  const skipCurrentStepShortcut = store.get("skipCurrentStepShortcut") || "Ctrl+Alt+6";
  const regenerateCurrentStepShortcut = store.get("regenerateCurrentStepShortcut") || "Ctrl+Alt+7";

  registerShortcut(pushToTalkShortcut, () => {
    const now = Date.now();
    // Prevent accidental double toggles from key repeat.
    if (now - lastPushToTalkToggleAt < 300) {
      return;
    }
    lastPushToTalkToggleAt = now;
    debugLog("hotkey:push-to-talk", pushToTalkShortcut, isPushToTalkRecording ? "stop" : "start");
    if (!panelWindow || panelWindow.isDestroyed()) {
      isPushToTalkRecording = false;
      return;
    }
    if (!isPushToTalkRecording) {
      isPushToTalkRecording = true;
      panelWindow.webContents.send("push-to-talk-start");
      updateWidgetState("listening");
    } else {
      isPushToTalkRecording = false;
      panelWindow.webContents.send("push-to-talk-stop");
      updateWidgetState("idle");
    }
  }, "pushToTalk");

  registerShortcut(markStepDoneShortcut, () => {
    void runPlanShortcutAction("mark-step-done");
  }, "markStepDone");
  registerShortcut(requestStepHelpShortcut, () => {
    void runPlanShortcutAction("request-step-help");
  }, "requestStepHelp");
  registerShortcut(recheckCurrentStepShortcut, () => {
    void runPlanShortcutAction("recheck-current-step");
  }, "recheckCurrentStep");
  registerShortcut(previousStepShortcut, () => {
    void runPlanShortcutAction("previous-step");
  }, "previousStep");
  registerShortcut(skipCurrentStepShortcut, () => {
    void runPlanShortcutAction("skip-current-step");
  }, "skipCurrentStep");
  registerShortcut(regenerateCurrentStepShortcut, () => {
    void runPlanShortcutAction("regenerate-current-step");
  }, "regenerateCurrentStep");
  registerShortcut(cancelActivePlanShortcut, () => {
    void runPlanShortcutAction("cancel-active-plan");
  }, "cancelActivePlan");
}

function resolvePreferredTtsTargetSender(sender) {
  if (panelWindow && !panelWindow.isDestroyed()) {
    return panelWindow.webContents;
  }
  if (sender && typeof sender.isDestroyed === "function" && !sender.isDestroyed()) {
    return sender;
  }
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    return widgetWindow.webContents;
  }
  return null;
}

async function ensureRuntimePermissions() {
  const payload = {
    platform: process.platform,
    microphone: "not_required",
    screen: "not_required",
    screenNeedsSettings: false,
  };

  if (process.platform !== "darwin") {
    return payload;
  }

  const microphoneStatus = systemPreferences.getMediaAccessStatus("microphone");
  if (microphoneStatus === "granted") {
    payload.microphone = "granted";
  } else {
    const granted = await systemPreferences.askForMediaAccess("microphone");
    payload.microphone = granted ? "granted" : "denied";
  }

  const screenStatus = systemPreferences.getMediaAccessStatus("screen");
  payload.screen = screenStatus || "unknown";
  payload.screenNeedsSettings = ["denied", "restricted"].includes(payload.screen);

  return payload;
}

async function openPermissionSettings(scope) {
  if (process.platform !== "darwin") {
    return false;
  }
  const normalizedScope = String(scope || "").trim().toLowerCase();
  if (normalizedScope === "microphone") {
    return shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone");
  }
  if (normalizedScope === "screen") {
    return shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture");
  }
  return false;
}

function sanitizeTextForTts(input) {
  let text = String(input || "");
  if (!text) {
    return "";
  }

  // Remove code blocks, inline code, markdown emphasis markers and links.
  text = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/[*_~>#]+/g, " ");

  // Remove most emoji / pictographic symbols.
  text = text
    .replace(/\p{Extended_Pictographic}/gu, " ")
    .replace(/[\uFE0F\u200D]/g, " ");

  // Remove repeated punctuation and clean spacing.
  text = text
    .replace(/[^\p{L}\p{N}\p{P}\p{Z}\n]/gu, " ")
    .replace(/([!?.,])\1+/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  return text;
}

async function speakAssistantResponse(text, settings, sender, { shouldAbort } = {}) {
  const safeText = sanitizeTextForTts(text);
  if (!settings.ttsEnabled || !safeText) {
    return;
  }
  if (typeof shouldAbort === "function" && shouldAbort()) {
    return;
  }

  const { provider: effectiveTtsProvider, warning } = resolveEffectiveTtsProvider(
    settings.ttsProvider,
    getPlatformCapabilities(process.platform),
  );
  if (warning) {
    appLogger.warn("tts provider fallback", {
      requestedProvider: settings.ttsProvider,
      effectiveProvider: effectiveTtsProvider,
      warning,
    });
  }

  const ttsTargetSender = resolvePreferredTtsTargetSender(sender);
  if (!ttsTargetSender || (typeof ttsTargetSender.isDestroyed === "function" && ttsTargetSender.isDestroyed())) {
    return;
  }
  debugLog("tts:start", effectiveTtsProvider);
  if (effectiveTtsProvider === "elevenlabs") {
    updateWidgetState("speaking");
    if (typeof shouldAbort === "function" && shouldAbort()) {
      return;
    }
    await speakWithElevenLabs(safeText, settings, ttsTargetSender, { shouldAbort });
  } else if (effectiveTtsProvider === "openai") {
    const openaiTTS = require("./src/tts/openai-tts");
    try {
      const base64Audio = await openaiTTS.speakText(safeText, settings);
      if (
        base64Audio
        && !(typeof shouldAbort === "function" && shouldAbort())
        && !ttsTargetSender.isDestroyed()
      ) {
        updateWidgetState("speaking");
        ttsTargetSender.send("tts-start", base64Audio);
      }
    } catch (err) {
      appLogger.error("openai-tts failed", { error: err });
    }
  } else if (effectiveTtsProvider === "google") {
    const googleTTS = require("./src/tts/google-tts");
    try {
      const chunksBase64 = await googleTTS.speakText(safeText, settings);
      if (
        chunksBase64.length > 0
        && !(typeof shouldAbort === "function" && shouldAbort())
        && !ttsTargetSender.isDestroyed()
      ) {
        updateWidgetState("speaking");
        ttsTargetSender.send("tts-google", chunksBase64);
      }
    } catch (err) {
      appLogger.error("google-tts failed", { error: err });
    }
  }

  if (
    !(typeof shouldAbort === "function" && shouldAbort())
    && !ttsTargetSender.isDestroyed()
  ) {
    ttsTargetSender.send("tts-done");
  }
  debugLog("tts:done", effectiveTtsProvider);
}

async function handleOrchestratorResult(result, settings, sender) {
  if (result?.pointer?.shouldPoint && result.pointer.coordinate) {
    const persistent = result?.session?.status === "waiting_user";
    showPointer({ ...result.pointer, persistent });
  } else {
    hideCursorOverlay();
  }

  // In planning flow, speak only the current actionable step once when pointer appears.
  if (result?.pointer?.shouldPoint && result?.assistantMessage) {
    const ttsText = result?.userInputRequest?.message || result.assistantMessage;
    try {
      await speakAssistantResponse(ttsText, settings, sender);
    } catch (err) {
      appLogger.error("orchestrator:tts-failed", { error: err });
    }
  }

  return result;
}

function registerModularIpcHandlers() {
  const currentAIControllerRef = {
    get current() { return currentAIController; },
    set current(value) { currentAIController = value; },
  };

  registerFinOpsIpc({
    ipcMain,
    debugLog,
    getRuntimeSettings,
    getUsageSummary,
    getUsageTimeSeries,
    sessionManager,
    syncClineUsageFromDisk,
    emitBudgetAlert,
    getFinOpsAlertWindows,
    persistFinOpsSettings: persistFinOpsSettings,
  });

  registerChatSessionsIpc({
    ipcMain,
    dialog,
    store,
    sessionManager,
    taskOrchestrator,
    hideCursorOverlay,
    debugLog,
    broadcastSessionSnapshot,
    persistActiveSession,
    panelWindow,
    createChatFolder,
    createEphemeralChatSession,
    createMemoryChatSession,
    createNewChatSession,
    deleteChatFolder,
    deleteChatSession,
    duplicateChatSession,
    exportAllSessionsJson,
    formatChatExportMarkdown,
    getChatSessionById,
    importChatSessionsFromJson,
    listChatFolders,
    listChatSessionSummaries,
    loadChatSession,
    moveChatSession,
    renameChatFolder,
    renameChatSession,
    sanitizeExportFilename,
    toggleChatSessionPin,
  });

  registerAiIpc({
    ipcMain,
    ASSISTANT_CHAT_PROMPT,
    MAX_AI_CONTEXT_MESSAGES,
    MAX_STORED_MESSAGES,
    appLogger,
    createRequestContext,
    currentAIControllerRef,
    debugLog,
    fetchOllamaModels,
    getRuntimeSettings,
    handleOrchestratorResult,
    parsePointTag,
    persistActiveSession,
    recordPerformanceMetric,
    sessionManager,
    speakAssistantResponse,
    store,
    streamAIResponse,
    taskOrchestrator,
    toUiErrorPayload,
    updatePointerCalibration,
    updateWidgetState,
    broadcastAgentState,
    broadcastSessionSnapshot,
    showPointer,
    wrapUserFacingError,
    getActiveChatSessionRecord,
  });

  registerWorkspaceIpc({
    ipcMain,
    dialog,
    shell,
    store,
    sessionManager,
    panelWindow,
    settingsWindow,
    debugLog,
    appLogger,
    getRuntimeSettings,
    persistActiveSession,
    getActiveChatSessionTitle,
    checkWorkspacePrerequisites,
    installWorkspaceStack,
    getHandoffStatus,
    focusVSCodeWorkspace,
    listPendingHandoffs,
    listHandoffHistory,
    rejectHandoffFile,
    rejectPendingHandoffs,
    buildHandoffPayload,
    enrichHandoffPayloadFinOps,
    bootstrapWorkspace,
    writeHandoff,
    launchVSCode,
    runSauronDoctor,
    writeCredentialRequest,
    getCredentialSyncStatus,
    emitBudgetAlert,
    getFinOpsAlertWindows,
  });

  registerWebStudioIpc({
    ipcMain,
    shell,
    store,
    debugLog,
  });

  registerMicroGuideIpc({
    ipcMain,
    appLogger,
    createRequestContext,
    currentAIControllerRef,
    debugLog,
    getRuntimeSettings,
    handleOrchestratorResult,
    recordPerformanceMetric,
    sessionManager,
    taskOrchestrator,
    updatePointerCalibration,
    broadcastSessionSnapshot,
    wrapUserFacingError,
  });

  registerBuildPipelineIpc({
    ipcMain,
    store,
    debugLog,
    appLogger,
    getRuntimeSettings,
    panelWindow,
  });

  registerBrowserIpc({
    ipcMain,
    debugLog,
    appLogger,
    getRuntimeSettings,
    syncBrowserPluginWithRuntimeSettings,
    registry,
    resolveChildProcessAssetPath,
    getBrowserRuntimeInstallDir,
    process,
  });
}

// ── IPC handlers ──────────────────────────────────────────────────────────────
function setupIPC() {
  // ── Settings ─────────────────────────────────────────────────────────────
  ipcMain.handle("get-settings", async () => {
    debugLog("ipc:get-settings");
    const nextSettings = await secureStore.fillSecrets(store.store);
    const guarded = applyPlatformSettingsGuards(nextSettings);
    return guarded.normalizedSettings;
  });
  ipcMain.handle("save-settings", async (_e, newSettings) => {
    debugLog("ipc:save-settings", Object.keys(newSettings || {}));
    const incomingSettings = newSettings || {};
    const guardedInput = applyPlatformSettingsGuards(incomingSettings);
    Object.assign(
      guardedInput.normalizedSettings,
      syncAgentMatrixFromSettings(guardedInput.normalizedSettings || {}),
    );
    if (guardedInput.warnings.length > 0) {
      appLogger.warn("save-settings platform normalization", {
        warnings: guardedInput.warnings,
      });
    }
    await secureStore.saveSecretsFromSettings(guardedInput.normalizedSettings);
    for (const [k, v] of Object.entries(guardedInput.normalizedSettings || {})) {
      if (SECRET_KEYS.includes(k)) {
        store.delete(k);
        continue;
      }
      // electron-store throws if you try to set() undefined — use delete() instead
      if (v === undefined || v === null) {
        store.delete(k);
      } else {
        store.set(k, v);
      }
    }
    const hydratedSettings = await secureStore.fillSecrets(store.store);
    const guardedHydrated = applyPlatformSettingsGuards(hydratedSettings);
    const settingsToBroadcast = guardedHydrated.normalizedSettings;
    setConfiguredVscodePath(settingsToBroadcast.vscodePath);
    if (taskOrchestrator && typeof taskOrchestrator.setAwareAssistanceEnabled === "function") {
      taskOrchestrator.setAwareAssistanceEnabled(settingsToBroadcast.awareAssistanceEnabled === true);
    }
    if (panelWindow && !panelWindow.isDestroyed()) {
      panelWindow.webContents.send("settings-changed", settingsToBroadcast);
    }
    if (widgetWindow && !widgetWindow.isDestroyed()) {
      widgetWindow.webContents.send("settings-changed", settingsToBroadcast);
    }
    if (shouldRefreshBrowserPlugin(incomingSettings)) {
      try {
        await syncBrowserPluginWithRuntimeSettings(settingsToBroadcast, { forceRestart: true });
      } catch (err) {
        appLogger.error("browser-plugin-refresh-failed", { error: err?.message });
        emitBrowserAgentStatus(`crashed: ${err?.message}`);
      }
    }
    registerHotkeys();
    try {
      await syncFinOpsConfigToWorkspace(settingsToBroadcast);
    } catch (err) {
      appLogger.warn("finops-config-sync-failed", { error: err?.message || err });
    }
    try {
      await writeCredentialRequest(settingsToBroadcast.workspacePath, null, {
        settings: settingsToBroadcast,
      });
    } catch (err) {
      appLogger.warn("cline-credential-request-failed", { error: err?.message || err });
    }
    return {
      ok: true,
      warnings: guardedInput.warnings,
    };
  });
  ipcMain.handle("reset-settings", async () => {
    debugLog("ipc:reset-settings");
    if (currentAIController) {
      currentAIController.abort();
      currentAIController = null;
    }
    hideCursorOverlay();
    taskOrchestrator.resetSession();
    store.clear();
    clearSessionSnapshot(store);
    await secureStore.clearAllSecrets();
    const hydratedSettings = await secureStore.fillSecrets(store.store);
    const guardedHydrated = applyPlatformSettingsGuards(hydratedSettings);
    const settingsToBroadcast = guardedHydrated.normalizedSettings;
    if (taskOrchestrator && typeof taskOrchestrator.setAwareAssistanceEnabled === "function") {
      taskOrchestrator.setAwareAssistanceEnabled(settingsToBroadcast.awareAssistanceEnabled === true);
    }
    if (panelWindow && !panelWindow.isDestroyed()) {
      panelWindow.webContents.send("settings-changed", settingsToBroadcast);
    }
    if (widgetWindow && !widgetWindow.isDestroyed()) {
      widgetWindow.webContents.send("settings-changed", settingsToBroadcast);
    }
    registerHotkeys();
    return settingsToBroadcast;
  });

  ipcMain.handle("get-platform-capabilities", () => {
    return getPlatformCapabilities(process.platform);
  });

  ipcMain.handle("ensure-runtime-permissions", async () => {
    return ensureRuntimePermissions();
  });

  ipcMain.handle("open-permission-settings", async (_event, scope) => {
    return openPermissionSettings(scope);
  });

  ipcMain.handle("get-performance-metrics", () => {
    return perfMetrics.getSnapshot();
  });

  ipcMain.handle("reset-performance-metrics", () => {
    perfMetrics.reset();
    return { ok: true };
  });

  // ── Screenshot ───────────────────────────────────────────────────────────
  ipcMain.handle("capture-screenshot", async (_event, options = {}) => {
    const startedAt = Date.now();
    const forceFresh = Boolean(options?.forceFresh);
    debugLog("ipc:capture-screenshot", { forceFresh });
    try {
      const result = await captureAllScreens({ includeTimings: true, forceFresh, maxAgeMs: forceFresh ? 0 : 900 });
      recordPerformanceMetric("ipc.capture-screenshot", startedAt, {
        ok: true,
        meta: {
          imageCount: result.images.length,
          fromCache: Boolean(result.timings?.fromCache),
          totalDurationMs: result.timings?.totalDurationMs || 0,
          getSourcesDurationMs: result.timings?.getSourcesDurationMs || 0,
          encodeDurationMs: result.timings?.encodeDurationMs || 0,
        },
      });
      updatePointerCalibration(result.images);
      return result.images;
    } catch (err) {
      recordPerformanceMetric("ipc.capture-screenshot", startedAt, {
        ok: false,
        meta: { errorName: err?.name || "Error" },
      });
      appLogger.error("capture-screenshot failed", { error: err });
      return [];
    }
  });

  registerModularIpcHandlers();

  ipcMain.handle("open-settings",  () => {
    debugLog("ipc:open-settings");
    return createSettingsWindow();
  });
  ipcMain.handle("close-settings", () => {
    debugLog("ipc:close-settings");
    if (settingsWindow) settingsWindow.close();
  });
  ipcMain.handle("minimize-panel", () => {
    debugLog("ipc:minimize-panel");
    hidePanel();
  });
  ipcMain.handle("quit-app",       () => {
    debugLog("ipc:quit-app");
    app.quit();
  });

  // ── Widget ───────────────────────────────────────────────────────────────
  ipcMain.handle("hide-widget",    () => {
    debugLog("ipc:hide-widget");
    if (widgetWindow) widgetWindow.hide();
  });
  ipcMain.handle("set-widget-expanded", (_e, isExpanded) => {
    const expanded = Boolean(isExpanded);
    debugLog("ipc:set-widget-expanded", expanded);
    if (!widgetWindow || widgetWindow.isDestroyed()) {
      return false;
    }

    const nextHeight = expanded ? WIDGET_EXPANDED_HEIGHT : WIDGET_COLLAPSED_HEIGHT;
    resizeWidgetPreservingPosition(nextHeight);
    return true;
  });
  ipcMain.handle("set-widget-height", (_e, requestedHeight) => {
    const numericHeight = Number(requestedHeight);
    if (!widgetWindow || widgetWindow.isDestroyed() || !Number.isFinite(numericHeight)) {
      return false;
    }

    // Use the display the widget is currently on for accurate height clamping
    const [wx, wy] = widgetWindow.getPosition();
    const { workArea: widgetWorkArea } = screen.getDisplayNearestPoint({ x: wx, y: wy });
    const maxHeight = Math.max(WIDGET_COLLAPSED_HEIGHT, widgetWorkArea.height - 40);
    const nextHeight = Math.max(
      WIDGET_COLLAPSED_HEIGHT,
      Math.min(Math.round(numericHeight), maxHeight),
    );
    resizeWidgetPreservingPosition(nextHeight);
    return true;
  });
  ipcMain.on("widget-loaded",      () => {
    debugLog("ipc:widget-loaded");
    if (widgetWindow) widgetWindow.webContents.send("widget-ready");
  });
  ipcMain.on("update-widget-state", (_e, state) => {
    debugLog("ipc:update-widget-state", state);
    if (state === "listening") {
      isPushToTalkRecording = true;
    } else if (state === "idle") {
      isPushToTalkRecording = false;
    }
    if (state === "speaking") {
      broadcastAgentState("responding");
    } else if (state === "idle" && !isPushToTalkRecording) {
      const snapshotStatus = sessionManager?.getSnapshot?.().status || "idle";
      broadcastAgentState(snapshotStatus);
    }
    updateWidgetState(state);
  });

  ipcMain.on("stop-tts", (event, options) => {
    debugLog("ipc:stop-tts");
    if (!event.sender.isDestroyed()) event.sender.send("tts-webspeech-stop", options || {});
  });

  ipcMain.on("show-cursor-at", (_e, data) => {
    debugLog("ipc:show-cursor-at", data?.label || "element");
    const overlay = ensureCursorOverlay();
    if (overlay && !overlay.isDestroyed()) {
      overlay.setIgnoreMouseEvents(true, { forward: true });
      overlay.setAlwaysOnTop(true, "screen-saver", 1);
      overlay.show();
      overlay.webContents.send("show-cursor-at", data);
    }
  });
  ipcMain.on("hide-cursor", () => {
    debugLog("ipc:hide-cursor");
    hideCursorOverlay();
  });
}

// ── ElevenLabs TTS (direct API key) ──────────────────────────────────────────
async function speakWithElevenLabs(text, settings, sender, { shouldAbort } = {}) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${settings.elevenlabsVoiceId}`;
  const headers = {
    "Content-Type": "application/json",
    accept: "audio/mpeg",
    "xi-api-key": settings.elevenlabsApiKey,
  };

  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ text, model_id: "eleven_flash_v2_5" }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`ElevenLabs error ${resp.status}: ${errText}`);
  }

  const arrayBuffer = await resp.arrayBuffer();
  if (typeof shouldAbort === "function" && shouldAbort()) {
    return;
  }
  const base64Audio = Buffer.from(arrayBuffer).toString("base64");
  updateWidgetState("speaking");
  if (!sender.isDestroyed()) sender.send("tts-start", base64Audio);

  // Wait for renderer to signal tts-done — handled via IPC from renderer
  await new Promise(resolve => setTimeout(resolve, 500));
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  app.setName("Sauron");
  initializeLogger({
    app,
    level: process.env.OPENGUIDER_LOG_LEVEL
      || (process.env.SAURON_TERMINAL === "1" ? "debug" : "info"),
  });
  appLogger = createLogger("main");
  registerCrashTracking();
  debugLog("app:ready start");
  store = createStore();
  setConfiguredVscodePath(store.get("vscodePath"));
  secureStore = new SecureStore({ safeStorage, serviceName: "Sauron" });
  configureFinOpsContext({
    getSettings: () => store.store,
    getWindows: getFinOpsAlertWindows,
    persistSettings: persistFinOpsSettings,
  });
  startClineUsagePoller(() => store?.store || {});
  sessionManager = new SessionManager();
  const persistedSession = loadSessionSnapshot(store);
  const chatState = loadChatSessionsState(store);

  if (chatState?.activeSessionId && chatState.sessions?.[chatState.activeSessionId]) {
    sessionManager.hydrateSession(chatState.sessions[chatState.activeSessionId].snapshot);
  } else if (persistedSession) {
    migrateLegacySessionSnapshot(store, sessionManager, persistedSession);
  } else {
    ensureChatSessionsState(store);
    const freshState = loadChatSessionsState(store);
    const active = freshState?.sessions?.[freshState.activeSessionId];
    if (active?.snapshot) {
      sessionManager.hydrateSession(active.snapshot);
    }
  }

  appLogger.info("restored-chat-sessions", {
    sessionCount: listChatSessionSummaries(store).length,
    messageCount: sessionManager.getSnapshot()?.messages?.length || 0,
  });
  taskOrchestrator = new TaskOrchestrator({
    captureAllScreens,
    sessionManager,
    prePostLayersEnabled: store.get("awareAssistanceEnabled") === true,
    getApprovalWindow,
  });
  browserExecutionTts = createBrowserExecutionTtsController({
    getSettings: getRuntimeSettings,
    speak: speakAssistantResponse,
    getSender: () => resolvePreferredTtsTargetSender(null),
    logger: (message, data) => appLogger.warn(message, data),
  });
  createTray();
  createPanelWindow();
  registerPanelOpenIpc();
  setupIPC();
  createWidgetWindow();
  showWidgetOnStartup();

  // ── Register & initialize plugins [NEW] ───────────────────────────
  try {
    registry.register(new BrowserPlugin());
    const runtimeSettings = await getRuntimeSettings();
    const browserEnabled = store.get('browserAgentEnabled') !== false;
    if (browserEnabled) {
      buildBrowserPluginConfig(runtimeSettings).then((config) => registry.initializeAll(config)).then(() => {
        const status = registry.getStatus('browser') === 'ok' ? 'running' : 'stopped';
        emitBrowserAgentStatus(status);
      }).catch((err) => {
        appLogger.error('plugin-init-failed', { error: err?.message });
        emitBrowserAgentStatus(`crashed: ${err?.message}`);
      });
    } else {
      emitBrowserAgentStatus("stopped");
    }
  } catch (err) {
    appLogger.error('plugin-registration-failed', { error: err?.message });
  }
  sessionManager.on("updated", (snapshot) => {
    saveSessionSnapshot(store, snapshot);
    persistActiveSession(store, snapshot);
    if (Array.isArray(snapshot?.lastScreenshots) && snapshot.lastScreenshots.length > 0) {
      updatePointerCalibration(snapshot.lastScreenshots);
    }
    if (!snapshot?.browserExecution || TERMINAL_BROWSER_EXECUTION_STATUSES.has(snapshot.browserExecution.status)) {
      browserExecutionTts?.invalidate();
    }
    broadcastSessionSnapshot(snapshot);
  });
  sessionManager.on("browser-execution-substep-progress", (progress) => {
    broadcastBrowserExecutionSubstepProgress(progress);
    void browserExecutionTts?.handleSubstepProgress(progress);
  });
  broadcastSessionSnapshot(sessionManager.getSnapshot());
  registerHotkeys();
  void maybeAutoBackupChatSessions("startup");
  appLogger.info("app:boot-complete", {
    root: getRendererDir(),
    version: require("./package.json").version,
    pid: process.pid,
    terminal: process.env.SAURON_TERMINAL === "1",
  });
  if (process.env.SAURON_TERMINAL === "1") {
    console.log("[Sauron][terminal] Boot tamam — widget + panel açılıyor. Hatalar bu terminalde görünür.");
  }
  showPanelOnStartup();
  app.on("activate", () => {
    debugLog("app:activate");
    showWidgetOnStartup();
    showPanelOnStartup();
  });
  debugLog("app:ready complete");
});

app.on("second-instance", () => {
  console.log("[Sauron] second-instance: mevcut örnek paneli açıyor");
  openOpenGuiderPanel({ source: "second-instance" });
});

// ── Graceful shutdown with plugin cleanup [NEW] ──────────────────────
app.on("before-quit", (e) => {
  // Prevent quit, run async cleanup, then re-quit
  if (app._pluginsShutdown) return; // second time through — really quit
  e.preventDefault();
  app._pluginsShutdown = true;

  const shutdownTimeout = setTimeout(() => {
    appLogger.warn('plugin-shutdown-forced');
    app.quit();
  }, 5000);

  registry.shutdownAll()
    .catch((err) => appLogger.error('shutdown-error', { error: err?.message }))
    .then(() => maybeAutoBackupChatSessions("shutdown"))
    .finally(() => {
      clearTimeout(shutdownTimeout);
      app.quit();
    });
});

app.on("will-quit", () => {
  debugLog("app:will-quit");
  stopClineUsagePoller();
  globalShortcut.unregisterAll();
});
app.on("window-all-closed", (e) => e.preventDefault()); // keep running in tray
