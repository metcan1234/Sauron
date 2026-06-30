const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { listHandoffHistory } = require("../handoff");
const { readTaskCompleteArtifact } = require("../build-pipeline/pipeline-state");
const { buildPlanFromHandoff } = require("./plan-from-handoff");
const {
  resolveClineTaskHistoryPath,
  readTaskHistory,
  taskMatchesWorkspace,
  snapshotTaskMetrics,
} = require("../finops/cline-usage-reader");

const ACTIVITY_FILENAME = "cline-activity.jsonl";
const MAX_JOURNAL_LINES = 200;
const DEFAULT_LIMIT = 30;

function getSauronDir(workspacePath) {
  return path.join(String(workspacePath || "").trim(), ".sauron");
}

function getActivityJournalPath(workspacePath) {
  return path.join(getSauronDir(workspacePath), ACTIVITY_FILENAME);
}

function makeEventId(prefix, seed) {
  const hash = crypto.createHash("sha1").update(String(seed || "")).digest("hex").slice(0, 12);
  return `${prefix}-${hash}`;
}

function parseJournalLine(line) {
  try {
    const parsed = JSON.parse(line);
    if (!parsed || typeof parsed !== "object" || !parsed.id || !parsed.kind) {
      return null;
    }
    return {
      id: String(parsed.id),
      kind: String(parsed.kind),
      title: String(parsed.title || ""),
      body: String(parsed.body || ""),
      at: String(parsed.at || ""),
      scopeKey: String(parsed.scopeKey || ""),
      handoffId: String(parsed.handoffId || ""),
    };
  } catch {
    return null;
  }
}

function readActivityEvents(workspacePath, options = {}) {
  const journalPath = getActivityJournalPath(workspacePath);
  if (!fs.existsSync(journalPath)) {
    return [];
  }

  const afterId = String(options.afterId || "");
  const limit = Math.max(1, Math.min(100, Number(options.limit) || DEFAULT_LIMIT));
  const raw = fs.readFileSync(journalPath, "utf8");
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const events = lines.map(parseJournalLine).filter(Boolean);

  let startIndex = 0;
  if (afterId) {
    const foundIndex = events.findIndex((event) => event.id === afterId);
    startIndex = foundIndex >= 0 ? foundIndex + 1 : 0;
  }

  return events.slice(startIndex, startIndex + limit);
}

function appendActivityEvent(workspacePath, event) {
  const journalPath = getActivityJournalPath(workspacePath);
  fs.mkdirSync(path.dirname(journalPath), { recursive: true });

  const line = `${JSON.stringify({
    id: event.id,
    kind: event.kind,
    title: event.title || "",
    body: event.body || "",
    at: event.at || new Date().toISOString(),
    scopeKey: event.scopeKey || "",
    handoffId: event.handoffId || "",
  })}\n`;

  let existing = "";
  if (fs.existsSync(journalPath)) {
    existing = fs.readFileSync(journalPath, "utf8");
  }

  const lines = `${existing}${line}`.split(/\r?\n/).filter(Boolean);
  const pruned = lines.length > MAX_JOURNAL_LINES
    ? lines.slice(lines.length - MAX_JOURNAL_LINES)
    : lines;

  fs.writeFileSync(journalPath, `${pruned.join("\n")}\n`, "utf8");
  return event;
}

function readHandoffPayload(workspacePath, fileName, status) {
  const sauronDir = getSauronDir(workspacePath);
  let suffix = "";
  if (status === "consumed") suffix = ".consumed";
  else if (status === "rejected") suffix = ".rejected";
  const fullPath = path.join(sauronDir, `${fileName}${suffix}`);
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch {
    return null;
  }
}

function resolveActiveClineTask(workspacePath) {
  const historyPath = resolveClineTaskHistoryPath();
  if (!historyPath || !fs.existsSync(historyPath)) {
    return null;
  }

  let history;
  try {
    history = readTaskHistory(historyPath);
  } catch {
    return null;
  }

  const matches = history
    .filter((task) => taskMatchesWorkspace(task, workspacePath))
    .sort((left, right) => (Number(right?.ts) || 0) - (Number(left?.ts) || 0));

  return matches[0] || null;
}

