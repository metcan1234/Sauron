const test = require("node:test");
const assert = require("node:assert/strict");

const { SessionManager } = require("../../src/session/session-manager");

test("regenerate flow removes last assistant while keeping user turn", () => {
  const manager = new SessionManager();
  manager.addMessage({ role: "user", content: "ilk soru" });
  manager.addMessage({ role: "assistant", content: "ilk cevap" });
  manager.addMessage({ role: "user", content: "ikinci soru" });
  manager.addMessage({ role: "assistant", content: "ikinci cevap" });

  assert.equal(manager.removeLastAssistantMessage(), true);

  const messages = manager.getSnapshot().messages;
  assert.equal(messages.length, 3);
  assert.equal(messages[messages.length - 1].role, "user");
  assert.equal(messages[messages.length - 1].content, "ikinci soru");
});

test("regenerate with skipUserPersist keeps history ready for resend", () => {
  const manager = new SessionManager();
  manager.addMessage({ role: "user", content: "tekrar dene" });
  manager.addMessage({ role: "assistant", content: "eski cevap" });
  manager.removeLastAssistantMessage();

  const history = manager.getSnapshot().messages;
  assert.deepEqual(
    history.map((entry) => entry.content),
    ["tekrar dene"],
  );
});
