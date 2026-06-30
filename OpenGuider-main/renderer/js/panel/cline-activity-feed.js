import { t } from "../i18n/index.js";

const POLL_INTERVAL_MS = 4000;

export function isClineActivityFeedEnabled(settings = {}) {
  return settings.clineActivityFeedEnabled !== false;
}

export function createClineActivityFeedController({ api, ui, getSettings, onTaskComplete = null }) {
  let pollTimer = null;
  let lastEventId = "";
  let emittedState = {
    plans: {},
    reports: {},
    questions: {},
    activities: {},
  };
  const renderedEventIds = new Set();

  function renderEvent(event) {
    if (!event?.id || renderedEventIds.has(event.id)) {
      return;
    }
    renderedEventIds.add(event.id);
    if (event.kind === "report") {
      ui.appendClineFeedMessage({
        kind: "report",
        title: event.title || t("clineFeedReport"),
        body: event.body || "",
        eventId: event.id,
        scopeKey: event.scopeKey || event.handoffId || "",
      });
      if (typeof onTaskComplete === "function") {
        void onTaskComplete();
      }
      return;
    }
    if (event.kind === "question") {
      ui.appendClineFeedMessage({
        kind: "question",
        title: event.title || t("clineFeedQuestion"),
        body: event.body || "",
        eventId: event.id,
        scopeKey: event.scopeKey || event.handoffId || "",
      });
      return;
    }
    ui.appendClineFeedMessage({
      kind: event.kind,
      title: event.title || "",
      body: event.body || "",
      eventId: event.id,
      scopeKey: event.scopeKey || event.handoffId || "",
    });
  }

  async function pollOnce() {
    const settings = typeof getSettings === "function" ? getSettings() : {};
    if (!isClineActivityFeedEnabled(settings)) {
      return;
    }

    const workspacePath = String(settings.workspacePath || "").trim();
    if (!workspacePath) {
      return;
    }

    try {
      const result = await api.invoke("get-cline-activity-feed", {
        workspacePath,
        afterId: lastEventId,
        limit: 20,
        state: emittedState,
      });

      if (!result?.ok || result.disabled) {
        return;
      }

      if (result.emitted) {
        emittedState = result.emitted;
      }

      const events = Array.isArray(result.events) ? result.events : [];
      for (const event of events) {
        renderEvent(event);
        lastEventId = event.id;
      }

      if (result.lastEventId) {
        lastEventId = result.lastEventId;
      }
    } catch {
      // feed is best-effort
    }
  }

  function start() {
    if (pollTimer) {
      return;
    }
    void pollOnce();
    pollTimer = setInterval(() => {
      void pollOnce();
    }, POLL_INTERVAL_MS);
  }

  function stop() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  async function showHandoffPlan(handoffFileName) {
    const settings = typeof getSettings === "function" ? getSettings() : {};
    if (!isClineActivityFeedEnabled(settings)) {
      return;
    }

    const workspacePath = String(settings.workspacePath || "").trim();
    if (!workspacePath || !handoffFileName) {
      return;
    }

    try {
      const result = await api.invoke("get-cline-activity-feed", {
        workspacePath,
        limit: 5,
        state: emittedState,
      });

      if (!result?.ok || result.disabled) {
        return;
      }

      if (result.emitted) {
        emittedState = result.emitted;
      }

      const planEvent = (result.events || []).find((event) => event.kind === "plan");
      if (planEvent) {
        renderEvent(planEvent);
        lastEventId = planEvent.id;
      } else {
        ui.appendClineFeedMessage({
          kind: "plan",
          title: t("clineFeedPlan"),
          body: "Handoff hazır — Bridge görevi Cline'a aktaracak.",
          eventId: `handoff-pending-${handoffFileName}`,
          scopeKey: handoffFileName,
        });
      }
    } catch {
      ui.appendClineFeedMessage({
        kind: "plan",
        title: t("clineFeedPlan"),
        body: "Handoff hazır — Bridge görevi Cline'a aktaracak.",
        eventId: `handoff-pending-${handoffFileName}`,
        scopeKey: handoffFileName,
      });
    }
  }

  return {
    start,
    stop,
    pollOnce,
    showHandoffPlan,
  };
}