function buildDerivedEvents(workspacePath, state = {}) {
  const derived = [];
  const emitted = state.emitted || {
    plans: {},
    reports: {},
    questions: {},
    activities: {},
  };

  const latestHandoff = listHandoffHistory(workspacePath, { limit: 1 })[0];
  if (latestHandoff?.fileName) {
    const handoffKey = `${latestHandoff.fileName}:${latestHandoff.status}`;
    if (!emitted.plans[handoffKey]) {
      const payload = readHandoffPayload(
        workspacePath,
        latestHandoff.fileName,
        latestHandoff.status,
      ) || latestHandoff;
      const plan = buildPlanFromHandoff(payload);
      if (plan.body) {
        const eventId = makeEventId("plan", handoffKey);
        derived.push({
          id: eventId,
          kind: "plan",
          title: plan.title,
          body: plan.body,
          at: latestHandoff.createdAt || new Date().toISOString(),
          scopeKey: latestHandoff.fileName,
          handoffId: payload.id || latestHandoff.fileName,
        });
        emitted.plans[handoffKey] = eventId;
      }
    }

    if (latestHandoff.status === "pending" && !emitted.questions[latestHandoff.fileName]) {
      derived.push({
        id: makeEventId("question", `pending-${latestHandoff.fileName}`),
        kind: "question",
        title: "Handoff bekliyor",
        body: "Bridge bu görevi Cline'a aktaracak. VS Code'da Cline sidebar'ını açık tutun.",
        at: latestHandoff.createdAt || new Date().toISOString(),
        scopeKey: latestHandoff.fileName,
        handoffId: latestHandoff.fileName,
      });
      emitted.questions[latestHandoff.fileName] = true;
    }
  }

  const activeTask = resolveActiveClineTask(workspacePath);
  if (activeTask) {
    const metrics = snapshotTaskMetrics(activeTask);
    const activityKey = `${activeTask.id || activeTask.ulid}:${metrics.tokensIn}:${metrics.tokensOut}`;
    if (!emitted.activities[activityKey]) {
      const modelLabel = metrics.modelId && metrics.modelId !== "unknown"
        ? metrics.modelId
        : "bilinmiyor";
      derived.push({
        id: makeEventId("activity", activityKey),
        kind: "activity",
        title: "Cline çalışıyor",
        body: `Model: ${modelLabel} · token: ${metrics.tokensIn + metrics.tokensOut}`,
        at: metrics.ts > 0 ? new Date(metrics.ts).toISOString() : new Date().toISOString(),
        scopeKey: String(activeTask.id || activeTask.ulid || "active"),
        handoffId: latestHandoff?.fileName || "",
      });
      emitted.activities[activityKey] = true;
    }
  }

  const taskComplete = readTaskCompleteArtifact(workspacePath);
  if (taskComplete?.completedAt) {
    const reportKey = `${taskComplete.handoffId || ""}:${taskComplete.completedAt}`;
    if (!emitted.reports[reportKey]) {
      derived.push({
        id: makeEventId("report", reportKey),
        kind: "report",
        title: "Görev tamamlandı",
        body: String(taskComplete.summary || "Cline görevi bitti."),
        at: taskComplete.completedAt,
        scopeKey: taskComplete.handoffId || "complete",
        handoffId: taskComplete.handoffId || "",
      });
      emitted.reports[reportKey] = true;
    }
  }

  return { derived, emitted };
}

function getClineActivityFeed(workspacePath, options = {}) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return { ok: false, error: "Workspace path is missing.", events: [] };
  }

  const journalEvents = readActivityEvents(resolved, options);
  const { derived, emitted } = buildDerivedEvents(resolved, options.state || {});

  const journalIds = new Set(journalEvents.map((event) => event.id));
  const merged = [
    ...journalEvents,
    ...derived.filter((event) => !journalIds.has(event.id)),
  ];

  const afterId = String(options.afterId || "");
  let filtered = merged;
  if (afterId) {
    const index = merged.findIndex((event) => event.id === afterId);
    filtered = index >= 0 ? merged.slice(index + 1) : merged;
  }

  const limit = Math.max(1, Math.min(100, Number(options.limit) || DEFAULT_LIMIT));
  const events = filtered.slice(0, limit);

  return {
    ok: true,
    workspacePath: resolved,
    events,
    emitted,
    lastEventId: events.length ? events[events.length - 1].id : afterId || "",
  };
}

module.exports = {
  ACTIVITY_FILENAME,
  MAX_JOURNAL_LINES,
  appendActivityEvent,
  buildDerivedEvents,
  getClineActivityFeed,
  getActivityJournalPath,
  makeEventId,
  parseJournalLine,
  readActivityEvents,
};
