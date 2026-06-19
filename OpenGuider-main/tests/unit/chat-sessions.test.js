const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  deriveSessionTitle,
  deriveSessionPreview,
  createEphemeralChatSession,
  createNewChatSession,
  duplicateChatSession,
  formatChatExportMarkdown,
  getActiveChatSessionTitle,
  loadChatSession,
  listChatSessionSummaries,
  migrateLegacySessionSnapshot,
  persistActiveSession,
  renameChatSession,
  sanitizeExportFilename,
  toggleChatSessionPin,
  sessionMatchesQuery,
  createChatFolder,
  moveChatSession,
  MAX_STORED_MESSAGES,
  resetRuntimeChatStateForTests,
} = require("../../src/session/chat-sessions");
const { SessionManager } = require("../../src/session/session-manager");

function makeStore() {
  return {
    data: {},
    get(key, fallback) {
      return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : fallback;
    },
    set(key, value) {
      this.data[key] = value;
    },
  };
}

test.beforeEach(() => {
  resetRuntimeChatStateForTests();
});

test("deriveSessionTitle uses first user message", () => {
  const title = deriveSessionTitle([
    { role: "assistant", content: "hello" },
    { role: "user", content: "  selamlar abim  " },
  ]);
  assert.equal(title, "selamlar abim");
});

test("createNewChatSession persists previous and starts empty session", () => {
  const store = {
    data: {},
    get(key, fallback) {
      return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : fallback;
    },
    set(key, value) {
      this.data[key] = value;
    },
  };

  const sessionManager = {
    snapshot: {
      sessionId: "old",
      messages: [{ role: "user", content: "ilk sohbet" }],
      goalIntent: "",
      status: "idle",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    getSnapshot() {
      return this.snapshot;
    },
    hydrateSession(snapshot) {
      this.snapshot = snapshot;
    },
  };

  migrateLegacySessionSnapshot(store, sessionManager, sessionManager.getSnapshot());
  const created = createNewChatSession(store, sessionManager);

  assert.ok(created.activeSessionId);
  assert.equal(sessionManager.getSnapshot().messages.length, 0);
  assert.equal(listChatSessionSummaries(store).length, 2);

  const loaded = loadChatSession(store, sessionManager, created.activeSessionId);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.snapshot.messages.length, 0);
});

test("sessionMatchesQuery searches title and message content", () => {
  const session = {
    title: "Proje planı",
    snapshot: { messages: [{ role: "user", content: "VS Code entegrasyonu" }] },
  };
  assert.equal(sessionMatchesQuery(session, "vscode"), true);
  assert.equal(sessionMatchesQuery(session, "plan"), true);
  assert.equal(sessionMatchesQuery(session, "yok"), false);
});

