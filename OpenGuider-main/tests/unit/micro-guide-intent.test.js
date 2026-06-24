const test = require("node:test");
const assert = require("node:assert/strict");
const { detectMicroGuideIntent } = require("../../src/agent/micro-guide/detect-micro-guide-intent");

test("detectMicroGuideIntent suggests screen guidance for Turkish open questions", () => {
  const result = detectMicroGuideIntent("WhatsApp'ı nereden açarım?");
  assert.equal(result.shouldSuggest, true);
  assert.ok(result.confidence > 0);
  assert.equal(result.reason, "screen_guidance");
});

test("detectMicroGuideIntent suggests for English how-to-open phrasing", () => {
  const result = detectMicroGuideIntent("How do I open Settings on this screen?");
  assert.equal(result.shouldSuggest, true);
});

test("detectMicroGuideIntent excludes coding and workspace signals", () => {
  const result = detectMicroGuideIntent("vscode'da bu dosyayı nasıl açarım commit atmadan");
  assert.equal(result.shouldSuggest, false);
  assert.equal(result.reason, "coding_or_workspace");
});

test("detectMicroGuideIntent defers to web studio build intent", () => {
  const result = detectMicroGuideIntent("Kurumsal site yap nasıl açarım");
  assert.equal(result.shouldSuggest, false);
  assert.equal(result.reason, "web_studio_build");
});

test("detectMicroGuideIntent suggests for opening help phrasing without explicit nasıl aç", () => {
  const result = detectMicroGuideIntent("whatsapp ı açmamda bana yardım et");
  assert.equal(result.shouldSuggest, true);
  assert.equal(result.reason, "screen_guidance");
});

test("detectMicroGuideIntent suggests for bulmamda yardım et", () => {
  const result = detectMicroGuideIntent("whatsapp'ı bulmamda yardım et");
  assert.equal(result.shouldSuggest, true);
});

test("detectMicroGuideIntent suggests for açmamda without yardım et", () => {
  const result = detectMicroGuideIntent("whatsapp açmamda bana yardım");
  assert.equal(result.shouldSuggest, true);
});

test("detectMicroGuideIntent suggests for ekranımdaki kişiye bak", () => {
  const result = detectMicroGuideIntent("ekranımdaki kişiye bak");
  assert.equal(result.shouldSuggest, true);
  assert.equal(result.reason, "screen_guidance");
});

test("detectMicroGuideIntent suggests for ekranımda gördüğün şeyleri yaz", () => {
  const result = detectMicroGuideIntent("ekranımda gördüğün şeyleri yaz");
  assert.equal(result.shouldSuggest, true);
});
