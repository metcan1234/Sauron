const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  extractAtMentions,
  buildAtFileContextBlock,
  enrichTextWithAtFileContext,
} = require("../../../src/panel/at-file-context");
const {
  listConversationScenarios,
  getScenarioBlock,
} = require("../../../src/ai/conversation-scenarios");
const {
  parseExtractedFacts,
  mergeMemoryFacts,
} = require("../../../src/session/auto-memory-extract");
const { resolveChannelHints } = require("../../../src/routing/channel-hints");
const { composeSystemPrompt } = require("../../../src/ai/system-prompt");

describe("at-file-context", () => {
  it("extracts @ mentions from message text", () => {
    const mentions = extractAtMentions("Lütfen @src/app.js dosyasına bak");
    assert.deepEqual(mentions, ["src/app.js"]);
  });

  it("returns empty block when no mentions", () => {
    const result = buildAtFileContextBlock("/tmp", "merhaba");
    assert.equal(result.block, "");
  });
});

describe("conversation-scenarios", () => {
  it("lists built-in scenarios", () => {
    const scenarios = listConversationScenarios();
    assert.ok(scenarios.length >= 4);
  });

  it("includes scenario block in panel prompt only when active", () => {
    const withScenario = composeSystemPrompt({
      settings: { activePersonaId: "luna", activeScenarioId: "gece-sohbeti" },
    });
    const without = composeSystemPrompt({
      settings: { activePersonaId: "luna", activeScenarioId: "" },
    });
    assert.match(withScenario, /Gece sohbeti/);
    assert.doesNotMatch(without, /AKTİF SENARYO/);
    assert.equal(getScenarioBlock("gece-sohbeti").length > 0, true);
  });
});

describe("auto-memory-extract", () => {
  it("parses bullet facts and merges deduped", () => {
    const facts = parseExtractedFacts("- Kahve sever\n- Kısa cevap");
    assert.deepEqual(facts, ["Kahve sever", "Kısa cevap"]);
    const merged = mergeMemoryFacts(["Kahve sever"], ["React kullanıyor", "Kahve sever"]);
    assert.equal(merged.length, 2);
  });
});

describe("channel-hints", () => {
  it("suggests code agent when native enabled and coding intent", () => {
    const result = resolveChannelHints({
      text: "bu bug'ı düzelt",
      settings: {
        codeAgentNativeEnabled: true,
        workspacePath: "C:/proj",
      },
      codeIntent: { shouldSuggest: true },
    });
    assert.ok(result.hints.some((hint) => hint.id === "code_agent"));
  });
});