test("toggleChatSessionPin flips pinned state", () => {
  const store = {
    data: {},
    get(key, fallback) {
      return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : fallback;
    },
    set(key, value) {
      this.data[key] = value;
    },
  };

  migrateLegacySessionSnapshot(store, null, {
    messages: [{ role: "user", content: "pin test" }],
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  const sessionId = store.get("chatSessionsV1").activeSessionId;
  const first = toggleChatSessionPin(store, sessionId);
  assert.equal(first.ok, true);
  assert.equal(first.pinned, true);

  const second = toggleChatSessionPin(store, sessionId);
  assert.equal(second.pinned, false);
  assert.equal(listChatSessionSummaries(store)[0].pinned, false);
});

test("renameChatSession sets manual title and preserves it on persist", () => {
  const store = {
    data: {},
    get(key, fallback) {
      return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : fallback;
    },
    set(key, value) {
      this.data[key] = value;
    },
  };

  migrateLegacySessionSnapshot(store, null, {
    messages: [{ role: "user", content: "auto title" }],
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  const sessionId = store.get("chatSessionsV1").activeSessionId;
  const renamed = renameChatSession(store, sessionId, "Özel başlık");
  assert.equal(renamed.ok, true);
  assert.equal(renamed.title, "Özel başlık");

  persistActiveSession(store, {
    messages: [{ role: "user", content: "yeni mesaj içeriği" }],
    updatedAt: "2026-01-02T00:00:00.000Z",
  });
  assert.equal(store.get("chatSessionsV1").sessions[sessionId].title, "Özel başlık");
});

test("duplicateChatSession copies messages into a new active session", () => {
  const store = {
    data: {},
    get(key, fallback) {
      return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : fallback;
    },
    set(key, value) {
      this.data[key] = value;
    },
  };

  const sessionManager = {
    snapshot: {
      sessionId: "src",
      messages: [{ role: "user", content: "kopyalanacak" }],
      goalIntent: "",
      status: "idle",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    getSnapshot() {
      return this.snapshot;
    },
    hydrateSession(snapshot) {
      this.snapshot = snapshot;
    },
  };

  migrateLegacySessionSnapshot(store, sessionManager, sessionManager.getSnapshot());
  const sourceId = store.get("chatSessionsV1").activeSessionId;
  const duplicated = duplicateChatSession(store, sessionManager, sourceId);

  assert.equal(duplicated.ok, true);
  assert.notEqual(duplicated.activeSessionId, sourceId);
  assert.equal(duplicated.session.snapshot.messages.length, 1);
  assert.match(duplicated.session.title, /kopya/);
  assert.equal(listChatSessionSummaries(store).length, 2);
});

test("deriveSessionPreview shows last message snippet", () => {
  const preview = deriveSessionPreview([
    { role: "user", content: "ilk" },
    { role: "assistant", content: "son yanıt burada" },
  ]);
  assert.equal(preview, "Sauron: son yanıt burada");
});

test("formatChatExportMarkdown builds readable export", () => {
  const markdown = formatChatExportMarkdown({
    title: "Test sohbet",
    snapshot: {
      messages: [
        { role: "user", content: "Merhaba" },
        { role: "assistant", content: "Selam!" },
      ],
    },
  });
  assert.match(markdown, /^# Test sohbet/);
  assert.match(markdown, /## Sen/);
  assert.match(markdown, /Merhaba/);
  assert.match(markdown, /## Sauron/);
  assert.match(markdown, /Selam!/);
});

test("sanitizeExportFilename removes unsafe characters", () => {
  assert.equal(sanitizeExportFilename('Proje: "v1"'), "Proje-v1");
});

test("getActiveChatSessionTitle returns active session title", () => {
  const store = {
    data: {},
    get(key, fallback) {
      return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : fallback;
    },
    set(key, value) {
      this.data[key] = value;
    },
  };

  migrateLegacySessionSnapshot(store, null, {
    messages: [{ role: "user", content: "başlık testi" }],
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(getActiveChatSessionTitle(store), "başlık testi");
});

test("createEphemeralChatSession stays in memory and is excluded from disk save", () => {
  const store = {
    data: {},
    get(key, fallback) {
      return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : fallback;
    },
    set(key, value) {
      this.data[key] = value;
    },
  };

  const sessionManager = {
    snapshot: {
      sessionId: "old",
      messages: [{ role: "user", content: "kalıcı mesaj" }],
      goalIntent: "",
      status: "idle",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    getSnapshot() {
      return this.snapshot;
    },
    hydrateSession(snapshot) {
      this.snapshot = snapshot;
    },
  };

  migrateLegacySessionSnapshot(store, sessionManager, sessionManager.getSnapshot());
  const persistedId = store.get("chatSessionsV1").activeSessionId;

  const created = createEphemeralChatSession(store, sessionManager);
  assert.equal(created.session.ephemeral, true);
  assert.notEqual(created.activeSessionId, persistedId);

  persistActiveSession(store, {
    messages: [{ role: "user", content: "geçici mesaj" }],
    updatedAt: "2026-01-02T00:00:00.000Z",
  });

  const saved = store.get("chatSessionsV1");
  assert.equal(saved.activeSessionId, persistedId);
  assert.equal(saved.sessions[created.activeSessionId], undefined);

  const summaries = listChatSessionSummaries(store);
  const ephemeralSummary = summaries.find((entry) => entry.id === created.activeSessionId);
  assert.equal(ephemeralSummary?.ephemeral, true);
});

test("toggleChatSessionPin rejects ephemeral sessions", () => {
  const store = {
    data: {},
    get(key, fallback) {
      return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : fallback;
    },
    set(key, value) {
      this.data[key] = value;
    },
  };

  const sessionManager = {
    snapshot: { sessionId: "x", messages: [], goalIntent: "", status: "idle", updatedAt: "2026-01-01T00:00:00.000Z" },
    getSnapshot() { return this.snapshot; },
    hydrateSession(snapshot) { this.snapshot = snapshot; },
  };

  migrateLegacySessionSnapshot(store, sessionManager, sessionManager.getSnapshot());
  const ephemeral = createEphemeralChatSession(store, sessionManager);
  const result = toggleChatSessionPin(store, ephemeral.activeSessionId);
  assert.equal(result.ok, false);
});

test("send-message style persist keeps messages within MAX_STORED_MESSAGES", () => {
  const manager = new SessionManager();
  for (let index = 0; index < MAX_STORED_MESSAGES + 5; index += 1) {
    manager.addMessage({ role: index % 2 === 0 ? "user" : "assistant", content: `msg-${index}` });
  }
  manager.trimMessages(MAX_STORED_MESSAGES);
  assert.equal(manager.getSnapshot().messages.length, MAX_STORED_MESSAGES);
  assert.equal(manager.getSnapshot().messages[0].content, "msg-5");
});

test("SessionManager removeLastAssistantMessage removes only the latest assistant turn", () => {
  const manager = new SessionManager();
  manager.addMessage({ role: "user", content: "selam" });
  manager.addMessage({ role: "assistant", content: "merhaba" });
  manager.addMessage({ role: "user", content: "nasılsın" });
  manager.addMessage({ role: "assistant", content: "iyiyim" });

  assert.equal(manager.removeLastAssistantMessage(), true);
  assert.deepEqual(
    manager.getSnapshot().messages.map((entry) => entry.content),
    ["selam", "merhaba", "nasılsın"],
  );
  assert.equal(manager.removeLastAssistantMessage(), true);
  assert.deepEqual(
    manager.getSnapshot().messages.map((entry) => entry.content),
    ["selam", "nasılsın"],
  );
  assert.equal(manager.removeLastAssistantMessage(), false);
});

test("SessionManager updateMessage edits content in place", () => {
  const manager = new SessionManager();
  manager.addMessage({ role: "user", content: "ilk" });
  manager.addMessage({ role: "assistant", content: "yanıt" });
  assert.equal(manager.updateMessage(0, "güncel"), true);
  assert.equal(manager.getSnapshot().messages[0].content, "güncel");
});

test("SessionManager deleteMessage and truncateAfter support branching", () => {
  const manager = new SessionManager();
  manager.addMessage({ role: "user", content: "a" });
  manager.addMessage({ role: "assistant", content: "b" });
  manager.addMessage({ role: "user", content: "c" });
  assert.equal(manager.truncateAfter(0), true);
  assert.equal(manager.getSnapshot().messages.length, 1);
  manager.addMessage({ role: "assistant", content: "b2" });
  assert.equal(manager.deleteMessage(1), true);
  assert.equal(manager.getSnapshot().messages.length, 1);
});

test("createChatFolder and moveChatSession organize sessions", () => {
  const store = makeStore();
  migrateLegacySessionSnapshot(store, null, {
    messages: [{ role: "user", content: "klasör testi" }],
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  const sessionId = store.get("chatSessionsV1").activeSessionId;
  const created = createChatFolder(store, "Projeler");
  assert.equal(created.ok, true);
  const moved = moveChatSession(store, sessionId, created.folder.id);
  assert.equal(moved.ok, true);
  assert.equal(moved.folderId, created.folder.id);
  const summaries = listChatSessionSummaries(store);
  assert.equal(summaries[0].folderId, created.folder.id);
});
