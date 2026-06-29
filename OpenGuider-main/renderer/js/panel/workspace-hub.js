import { t } from "../i18n/index.js";

export function isWorkspaceHubEnabled(settings = {}) {
  return settings.workspaceHubEnabled !== false;
}

export async function refreshWorkspaceHub({ api, ui, settings, onFocus }) {
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
      title: hub.projectLabel || t("workspace"),
      message: hub.summaryLine || "",
      tone: hub.tone || "default",
      onFocus: typeof onFocus === "function" ? onFocus : null,
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
