const POLL_INTERVAL_MS = 5000;

export function isMissionControlEnabled(settings = {}) {
  return settings.missionControlEnabled !== false;
}

export function createMissionControlController({ api, ui, getSettings }) {
  let pollTimer = null;
  let lastGitHintKey = "";

  async function refreshOnce() {
    const settings = typeof getSettings === "function" ? getSettings() : {};
    if (!isMissionControlEnabled(settings)) {
      ui.renderMissionControl(null);
      return null;
    }

    const workspacePath = String(settings.workspacePath || "").trim();
    if (!workspacePath) {
      return null;
    }

    try {
      const status = await api.invoke("get-mission-control-status", { workspacePath });
      if (!status?.ok || status.disabled) {
        ui.renderMissionControl(null);
        return null;
      }
      ui.renderMissionControl(status);
      return status;
    } catch {
      return null;
    }
  }

  async function maybeShowGitCommitHint() {
    const settings = typeof getSettings === "function" ? getSettings() : {};
    const workspacePath = String(settings.workspacePath || "").trim();
    if (!workspacePath) {
      return;
    }

    try {
      const hint = await api.invoke("get-git-commit-hint", { workspacePath });
      if (!hint?.ok || !hint.hasChanges || !hint.suggestion?.headline) {
        return;
      }
      const key = `${hint.changedCount}:${hint.suggestion.headline}`;
      if (key === lastGitHintKey) {
        return;
      }
      lastGitHintKey = key;
      ui.showGitCommitHint(hint);
    } catch {
      // best-effort
    }
  }

  function start() {
    if (pollTimer) {
      return;
    }
    void refreshOnce();
    pollTimer = setInterval(() => {
      void refreshOnce();
    }, POLL_INTERVAL_MS);
  }

  function stop() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  return {
    start,
    stop,
    refreshOnce,
    maybeShowGitCommitHint,
  };
}
