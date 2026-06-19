const { randomUUID } = require("crypto");
const { createEmptySession } = require("../session/session-schema");

const CHAT_SESSIONS_STORE_KEY = "chatSessionsV1";
const MAX_STORED_MESSAGES = 80;
const MAX_AI_CONTEXT_MESSAGES = 20;
const MAX_SESSIONS = 100;

let runtimeChatState = null;

function resetRuntimeChatStateForTests() {
  runtimeChatState = null;
}

function resolveRuntimeChatState(store) {
  if (runtimeChatState) {
    return runtimeChatState;
  }

  const loaded = loadChatSessionsState(store);
  runtimeChatState = loaded || createDefaultState();
  if (!loaded && store) {
    saveChatSessionsState(store, runtimeChatState);
  } else if (loaded && runtimeChatState.lastPersistedActiveId === undefined) {
    runtimeChatState.lastPersistedActiveId = null;
  }
  if (!Array.isArray(runtimeChatState.folders)) {
    runtimeChatState.folders = [];
  }
  return runtimeChatState;
}

function createDefaultState() {
  const id = randomUUID();
  const now = new Date().toISOString();
  return {
    activeSessionId: id,
    order: [id],
    folders: [],
    sessions: {
      [id]: {
        id,
        title: "Yeni sohbet",
        createdAt: now,
        updatedAt: now,
        pinned: false,
        folderId: null,
        snapshot: createChatSnapshot(createEmptySession()),
      },
    },
  };
}

function createChatSnapshot(sessionSnapshot) {
  const messages = Array.isArray(sessionSnapshot?.messages)
    ? sessionSnapshot.messages.slice(-MAX_STORED_MESSAGES)
    : [];

  return {
    sessionId: sessionSnapshot?.sessionId || randomUUID(),
    messages,
    goalIntent: sessionSnapshot?.goalIntent || "",
    status: "idle",
    updatedAt: sessionSnapshot?.updatedAt || new Date().toISOString(),
  };
}

function deriveSessionTitle(messages, fallback = "Yeni sohbet") {
  const firstUser = (Array.isArray(messages) ? messages : []).find((entry) => entry?.role === "user");
  if (!firstUser?.content) {
    return fallback;
  }
  const text = String(firstUser.content).trim().replace(/\s+/g, " ");
  if (!text) {
    return fallback;
  }
  return text.length > 42 ? `${text.slice(0, 42)}…` : text;
}

function deriveSessionPreview(messages) {
  const last = [...(Array.isArray(messages) ? messages : [])].reverse().find((entry) => entry?.content);
  if (!last?.content) {
    return "";
  }
  const text = String(last.content).trim().replace(/\s+/g, " ");
  if (!text) {
    return "";
  }
  const prefix = last.role === "user" ? "Sen: " : "Sauron: ";
  const snippet = text.length > 72 ? `${text.slice(0, 72)}…` : text;
  return `${prefix}${snippet}`;
}

function sanitizeExportFilename(title) {
  return String(title || "sohbet")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60) || "sohbet";
}

function formatChatExportMarkdown(session) {
  const title = session?.title || "Sauron sohbet";
  const messages = Array.isArray(session?.snapshot?.messages) ? session.snapshot.messages : [];
  const lines = [
    `# ${title}`,
    "",
    `- Dışa aktarma: ${new Date().toISOString()}`,
    `- Mesaj sayısı: ${messages.length}`,
    "",
  ];

  for (const entry of messages) {
    const roleLabel = entry?.role === "user" ? "Sen" : "Sauron";
    lines.push(`## ${roleLabel}`, "", String(entry?.content || "").trim(), "");
  }

  return lines.join("\n").trim() + "\n";
}

function getChatSessionById(store, sessionId) {
  const state = ensureChatSessionsState(store);
  const targetId = String(sessionId || state.activeSessionId || "").trim();
  return state.sessions[targetId] || null;
}

function getActiveChatSessionTitle(store) {
  const state = ensureChatSessionsState(store);
  return state.sessions[state.activeSessionId]?.title || "";
}

function loadChatSessionsState(store) {
  const raw = store?.get?.(CHAT_SESSIONS_STORE_KEY, null);
  if (!raw || typeof raw !== "object" || !raw.sessions || !raw.activeSessionId) {
    return null;
  }
  return raw;
}

