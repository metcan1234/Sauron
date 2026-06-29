import { t } from "../i18n/index.js";

export function isWorkspaceHubEnabled(settings = {}) {
  return settings.workspaceHubEnabled !== false;
}

export async function refreshWorkspaceHub({ api, ui, settings, onFocus, skipWhenGamedevActive = false }) {
  if (skipWhenGamedevActive) {
    return null;
  }
  try {
    const gamedevStatus = await api.invoke("get-gamedev-status").catch(() => null);
    if (gamedevStatus?.modeActive === true || gamedevStatus?.launchInProgress === true) {
      return null;
    }
  } catch {
    // continue with hub refresh
  }
  if (!isWorkspaceHubEnabled(settings)) {
    return null;
  }
  try {
    const hub = await api.invoke("get-workspace-hub-status");
    if (!hub?.ok || hub.disabled) {
      return null;
    }
    if (!hub.shouldShow && !hub.summaryLine) {
      return hub;
    }
    ui.showWorkspaceStatus({
      title: "⌘ Çalışma Kısmı · Cline",
      message: hub.summaryLine || "",
      tone: hub.tone || "default",
      channel: "workspace",
      onFocus: typeof onFocus === "function" ? onFocus : null,
      owner: "workspace",
    });
    return hub;
  } catch {
    return null;
  }
}

export async function maybeOfferPreviewAfterClineComplete({
  api,
  ui,
  hub,
  webStudio,
  offeredRef,
}) {
  if (!hub?.clineTaskComplete || offeredRef?.current) {
    return;
  }
  offeredRef.current = true;
  const confirmed = await ui.confirmDialog({
    title: t("clineTaskCompleteTitle"),
    message: t("clineTaskCompleteMessage"),
    confirmLabel: t("webPreview"),
    cancelLabel: t("cancel"),
    confirmDanger: false,
  });
  if (confirmed && webStudio?.openPreview) {
    await webStudio.openPreview();
  }
}
