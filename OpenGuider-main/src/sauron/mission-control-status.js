const fs = require("fs");
const path = require("path");
const { getWorkspaceHubStatus } = require("./workspace-hub-status");
const { readMemory } = require("./project-memory");
const { listHandoffHistory } = require("./handoff");
const { getActiveGooseSession } = require("./goose-session-state");
const { isGamedevModeActive, getLastGamedevSession } = require("./gamedev-session-state");
const { readTaskCompleteArtifact } = require("./build-pipeline/pipeline-state");

const CHANNEL_META = {
  workspace: {
    id: "workspace",
    label: "⌘ Çalışma Kısmı",
    icon: "⌘",
  },
  goose: {
    id: "goose",
    label: "🪿 Goose",
    icon: "🪿",
  },
  gamedev: {
    id: "gamedev",
    label: "🎮 Game Dev",
    icon: "🎮",
  },
};

function readActiveChannelMarker(workspacePath) {
  const markerPath = path.join(String(workspacePath || "").trim(), ".sauron", "active-channel.json");
  if (!fs.existsSync(markerPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(markerPath, "utf8"));
  } catch {
    return null;
  }
}

function resolveWorkspaceChannel(hub, workspacePath) {
  const pending = listHandoffHistory(workspacePath, { limit: 20 })
    .filter((item) => item.status === "pending").length;
  const taskComplete = readTaskCompleteArtifact(workspacePath);

  let state = "idle";
  let detail = "Hazır — handoff gönderebilirsiniz.";

  if (hub?.handoffStatus === "bekliyor" || pending > 0) {
    state = "active";
    detail = pending > 0
      ? `${pending} bekleyen handoff`
      : "Handoff Cline'a aktarılıyor";
  } else if (taskComplete || hub?.clineTaskComplete) {
    state = "done";
    detail = "Son görev tamamlandı";
  } else if (hub?.pipeline?.status === "active") {
    state = "active";
    detail = `Üretim hattı faz ${hub.pipeline.currentPhase}/${hub.pipeline.totalPhases}`;
  }

  return {
    ...CHANNEL_META.workspace,
    enabled: true,
    state,
    detail,
    tone: state === "done" ? "success" : state === "active" ? "warning" : "default",
    pendingHandoffs: pending,
    handoffStatus: hub?.handoffStatus || null,
    projectLabel: hub?.projectLabel || "",
  };
}

function resolveGooseChannel(settings = {}) {
  const enabled = settings.gooseEnabled !== false;
  const session = getActiveGooseSession();
  const runtimeAlive = Boolean(session?.sessionId);

  let state = "idle";
  let detail = enabled ? "Görev göndermek için 🪿 butonuna basın" : "Devre dışı";

  if (runtimeAlive) {
    state = "active";
    detail = `Oturum aktif · ${session.mode || "balanced"}`;
  }

  return {
    ...CHANNEL_META.goose,
    enabled,
    state,
    detail,
    tone: state === "active" ? "warning" : "default",
    sessionId: session?.sessionId || "",
    mode: session?.mode || "",
  };
}

function resolveGamedevChannel(settings = {}, workspacePath) {
  const enabled = settings.gamedevEnabled !== false;
  const modeActive = isGamedevModeActive();
  const session = getLastGamedevSession();

  let state = "idle";
  let detail = enabled ? "Unity/Unreal MCP oturumu başlatılabilir" : "Devre dışı";

  if (modeActive) {
    state = "active";
    const engine = session?.engine || settings.gamedevActiveEngine || "unity";
    detail = `Aktif · ${engine}`;
  }

  return {
    ...CHANNEL_META.gamedev,
    enabled,
    state,
    detail,
    tone: state === "active" ? "warning" : "default",
    engine: session?.engine || settings.gamedevActiveEngine || "",
    handoffFileName: session?.handoffFileName || "",
  };
}

function resolvePrimaryChannel(channels, marker) {
  if (marker?.channel && channels[marker.channel]?.state === "active") {
    return marker.channel;
  }
  if (channels.gamedev?.state === "active") {
    return "gamedev";
  }
  if (channels.goose?.state === "active") {
    return "goose";
  }
  if (channels.workspace?.state === "active") {
    return "workspace";
  }
  if (marker?.channel) {
    return marker.channel;
  }
  return "workspace";
}

function buildRecentMemoryLines(workspacePath, settings = {}) {
  if (settings.projectMemoryEnabled === false) {
    return [];
  }
  const memory = readMemory(workspacePath);
  return (memory.tasks || []).slice(0, 3).map((task) => {
    const channel = task.channel ? `[${task.channel}] ` : "";
    return `${channel}${task.summary}`;
  });
}

function getMissionControlStatus(workspacePath, options = {}) {
  const resolved = String(workspacePath || "").trim();
  if (!resolved) {
    return { ok: false, error: "Workspace path is missing." };
  }

  const settings = options.settings || {};
  const hub = getWorkspaceHubStatus(resolved, options);
  const marker = readActiveChannelMarker(resolved);

  const channels = {
    workspace: resolveWorkspaceChannel(hub, resolved),
    goose: resolveGooseChannel(settings),
    gamedev: resolveGamedevChannel(settings, resolved),
  };

  const primaryChannel = resolvePrimaryChannel(channels, marker);
  const recentMemory = buildRecentMemoryLines(resolved, settings);
  const activeCount = Object.values(channels).filter((ch) => ch.state === "active").length;

  const summaryParts = [];
  for (const key of ["workspace", "goose", "gamedev"]) {
    const ch = channels[key];
    if (ch.state === "active") {
      summaryParts.push(`${ch.icon} ${ch.detail}`);
    }
  }
  if (!summaryParts.length && hub?.summaryLine) {
    summaryParts.push(hub.summaryLine);
  }

  return {
    ok: true,
    workspacePath: resolved,
    primaryChannel,
    activeChannelLabel: CHANNEL_META[primaryChannel]?.label || primaryChannel,
    activeCount,
    channels,
    recentMemory,
    summaryLine: summaryParts.join(" · ") || "Tüm kanallar hazır",
    marker: marker
      ? { channel: marker.channel, label: marker.label, openedAt: marker.openedAt }
      : null,
    shouldShow: activeCount > 0 || Boolean(hub?.shouldShow) || recentMemory.length > 0,
  };
}

module.exports = {
  CHANNEL_META,
  getMissionControlStatus,
  readActiveChannelMarker,
};