function saveChatSessionsState(store, state) {
  if (!store || !state) {
    return;
  }
  const persistableOrder = state.order.filter((sessionId) => !state.sessions[sessionId]?.ephemeral);
  const persistableSessions = {};
  for (const sessionId of persistableOrder) {
    if (state.sessions[sessionId]) {
      persistableSessions[sessionId] = state.sessions[sessionId];
    }
  }
  let activeSessionId = state.activeSessionId;
  if (state.sessions[activeSessionId]?.ephemeral) {
    activeSessionId = state.lastPersistedActiveId
      || persistableOrder.find((id) => persistableSessions[id])
      || activeSessionId;
  }
  store.set(CHAT_SESSIONS_STORE_KEY, {
    activeSessionId,
    order: persistableOrder,
    sessions: persistableSessions,
    folders: Array.isArray(state.folders) ? state.folders : [],
    lastPersistedActiveId: state.lastPersistedActiveId || null,
  });
}

function ensureChatSessionsState(store) {
  return resolveRuntimeChatState(store);
}

function normalizeSearchText(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function sessionMatchesQuery(session, query) {
  const normalizedQuery = normalizeSearchText(query).replace(/ /g, "");
  if (!normalizedQuery) {
    return true;
  }

  const title = normalizeSearchText(session?.title).replace(/ /g, "");
  if (title.includes(normalizedQuery)) {
    return true;
  }

  const messages = Array.isArray(session?.snapshot?.messages) ? session.snapshot.messages : [];
  return messages.some((entry) =>
    normalizeSearchText(entry?.content).replace(/ /g, "").includes(normalizedQuery),
  );
}

function listChatSessionSummaries(store, options = {}) {
  const state = ensureChatSessionsState(store);
  const query = options?.query;

  return state.order
    .map((sessionId) => state.sessions[sessionId])
    .filter(Boolean)
    .filter((session) => sessionMatchesQuery(session, query))
    .map((session) => ({
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      pinned: Boolean(session.pinned),
      ephemeral: Boolean(session.ephemeral),
      folderId: session.folderId || null,
      messageCount: Array.isArray(session.snapshot?.messages) ? session.snapshot.messages.length : 0,
      preview: deriveSessionPreview(session.snapshot?.messages),
      isActive: session.id === state.activeSessionId,
    }))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }
      return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    });
}

function persistActiveSession(store, sessionSnapshot) {
  const state = ensureChatSessionsState(store);
  const activeId = state.activeSessionId;
  const existing = state.sessions[activeId];
  const messages = Array.isArray(sessionSnapshot?.messages) ? sessionSnapshot.messages : [];
  const now = new Date().toISOString();

  state.sessions[activeId] = {
    id: activeId,
    title: existing?.titleManuallySet
      ? (existing?.title || deriveSessionTitle(messages, "Yeni sohbet"))
      : deriveSessionTitle(messages, existing?.title || "Yeni sohbet"),
    titleManuallySet: Boolean(existing?.titleManuallySet),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    pinned: Boolean(existing?.pinned),
    ephemeral: Boolean(existing?.ephemeral),
    folderId: existing?.folderId || null,
    snapshot: createChatSnapshot(sessionSnapshot),
  };

  if (!state.order.includes(activeId)) {
    state.order.unshift(activeId);
  }

  if (existing?.ephemeral) {
    return state.sessions[activeId];
  }

  saveChatSessionsState(store, state);
  return state.sessions[activeId];
}

