const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MESSAGE_ROUTES,
  resolveMessageRoute,
  resolvePanelModeState,
} = require("../../src/routing/message-route");

test("resolveMessageRoute picks micro_guide for screen intent in assistant mode", () => {
  const result = resolveMessageRoute({
    assistantMode: "assistant",
    microIntent: { shouldSuggest: true, reason: "screen_guidance" },
    text: "whatsapp ı açmamda bana yardım et",
  });
  assert.equal(result.route, MESSAGE_ROUTES.MICRO_GUIDE);
});

test("resolveMessageRoute picks micro_guide in guide mode when intent matches", () => {
  const result = resolveMessageRoute({
    assistantMode: "guide",
    microIntent: { shouldSuggest: true, reason: "screen_guidance" },
    text: "whatsapp ı açmamda bana yardım et",
  });
  assert.equal(result.route, MESSAGE_ROUTES.MICRO_GUIDE);
});

test("resolveMessageRoute picks plan_guide in guide mode without micro intent", () => {
  const result = resolveMessageRoute({
    assistantMode: "guide",
    microIntent: { shouldSuggest: false, reason: "no_match" },
    text: "genel bir görev planı",
  });
  assert.equal(result.route, MESSAGE_ROUTES.PLAN_GUIDE);
});

test("resolveMessageRoute returns code_agent_busy when code session active", () => {
  const result = resolveMessageRoute({
    codeAgentActive: true,
    text: "fix the bug",
  });
  assert.equal(result.route, MESSAGE_ROUTES.CODE_AGENT_BUSY);
});

test("resolveMessageRoute picks code_agent when native enabled and coding intent", () => {
  const result = resolveMessageRoute({
    codeAgentNativeEnabled: true,
    workspacePath: "/tmp/project",
    codeIntent: { shouldSuggest: true, reason: "coding_keywords" },
    text: "add login page to the api",
  });
  assert.equal(result.route, MESSAGE_ROUTES.CODE_AGENT);
});

test("resolveMessageRoute picks assistant_chat for normal messages", () => {
  const result = resolveMessageRoute({
    assistantMode: "assistant",
    microIntent: { shouldSuggest: false },
    text: "merhaba nasılsın",
  });
  assert.equal(result.route, MESSAGE_ROUTES.ASSISTANT_CHAT);
});

test("resolveMessageRoute returns micro_guide_busy when session active", () => {
  const result = resolveMessageRoute({
    assistantMode: "assistant",
    microGuideActive: true,
    microIntent: { shouldSuggest: true },
    text: "devam",
  });
  assert.equal(result.route, MESSAGE_ROUTES.MICRO_GUIDE_BUSY);
});

test("resolvePanelModeState shows micro guide label when session active", () => {
  const state = resolvePanelModeState({
    assistantMode: "assistant",
    sessionSnapshot: { microGuideSession: { active: true } },
  });
  assert.equal(state.mode, "micro_guide");
  assert.match(state.label, /Mikro-tur/);
});

test("resolvePanelModeState shows plan guide when guide mode", () => {
  const state = resolvePanelModeState({
    assistantMode: "guide",
    sessionSnapshot: {},
  });
  assert.equal(state.mode, "plan_guide");
});

test("resolvePanelModeState defaults to assistant", () => {
  const state = resolvePanelModeState({
    assistantMode: "assistant",
    sessionSnapshot: {},
  });
  assert.equal(state.mode, "assistant");
});
