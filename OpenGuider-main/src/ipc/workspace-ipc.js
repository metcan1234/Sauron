const fs = require("fs");
const channelRuntime = require("../sauron/channel-runtime");
const { focusOrLaunchChannelVSCode, SAURON_CHANNEL_VSCODE_OPTIONS } = require("../sauron/channel-vscode-launch");
const { getBlockersForChannel, checkVisionModelSupport } = require("../sauron/doctor");
const {
  markHandoffLaunchVerified,
  recordVerifiedLaunch,
  getLastResolvedVscodePathInfo,
  setVsCodeLaunchLogger,
} = require("../sauron/vscode-launcher");

function buildVSCodeFocusErrorMessage(launchResult) {
  const reason = String(launchResult?.verificationReason || "");
  if (reason === "process_only") {
    return "VS Code arka planda çalışıyor ama pencere görünmüyor.";
  }
  if (reason.startsWith("launch_") && launchResult?.launchProfile && launchResult.launchProfile !== "default") {
    return `VS Code ${launchResult.launchProfile} profiliyle de açılamadı. Görev Yöneticisi'nde Code.exe süreçlerini kapatıp tekrar deneyin.`;
  }
  if (launchResult?.action === "launch_after_recovery" || launchResult?.action?.includes("launch_")) {
    return "VS Code kurtarma sonrası da açılamadı. Görev Yöneticisi'nde Code.exe var mı kontrol edin.";
  }
  return "VS Code başlatılamadı. Görev Yöneticisi'nde Code.exe var mı kontrol edin.";
}

