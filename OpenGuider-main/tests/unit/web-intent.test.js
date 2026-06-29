const test = require("node:test");
const assert = require("node:assert/strict");
const { detectWebIntent } = require("../../src/sauron/web-studio/web-intent");

test("detectWebIntent returns build for corporate site requests", () => {
  const result = detectWebIntent("Göklü bir şirket için kurumsal web sitesi yap");
  assert.equal(result.mode, "build");
  assert.equal(result.suggestWebStudio, true);
});

test("detectWebIntent returns browse for navigation requests", () => {
  const result = detectWebIntent("Google'da OpenAI docs sitesini aç");
  assert.equal(result.mode, "browse");
  assert.equal(result.suggestWebStudio, false);
});

test("detectWebIntent prefers build when both signals present with strong build", () => {
  const result = detectWebIntent("Kurumsal site yap ve Next.js kullan");
  assert.equal(result.mode, "build");
});
