const fs = require("fs");
const { hasHandoffTaskContext } = require("../sauron/handoff-task-clarify");
const channelRuntime = require("../sauron/channel-runtime");
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
  handleRuntimeIncident,
}) {
  setVsCodeLaunchLogger((detail) => {
    appLogger.info("vscode-launch-command", detail);
  });

  async function emitWorkspaceIncident(errorMessage, operation, extra = {}) {
    if (typeof handleRuntimeIncident !== "function" || !errorMessage) {
      return null;
    }
    const workspacePath = String(store.get("workspacePath") || "").trim();
    try {
      return await handleRuntimeIncident(
        { message: errorMessage, code: extra.errorCode || "" },
        {
          component: "workspace",
          operation,
          workspacePath,
          ...extra,
        },
      );
    } catch (incidentError) {
      appLogger?.warn?.("workspace-incident-hook-failed", {
        error: incidentError?.message || incidentError,
      });
      return null;
    }
  }

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
      const result = await installWorkspaceStack({ force: Boolean(options?.force) });
      const prerequisites = checkWorkspacePrerequisites();
      return { ...result, prerequisites };
    } catch (error) {
      return {
        ok: false,
        error: error?.message || "Workspace stack installation failed.",
      };
    }
  });

  ipcMain.handle("check-workspace-prerequisites", (_event, options = {}) => {
    debugLog("ipc:check-workspace-prerequisites", options);
    try {
      return { ok: true, ...checkWorkspacePrerequisites(options) };
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
      const runtimeSettings = await getRuntimeSettings({ includePersona: false });
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
      const focused = await focusVSCodeWorkspace(workspacePath, {
        allowLaunch: false,
        verifyTimeoutMs: 4000,
        skipPostVerifySettle: true,
      });
      const launchResult = focused?.verified
        ? focused
        : await launchVSCode(workspacePath, {
          newWindow: false,
          skipRecovery: true,
          skipInterProfileRecovery: true,
          launchProfiles: [{ profile: "default", extraArgs: [] }],
          requireWindowVerification: false,
          skipVerification: true,
        });
      debugLog("ipc:focus-workspace-vscode result", {
        workspacePath,
        skipped: Boolean(launchResult?.skipped),
        executable: launchResult?.executable,
        executableKind: launchResult?.executableKind,
        launchMethod: launchResult?.launchMethod,
        launchProfile: launchResult?.launchProfile,
        verified: Boolean(launchResult?.verified),
        verificationReason: launchResult?.verificationReason,
        action: launchResult?.action,
        pid: launchResult?.pid,
      });
      if (launchResult?.skipped) {
        return { ok: true, workspacePath, ...launchResult };
      }
      if (!launchResult?.verified) {
        return {
          ok: false,
          error: buildVSCodeFocusErrorMessage(launchResult),
          workspacePath,
          ...launchResult,
        };
      }
      return { ok: true, workspacePath, ...launchResult };
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
        const error = `⌘ Çalışma Kısmı başlatılamadı:\n${blockers.join('\n')}`;
        await emitWorkspaceIncident(error, "open-workspace-handoff", { errorCode: "CHANNEL_BLOCKER" });
        return {
          ok: false,
          error,
          blockers,
          prerequisites,
        };
      }

      if (!prerequisites.canOpenWorkspace) {
        const error = "VS Code CLI (code) bulunamadı. Kurulum adımları için uyarıyı kontrol edin.";
        await emitWorkspaceIncident(error, "open-workspace-handoff", { errorCode: "VSCODE_CLI_MISSING" });
        return {
          ok: false,
          error,
          prerequisites,
        };
      }

      if (!prerequisites.bridgeExtension) {
        const installResult = await installWorkspaceStack();
        if (!installResult.ok) {
          const error = installResult.error || "Sauron Bridge kurulamadı.";
          await emitWorkspaceIncident(error, "open-workspace-handoff", { errorCode: "BRIDGE_MISSING" });
          return {
            ok: false,
            error,
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

      const draftTaskText = String(options?.draftTaskText || "").trim();
      const snapshot = sessionManager ? sessionManager.getSnapshot() : {};
      if (!hasHandoffTaskContext(snapshot, draftTaskText)) {
        return {
          ok: false,
          needsTask: true,
          error: "Önce görevi yaz, sonra ⌘ ile VS Code'a aktar.",
        };
      }

      persistActiveSession(store, snapshot);
      const runtimeSettings = await getRuntimeSettings({ includePersona: false });
      let enrichedSnapshot = {
        ...snapshot,
        chatSessionTitle: getActiveChatSessionTitle(store),
      };
      if (draftTaskText) {
        enrichedSnapshot = {
          ...enrichedSnapshot,
          goalIntent: enrichedSnapshot.goalIntent || draftTaskText,
          messages: [
            ...(Array.isArray(enrichedSnapshot.messages) ? enrichedSnapshot.messages : []),
            { role: "user", content: draftTaskText },
          ],
        };
      }
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
      const written = writeHandoff(workspacePath, finopsEnriched.payload);
      const focused = await focusVSCodeWorkspace(workspacePath, {
        allowLaunch: false,
        verifyTimeoutMs: 4000,
        skipPostVerifySettle: true,
      });
      const launchResult = focused?.verified
        ? focused
        : await launchVSCode(workspacePath, {
          newWindow: false,
          skipRecovery: true,
          skipInterProfileRecovery: true,
          launchProfiles: [{ profile: "default", extraArgs: [] }],
          requireWindowVerification: false,
          skipVerification: true,
        });
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
      const message = error?.message || "Failed to open workspace.";
      await emitWorkspaceIncident(message, "open-workspace-handoff");
      return {
        ok: false,
        error: message,
      };
    }
  });

  ipcMain.handle("get-cline-sync-status", async () => {
    try {
      const runtimeSettings = await getRuntimeSettings({ includePersona: false });
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
      const runtimeSettings = await getRuntimeSettings({ includePersona: false });
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
}

module.exports = { registerWorkspaceIpc };