function createNewChatSession(store, sessionManager) {
  const state = ensureChatSessionsState(store);
  if (sessionManager) {
    persistActiveSession(store, sessionManager.getSnapshot());
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const emptySnapshot = createChatSnapshot(createEmptySession());

  state.sessions[id] = {
    id,
    title: "Yeni sohbet",
    titleManuallySet: false,
    createdAt: now,
    updatedAt: now,
    pinned: false,
    folderId: null,
    snapshot: emptySnapshot,
  };
  state.activeSessionId = id;
  state.order = [id, ...state.order.filter((entry) => entry !== id)].slice(0, MAX_SESSIONS);

  while (state.order.length > MAX_SESSIONS) {
    const removedId = state.order.pop();
    if (removedId && removedId !== state.activeSessionId) {
      delete state.sessions[removedId];
    }
  }

  saveChatSessionsState(store, state);

  if (sessionManager) {
    sessionManager.hydrateSession(emptySnapshot);
  }

  return {
    activeSessionId: id,
    session: state.sessions[id],
    sessions: listChatSessionSummaries(store),
  };
}

function createEphemeralChatSession(store, sessionManager) {
  const state = ensureChatSessionsState(store);
  if (sessionManager) {
    persistActiveSession(store, sessionManager.getSnapshot());
  }

  const current = state.sessions[state.activeSessionId];
  if (current && !current.ephemeral) {
    state.lastPersistedActiveId = state.activeSessionId;
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const emptySnapshot = createChatSnapshot(createEmptySession());

  state.sessions[id] = {
    id,
    title: "Geçici sohbet",
    titleManuallySet: true,
    createdAt: now,
    updatedAt: now,
    pinned: false,
    ephemeral: true,
    snapshot: emptySnapshot,
  };
  state.activeSessionId = id;
  state.order = [id, ...state.order.filter((entry) => entry !== id)];

  if (sessionManager) {
    sessionManager.hydrateSession(emptySnapshot);
  }

  return {
    activeSessionId: id,
    session: state.sessions[id],
    sessions: listChatSessionSummaries(store),
  };
}

function loadChatSession(store, sessionManager, sessionId) {
  const state = ensureChatSessionsState(store);
  const targetId = String(sessionId || "").trim();
  const target = state.sessions[targetId];
  if (!target) {
    return { ok: false, error: "Chat session not found." };
  }

  if (sessionManager) {
    persistActiveSession(store, sessionManager.getSnapshot());
  }

  state.activeSessionId = targetId;
  state.order = [targetId, ...state.order.filter((entry) => entry !== targetId)];
  saveChatSessionsState(store, state);

  if (sessionManager) {
    sessionManager.hydrateSession(target.snapshot);
  }

  return {
    ok: true,
    activeSessionId: targetId,
    session: target,
    sessions: listChatSessionSummaries(store),
    snapshot: sessionManager ? sessionManager.getSnapshot() : target.snapshot,
  };
}

function renameChatSession(store, sessionId, nextTitle) {
  const state = ensureChatSessionsState(store);
  const targetId = String(sessionId || "").trim();
  const target = state.sessions[targetId];
  if (!target) {
    return { ok: false, error: "Chat session not found." };
  }

  const title = String(nextTitle || "").trim();
  if (!title) {
    return { ok: false, error: "Sohbet adı boş olamaz." };
  }

  target.title = title.slice(0, 80);
  target.titleManuallySet = true;
  target.updatedAt = new Date().toISOString();
  saveChatSessionsState(store, state);

  return {
    ok: true,
    sessionId: targetId,
    title: target.title,
    sessions: listChatSessionSummaries(store),
  };
}

function duplicateChatSession(store, sessionManager, sessionId) {
  const state = ensureChatSessionsState(store);
  if (sessionManager) {
    persistActiveSession(store, sessionManager.getSnapshot());
  }

  const sourceId = String(sessionId || state.activeSessionId || "").trim();
  const source = state.sessions[sourceId];
  if (!source) {
    return { ok: false, error: "Chat session not found." };
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const copiedSnapshot = createChatSnapshot(source.snapshot || createEmptySession());

  state.sessions[id] = {
    id,
    title: `${source.title || "Sohbet"} (kopya)`.slice(0, 80),
    titleManuallySet: true,
    createdAt: now,
    updatedAt: now,
    pinned: false,
    snapshot: copiedSnapshot,
  };
  state.activeSessionId = id;
  state.order = [id, ...state.order.filter((entry) => entry !== id)].slice(0, MAX_SESSIONS);
  saveChatSessionsState(store, state);

  if (sessionManager) {
    sessionManager.hydrateSession(copiedSnapshot);
  }

  return {
    ok: true,
    activeSessionId: id,
    session: state.sessions[id],
    sessions: listChatSessionSummaries(store),
    snapshot: sessionManager ? sessionManager.getSnapshot() : copiedSnapshot,
  };
}

function toggleChatSessionPin(store, sessionId) {
  const state = ensureChatSessionsState(store);
  const targetId = String(sessionId || "").trim();
  const target = state.sessions[targetId];
  if (!target) {
    return { ok: false, error: "Chat session not found." };
  }
  if (target.ephemeral) {
    return { ok: false, error: "Geçici sohbetler sabitlenemez." };
  }

  target.pinned = !Boolean(target.pinned);
  target.updatedAt = new Date().toISOString();
  saveChatSessionsState(store, state);

  return {
    ok: true,
    sessionId: targetId,
    pinned: target.pinned,
    sessions: listChatSessionSummaries(store),
  };
}

function deleteChatSession(store, sessionManager, sessionId) {
  const state = ensureChatSessionsState(store);
  const targetId = String(sessionId || "").trim();
  if (!state.sessions[targetId]) {
    return { ok: false, error: "Chat session not found." };
  }

  delete state.sessions[targetId];
  state.order = state.order.filter((entry) => entry !== targetId);

  if (state.activeSessionId === targetId) {
    const nextId = state.order[0];
    if (!nextId) {
      const created = createNewChatSession(store, sessionManager);
      return { ok: true, ...created, deletedSessionId: targetId };
    }
    return loadChatSession(store, sessionManager, nextId);
  }

  saveChatSessionsState(store, state);
  return {
    ok: true,
    activeSessionId: state.activeSessionId,
    deletedSessionId: targetId,
    sessions: listChatSessionSummaries(store),
    snapshot: sessionManager ? sessionManager.getSnapshot() : null,
  };
}

function migrateLegacySessionSnapshot(store, sessionManager, legacySnapshot) {
  if (!legacySnapshot || loadChatSessionsState(store)) {
    return ensureChatSessionsState(store);
  }

  const state = createDefaultState();
  const activeId = state.activeSessionId;
  const messages = Array.isArray(legacySnapshot.messages) ? legacySnapshot.messages : [];
  state.sessions[activeId] = {
    id: activeId,
    title: deriveSessionTitle(messages, "Önceki sohbet"),
    titleManuallySet: false,
    createdAt: legacySnapshot.updatedAt || new Date().toISOString(),
    updatedAt: legacySnapshot.updatedAt || new Date().toISOString(),
    pinned: false,
    snapshot: createChatSnapshot(legacySnapshot),
  };

  saveChatSessionsState(store, state);

  if (sessionManager) {
    sessionManager.hydrateSession(state.sessions[activeId].snapshot);
  }

  return state;
}

function listChatFolders(store) {
  const state = ensureChatSessionsState(store);
  return Array.isArray(state.folders) ? state.folders.slice() : [];
}

function createChatFolder(store, name) {
  const state = ensureChatSessionsState(store);
  const title = String(name || "").trim();
  if (!title) {
    return { ok: false, error: "Klasör adı boş olamaz." };
  }
  const folder = {
    id: randomUUID(),
    name: title.slice(0, 60),
    createdAt: new Date().toISOString(),
  };
  state.folders = [...(state.folders || []), folder];
  saveChatSessionsState(store, state);
  return { ok: true, folder, folders: listChatFolders(store) };
}

function renameChatFolder(store, folderId, name) {
  const state = ensureChatSessionsState(store);
  const targetId = String(folderId || "").trim();
  const folder = (state.folders || []).find((entry) => entry.id === targetId);
  if (!folder) {
    return { ok: false, error: "Klasör bulunamadı." };
  }
  const title = String(name || "").trim();
  if (!title) {
    return { ok: false, error: "Klasör adı boş olamaz." };
  }
  folder.name = title.slice(0, 60);
  saveChatSessionsState(store, state);
  return { ok: true, folder, folders: listChatFolders(store) };
}

function deleteChatFolder(store, folderId) {
  const state = ensureChatSessionsState(store);
  const targetId = String(folderId || "").trim();
  state.folders = (state.folders || []).filter((entry) => entry.id !== targetId);
  for (const session of Object.values(state.sessions)) {
    if (session?.folderId === targetId) {
      session.folderId = null;
    }
  }
  saveChatSessionsState(store, state);
  return {
    ok: true,
    folders: listChatFolders(store),
    sessions: listChatSessionSummaries(store),
  };
}

function moveChatSession(store, sessionId, folderId) {
  const state = ensureChatSessionsState(store);
  const targetId = String(sessionId || "").trim();
  const session = state.sessions[targetId];
  if (!session) {
    return { ok: false, error: "Sohbet bulunamadı." };
  }
  const nextFolderId = String(folderId || "").trim() || null;
  if (nextFolderId && !(state.folders || []).some((entry) => entry.id === nextFolderId)) {
    return { ok: false, error: "Klasör bulunamadı." };
  }
  session.folderId = nextFolderId;
  session.updatedAt = new Date().toISOString();
  saveChatSessionsState(store, state);
  return {
    ok: true,
    sessionId: targetId,
    folderId: nextFolderId,
    sessions: listChatSessionSummaries(store),
    folders: listChatFolders(store),
  };
}

function exportAllSessionsJson(store) {
  const state = ensureChatSessionsState(store);
  const persistableOrder = state.order.filter((sessionId) => !state.sessions[sessionId]?.ephemeral);
  const persistableSessions = {};
  for (const sessionId of persistableOrder) {
    if (state.sessions[sessionId]) {
      persistableSessions[sessionId] = state.sessions[sessionId];
    }
  }
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    activeSessionId: state.activeSessionId,
    order: persistableOrder,
    folders: Array.isArray(state.folders) ? state.folders.slice() : [],
    sessions: persistableSessions,
  };
}

function importChatSessionsFromJson(store, payload, { mode = "merge" } = {}) {
  if (!payload || typeof payload !== "object" || !payload.sessions) {
    return { ok: false, error: "Geçersiz yedek dosyası." };
  }

  const incomingSessions = payload.sessions;
  const incomingFolders = Array.isArray(payload.folders) ? payload.folders : [];
  const state = ensureChatSessionsState(store);

  if (mode === "replace") {
    state.sessions = { ...incomingSessions };
    state.order = Array.isArray(payload.order)
      ? payload.order.filter((id) => state.sessions[id])
      : Object.keys(state.sessions);
    state.folders = incomingFolders.slice();
    state.activeSessionId = payload.activeSessionId && state.sessions[payload.activeSessionId]
      ? payload.activeSessionId
      : state.order[0];
    saveChatSessionsState(store, state);
    return {
      ok: true,
      importedCount: Object.keys(incomingSessions).length,
      activeSessionId: state.activeSessionId,
      sessions: listChatSessionSummaries(store),
      folders: listChatFolders(store),
    };
  }

  const folderIds = new Set((state.folders || []).map((entry) => entry.id));
  for (const folder of incomingFolders) {
    if (folder?.id && !folderIds.has(folder.id)) {
      state.folders = [...(state.folders || []), folder];
      folderIds.add(folder.id);
    }
  }

  let importedCount = 0;
  for (const [sessionId, session] of Object.entries(incomingSessions)) {
    if (!session || typeof session !== "object") {
      continue;
    }
    if (!state.sessions[sessionId]) {
      state.order.push(sessionId);
      importedCount += 1;
    }
    state.sessions[sessionId] = session;
  }

  saveChatSessionsState(store, state);
  return {
    ok: true,
    importedCount,
    activeSessionId: state.activeSessionId,
    sessions: listChatSessionSummaries(store),
    folders: listChatFolders(store),
  };
}

module.exports = {
  CHAT_SESSIONS_STORE_KEY,
  MAX_AI_CONTEXT_MESSAGES,
  MAX_STORED_MESSAGES,
  createEphemeralChatSession,
  createChatFolder,
  createNewChatSession,
  deleteChatFolder,
  deleteChatSession,
  duplicateChatSession,
  deriveSessionPreview,
  deriveSessionTitle,
  ensureChatSessionsState,
  formatChatExportMarkdown,
  getActiveChatSessionTitle,
  getChatSessionById,
  exportAllSessionsJson,
  importChatSessionsFromJson,
  listChatSessionSummaries,
  listChatFolders,
  loadChatSession,
  loadChatSessionsState,
  migrateLegacySessionSnapshot,
  moveChatSession,
  persistActiveSession,
  renameChatFolder,
  renameChatSession,
  resetRuntimeChatStateForTests,
  sanitizeExportFilename,
  saveChatSessionsState,
  sessionMatchesQuery,
  toggleChatSessionPin,
};
