const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  deriveSessionTitle,
  deriveSessionPreview,
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
} = require("../../src/session/chat-sessions");

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