function registerWorkspaceIpc({
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
  rejectPendingHandoffs,
  listHandoffHistory,
  rejectHandoffFile,
  buildHandoffPayload,
  prepareHandoffPayloadAsync,
  enrichHandoffPayloadFinOps,
  bootstrapWorkspace,
  writeHandoff,
  launchVSCode,
  runSauronDoctor,
  streamAIResponse,
  writeCredentialRequest,
  getCredentialSyncStatus,
  emitBudgetAlert,
  getFinOpsAlertWindows,
}) {
  setVsCodeLaunchLogger((detail) => {
    appLogger.info("vscode-launch-command", detail);
  });

  ipcMain.handle("pick-workspace-folder", async () => {
    debugLog("ipc:pick-workspace-folder");
    const parentWindow = panelWindow && !panelWindow.isDestroyed()
      ? panelWindow
      : (settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : null);
    const result = await dialog.showOpenDialog(parentWindow, {
      properties: ["openDirectory"],
      title: "Select Workspace Folder",
    });
    if (result.canceled || !result.filePaths?.[0]) {
      return { ok: false, canceled: true };
    }
    const selectedPath = result.filePaths[0];
    store.set("workspacePath", selectedPath);
    return { ok: true, path: selectedPath };
  });

  ipcMain.handle("install-workspace-stack", async (_event, options = {}) => {
    debugLog("ipc:install-workspace-stack", options);
    try {
      const result = installWorkspaceStack({ force: Boolean(options?.force) });
      const prerequisites = checkWorkspacePrerequisites();
      return { ...result, prerequisites };
    } catch (error) {
      return {
        ok: false,
        error: error?.message || "Workspace stack installation failed.",
      };
    }
  });

  ipcMain.handle("check-workspace-prerequisites", () => {
    debugLog("ipc:check-workspace-prerequisites");
    try {
      return { ok: true, ...checkWorkspacePrerequisites() };
    } catch (error) {
      return {
        ok: false,
        error: error?.message || "Workspace prerequisite check failed.",
      };
    }
  });

  ipcMain.handle("run-sauron-doctor", async () => {
    debugLog("ipc:run-sauron-doctor");
    try {
      const runtimeSettings = await getRuntimeSettings();
      return { ok: true, ...runSauronDoctor(store, { settings: runtimeSettings }) };
    } catch (error) {
      return {
        ok: false,
        error: error?.message || "Sauron doctor failed.",
        checks: [],
      };
    }
  });

  ipcMain.handle("get-cline-capability-report", () => {
    debugLog("ipc:get-cline-capability-report");
    try {
      const { getClineCapabilityReport } = require("../sauron/doctor");
      return getClineCapabilityReport(store);
    } catch (error) {
      return {
        ok: false,
        error: error?.message || "Cline capability report failed.",
      };
    }
  });

  ipcMain.handle("list-handoff-history", (_event, options = {}) => {
    const resolvedPath = String(options?.workspacePath || store.get("workspacePath") || "").trim();
    if (!resolvedPath) {
      return { ok: false, error: "Workspace path is not configured.", items: [] };
    }
    try {
      const items = listHandoffHistory(resolvedPath, { limit: options?.limit });
      return { ok: true, workspacePath: resolvedPath, items };
    } catch (error) {
      return {
        ok: false,
        error: error?.message || "Failed to list handoff history.",
        items: [],
      };
    }
  });

  ipcMain.handle("reject-handoff-file", (_event, options = {}) => {
    const resolvedPath = String(options?.workspacePath || store.get("workspacePath") || "").trim();
    const handoffFileName = String(options?.handoffFileName || "").trim();
    if (!resolvedPath || !handoffFileName) {
      return { ok: false, error: "Missing workspace path or handoff file name." };
    }
    try {
      const result = rejectHandoffFile(resolvedPath, handoffFileName);
      return { ok: true, workspacePath: resolvedPath, ...result };
    } catch (error) {
      return {
        ok: false,
        error: error?.message || "Failed to reject handoff file.",
      };
    }
  });

  ipcMain.handle("get-handoff-status", (_event, { workspacePath, handoffFileName } = {}) => {
    const resolvedPath = String(workspacePath || store.get("workspacePath") || "").trim();
    if (!resolvedPath || !handoffFileName) {
      return { ok: false, error: "Missing workspace path or handoff file name." };
    }
    return {
      ok: true,
      workspacePath: resolvedPath,
      ...getHandoffStatus(resolvedPath, handoffFileName),
    };
  });

  ipcMain.handle("focus-workspace-vscode", async () => {
    debugLog("ipc:focus-workspace-vscode");
    try {
      const workspacePath = String(store.get("workspacePath") || "").trim();
      if (!workspacePath || !fs.existsSync(workspacePath)) {
        return { ok: false, error: "Çalışma klasörü ayarlanmamış veya bulunamıyor." };
      }
      const launchResult = await focusOrLaunchChannelVSCode(workspacePath, "workspace");
      const resolvedLaunch = launchResult?.launchResult || launchResult;
      debugLog("ipc:focus-workspace-vscode result", {
        workspacePath,
        skipped: Boolean(resolvedLaunch?.skipped),
        executable: resolvedLaunch?.executable,
        executableKind: resolvedLaunch?.executableKind,
        launchMethod: resolvedLaunch?.launchMethod,
        launchProfile: resolvedLaunch?.launchProfile,
        verified: Boolean(resolvedLaunch?.verified),
        verificationReason: resolvedLaunch?.verificationReason,
        action: resolvedLaunch?.action,
        pid: resolvedLaunch?.pid,
      });
      if (resolvedLaunch?.skipped) {
        return { ok: true, workspacePath, ...resolvedLaunch };
      }
      if (!resolvedLaunch?.verified) {
        return {
          ok: false,
          error: buildVSCodeFocusErrorMessage(resolvedLaunch),
          workspacePath,
          channel: "workspace",
          channelMarker: launchResult?.channelMarker,
          ...resolvedLaunch,
        };
      }
      return {
        ok: true,
        workspacePath,
        channel: "workspace",
        channelMarker: launchResult?.channelMarker,
        ...resolvedLaunch,
      };
    } catch (error) {
      const message = String(error?.message || "");
      if (/VS Code CLI \(code\) not found/i.test(message)) {
        return {
          ok: false,
          error: "VS Code CLI (code) bulunamadı. VS Code kurun ve \"Shell Command: Install 'code' command in PATH\" komutunu çalıştırın.",
        };
      }
      return { ok: false, error: message || "VS Code odaklanamadı." };
    }
  });

  ipcMain.handle("open-workspace-handoff", async (_event, options = {}) => {
    debugLog("ipc:open-workspace-handoff", options);
    try {
      const force = Boolean(options?.force);
      let workspacePath = String(store.get("workspacePath") || "").trim();

      const pickWorkspaceFolder = async (title) => {
        const parentWindow = panelWindow && !panelWindow.isDestroyed() ? panelWindow : null;
        const pickResult = await dialog.showOpenDialog(parentWindow, {
          properties: ["openDirectory"],
          title: title || "Select Workspace Folder for Çalışma Kısmı",
        });
        if (pickResult.canceled || !pickResult.filePaths?.[0]) {
          return null;
        }
        const picked = pickResult.filePaths[0];
        store.set("workspacePath", picked);
        return picked;
      };

      if (!workspacePath) {
        workspacePath = await pickWorkspaceFolder("Select Workspace Folder for Çalışma Kısmı");
        if (!workspacePath) {
          return { ok: false, error: "Workspace folder not selected." };
        }
      }

      if (!fs.existsSync(workspacePath)) {
        workspacePath = await pickWorkspaceFolder(
          "Workspace klasörü bulunamadı — yeni bir klasör seçin",
        );
        if (!workspacePath) {
          return {
            ok: false,
            error: "Workspace path does not exist and no replacement folder was selected.",
          };
        }
      }

      let prerequisites = checkWorkspacePrerequisites();

      // Preflight: ⌘ bloker kontrolü
      const blockers = getBlockersForChannel('workspace', store);
      if (blockers.length > 0) {
        return {
          ok: false,
          error: `⌘ Çalışma Kısmı başlatılamadı:\n${blockers.join('\n')}`,
          blockers,
          prerequisites,
        };
      }

      if (!prerequisites.canOpenWorkspace) {
        return {
          ok: false,
          error: "VS Code CLI (code) bulunamadı. Kurulum adımları için uyarıyı kontrol edin.",
          prerequisites,
        };
      }

      if (!prerequisites.bridgeExtension) {
        const installResult = installWorkspaceStack();
        if (!installResult.ok) {
          return {
            ok: false,
            error: installResult.error || "Sauron Bridge kurulamadı.",
            prerequisites: checkWorkspacePrerequisites(),
          };
        }
        prerequisites = checkWorkspacePrerequisites();
      }

      const pending = listPendingHandoffs(workspacePath);
      if (!force && pending.length > 0) {
        return {
          ok: false,
          needsConfirm: true,
          pendingCount: pending.length,
          message: "Önceki görev henüz VS Code tarafında işlenmedi. Yine de devam edilsin mi?",
        };
      }

      if (force && pending.length > 0) {
        rejectPendingHandoffs(workspacePath);
      }

      const snapshot = sessionManager ? sessionManager.getSnapshot() : {};
      persistActiveSession(store, snapshot);
      const runtimeSettings = await getRuntimeSettings();
      const enrichedSnapshot = {
        ...snapshot,
        chatSessionTitle: getActiveChatSessionTitle(store),
      };
      const finopsEnriched = await prepareHandoffPayloadAsync({
        sessionSnapshot: enrichedSnapshot,
        workspacePath,
        settings: runtimeSettings,
        streamAIResponse,
        appLogger,
      });
      const walletAlerts = finopsEnriched.walletAlerts || [];
      if (walletAlerts.length && typeof emitBudgetAlert === "function") {
        for (const alert of walletAlerts) {
          emitBudgetAlert(getFinOpsAlertWindows, alert);
        }
      } else if (finopsEnriched.governorAlert && typeof emitBudgetAlert === "function") {
        emitBudgetAlert(getFinOpsAlertWindows, finopsEnriched.governorAlert);
      }
      await bootstrapWorkspace(workspacePath, runtimeSettings);

      // Vision model compatibility check: if there are screenshots/attachments, warn
      const hasImages = Boolean(
        enrichedSnapshot?.lastScreenshots?.length > 0
        || enrichedSnapshot?.browserExecution?.screenshots?.length > 0
        || enrichedSnapshot?.pendingImages?.length > 0
        || runtimeSettings.includeScreenshotByDefault,
      );
      if (hasImages) {
        const visionCheck = checkVisionModelSupport(runtimeSettings);
        if (!visionCheck.visionCapable && visionCheck.warning) {
          appLogger?.warn?.('vision-model-warning', {
            warning: visionCheck.warning,
            hasImages: true,
          });
          // Store warning in handoff payload for UI display
          finopsEnriched.payload._visionWarning = visionCheck.warning;
        }
      }

      if (writeCredentialRequest) {
        try {
          await writeCredentialRequest(workspacePath, null, { settings: runtimeSettings });
        } catch (credError) {
          appLogger.warn("handoff-credential-request-failed", { error: credError?.message || credError });
        }
      }
      const written = writeHandoff(workspacePath, finopsEnriched.payload, runtimeSettings);
      const vscodeLaunch = await focusOrLaunchChannelVSCode(workspacePath, "workspace", {
        handoffFileName: written.fileName,
      }, {
        ...SAURON_CHANNEL_VSCODE_OPTIONS,
        verifyTimeoutMs: 25000,
      });
      const launchResult = vscodeLaunch?.launchResult || null;
      appLogger.info("vscode-launch-resolve", {
        ...getLastResolvedVscodePathInfo(),
        executable: launchResult?.executable,
        executableKind: launchResult?.executableKind,
      });
      if (launchResult?.verified) {
        markHandoffLaunchVerified();
        recordVerifiedLaunch(launchResult);
      }

      // Register VS Code PID with channel-runtime
      if (launchResult?.pid && typeof launchResult.pid === 'number' && launchResult.pid > 0) {
        channelRuntime.registerProcess('workspace', launchResult.pid, {
          sessionId: written.handoffId,
          workspacePath,
          label: 'VS Code',
          dependencyPath: written.handoffPath,
        });
      } else if (launchResult?.verified) {
        // Verified but no PID — try to find one
        const { getVSCodeProcessState } = require("../sauron/vscode-window-focus");
        getVSCodeProcessState().then((state) => {
          if (state?.pid && typeof state.pid === 'number' && state.pid > 0) {
            channelRuntime.registerProcess('workspace', state.pid, {
              sessionId: written.handoffId,
              workspacePath,
              label: 'VS Code (fallback)',
              dependencyPath: written.handoffPath,
            });
          }
        }).catch(() => {});
      }

      const visionWarning = finopsEnriched?.payload?._visionWarning;
      return {
        ok: true,
        workspacePath,
        channel: "workspace",
        channelMarker: vscodeLaunch?.channelMarker,
        handoffPath: written.handoffPath,
        handoffId: written.handoffId,
        handoffFileName: written.fileName,
        launchResult,
        prerequisites,
        setupWarnings: [
          ...(prerequisites.warnings || []),
          ...(visionWarning ? [visionWarning] : []),
        ],
      };
    } catch (error) {
      appLogger.error("open-workspace-handoff failed", { error: error?.message || error });
      return {
        ok: false,
        error: error?.message || "Failed to open workspace.",
      };
    }
  });

  ipcMain.handle("get-cline-sync-status", async () => {
    try {
      const runtimeSettings = await getRuntimeSettings();
      const workspacePath = String(store.get("workspacePath") || "").trim();
      return {
        ok: true,
        ...getCredentialSyncStatus(runtimeSettings, workspacePath),
      };
    } catch (error) {
      return {
        ok: false,
        error: error?.message || "Failed to read Cline sync status.",
      };
    }
  });

  ipcMain.handle("sync-cline-credentials", async () => {
    try {
      const runtimeSettings = await getRuntimeSettings();
      const workspacePath = String(store.get("workspacePath") || "").trim();
      if (!workspacePath) {
        return { ok: false, error: "Workspace path is not configured." };
      }
      const result = writeCredentialRequest(workspacePath, null, { settings: runtimeSettings });
      return result;
    } catch (error) {
      return {
        ok: false,
        error: error?.message || "Failed to queue Cline credential sync.",
      };
    }
  });

  ipcMain.handle("open-external-link", async (_event, url) => {
    const target = String(url || "").trim();
    if (!/^https?:\/\//i.test(target)) {
      throw new Error("Invalid URL");
    }
    await shell.openExternal(target);
    return true;
  });

  ipcMain.handle("get-cline-activity-feed", async (_event, options = {}) => {
    try {
      const { getClineActivityFeed } = require("../sauron/cline-activity/cline-activity-feed");
      const workspacePath = String(
        options.workspacePath || store.get("workspacePath") || "",
      ).trim();
      if (!workspacePath) {
        return { ok: false, error: "Workspace path is not configured.", events: [] };
      }
      const runtimeSettings = await getRuntimeSettings();
      if (runtimeSettings.clineActivityFeedEnabled === false) {
        return { ok: true, disabled: true, events: [] };
      }
      return getClineActivityFeed(workspacePath, options);
    } catch (error) {
      return {
        ok: false,
        error: error?.message || "Failed to read Cline activity feed.",
        events: [],
      };
    }
  });

  ipcMain.handle("get-workspace-hub-status", async (_event, options = {}) => {
    try {
      const { getWorkspaceHubStatus } = require("../sauron/workspace-hub-status");
      const workspacePath = String(
        options.workspacePath || store.get("workspacePath") || "",
      ).trim();
      if (!workspacePath) {
        return { ok: false, error: "Workspace path is not configured." };
      }
      const runtimeSettings = await getRuntimeSettings();
      if (runtimeSettings.workspaceHubEnabled === false) {
        return { ok: true, disabled: true, shouldShow: false };
      }
      return getWorkspaceHubStatus(workspacePath, options);
    } catch (error) {
      return {
        ok: false,
        error: error?.message || "Failed to read workspace hub status.",
      };
    }
  });

  ipcMain.handle("get-mission-control-status", async (_event, options = {}) => {
    try {
      const { getMissionControlStatus } = require("../sauron/mission-control-status");
      const workspacePath = String(
        options.workspacePath || store.get("workspacePath") || "",
      ).trim();
      if (!workspacePath) {
        return { ok: false, error: "Workspace path is not configured." };
      }
      const runtimeSettings = await getRuntimeSettings();
      if (runtimeSettings.missionControlEnabled === false) {
        return { ok: true, disabled: true, shouldShow: false, channels: {} };
      }
      return getMissionControlStatus(workspacePath, {
        ...options,
        settings: runtimeSettings,
      });
    } catch (error) {
      return {
        ok: false,
        error: error?.message || "Failed to read mission control status.",
      };
    }
  });

  ipcMain.handle("get-git-commit-hint", async (_event, options = {}) => {
    try {
      const { getGitCommitHint } = require("../sauron/git-commit-hint");
      const workspacePath = String(
        options.workspacePath || store.get("workspacePath") || "",
      ).trim();
      if (!workspacePath) {
        return { ok: false, error: "Workspace path is not configured." };
      }
      return await getGitCommitHint(workspacePath);
    } catch (error) {
      return {
        ok: false,
        error: error?.message || "Failed to build git commit hint.",
      };
    }
  });
}

module.exports = { registerWorkspaceIpc };
