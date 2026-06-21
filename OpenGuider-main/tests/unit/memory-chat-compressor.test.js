const test = require("node:test");
const assert = require("node:assert/strict");

const { SessionManager } = require("../../src/session/session-manager");
const { maybeCompressMemoryChat } = require("../../src/session/memory-chat-compressor");

test("applyMemoryCompression merges summary and removes oldest conversational messages", () => {
  const sessionManager = new SessionManager();
  sessionManager.setMessages([
    { role: "user", content: "1" },
    { role: "assistant", content: "2" },
    { role: "user", content: "3" },
  ]);

  const applied = sessionManager.applyMemoryCompression({
    summaryText: "Yeni özet",
    removeCount: 2,
  });

  assert.equal(applied, true);
  const messages = sessionManager.getSnapshot().messages;
  assert.equal(messages.length, 2);
  assert.equal(messages[0].role, "memory-summary");
  assert.match(messages[0].content, /Yeni özet/);
  assert.equal(messages[1].content, "3");
});

test("maybeCompressMemoryChat does not delete messages when summarization fails", async () => {
  const previousThreshold = process.env.SAURON_MEMORY_COMPRESS_THRESHOLD;
  const previousBatch = process.env.SAURON_MEMORY_COMPRESS_BATCH;
  process.env.SAURON_MEMORY_COMPRESS_THRESHOLD = "2";
  process.env.SAURON_MEMORY_COMPRESS_BATCH = "2";

  delete require.cache[require.resolve("../../src/session/memory-chat-constants")];
  delete require.cache[require.resolve("../../src/session/memory-chat-compressor")];
  const { maybeCompressMemoryChat: compressWithThreshold } = require("../../src/session/memory-chat-compressor");

  const sessionManager = new SessionManager();
  sessionManager.setMessages([
    { role: "user", content: "a" },
    { role: "assistant", content: "b" },
    { role: "user", content: "c" },
  ]);

  const store = {};
  await compressWithThreshold({
    store,
    sessionManager,
    streamAIResponse: async () => {
      throw new Error("model down");
    },
    getRuntimeSettings: async () => ({}),
    persistActiveSession: () => {},
    broadcastSessionSnapshot: () => {},
    getActiveChatSessionRecord: () => ({ isMemoryChat: true }),
    appLogger: { warn: () => {} },
  });

  assert.equal(sessionManager.getSnapshot().messages.length, 3);

  if (previousThreshold) {
    process.env.SAURON_MEMORY_COMPRESS_THRESHOLD = previousThreshold;
  } else {
    delete process.env.SAURON_MEMORY_COMPRESS_THRESHOLD;
  }
  if (previousBatch) {
    process.env.SAURON_MEMORY_COMPRESS_BATCH = previousBatch;
  } else {
    delete process.env.SAURON_MEMORY_COMPRESS_BATCH;
  }
  delete require.cache[require.resolve("../../src/session/memory-chat-constants")];
  delete require.cache[require.resolve("../../src/session/memory-chat-compressor")];
});

test("maybeCompressMemoryChat compresses on successful summary", async () => {
  const previousThreshold = process.env.SAURON_MEMORY_COMPRESS_THRESHOLD;
  const previousBatch = process.env.SAURON_MEMORY_COMPRESS_BATCH;
  process.env.SAURON_MEMORY_COMPRESS_THRESHOLD = "2";
  process.env.SAURON_MEMORY_COMPRESS_BATCH = "2";

  delete require.cache[require.resolve("../../src/session/memory-chat-constants")];
  delete require.cache[require.resolve("../../src/session/memory-chat-compressor")];
  const { maybeCompressMemoryChat: compressWithThreshold } = require("../../src/session/memory-chat-compressor");

  const sessionManager = new SessionManager();
  sessionManager.setMessages([
    { role: "user", content: "a" },
    { role: "assistant", content: "b" },
    { role: "user", content: "c" },
  ]);

  let persisted = false;
  await compressWithThreshold({
    store: {},
    sessionManager,
    streamAIResponse: async () => "ozet metni",
    getRuntimeSettings: async () => ({}),
    persistActiveSession: () => {
      persisted = true;
    },
    broadcastSessionSnapshot: () => {},
    getActiveChatSessionRecord: () => ({ isMemoryChat: true }),
    appLogger: { warn: () => {} },
  });

  assert.equal(persisted, true);
  const messages = sessionManager.getSnapshot().messages;
  assert.equal(messages[0].role, "memory-summary");
  assert.equal(messages.some((entry) => entry.content === "a"), false);

  if (previousThreshold) {
    process.env.SAURON_MEMORY_COMPRESS_THRESHOLD = previousThreshold;
  } else {
    delete process.env.SAURON_MEMORY_COMPRESS_THRESHOLD;
  }
  if (previousBatch) {
    process.env.SAURON_MEMORY_COMPRESS_BATCH = previousBatch;
  } else {
    delete process.env.SAURON_MEMORY_COMPRESS_BATCH;
  }
  delete require.cache[require.resolve("../../src/session/memory-chat-constants")];
  delete require.cache[require.resolve("../../src/session/memory-chat-compressor")];
});
