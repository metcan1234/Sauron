const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  detectExplicitPersonaFeedback,
  applyFeedbackHintsToExtraction,
  buildFeedbackMemoryFact,
} = require("../../src/session/persona-feedback-detect");
const {
  emptySelfProfile,
  appendFeedbackLog,
  clearPersonaFeedback,
} = require("../../src/session/persona-self-profile");

describe("persona-feedback-detect", () => {
  it("detects short-response feedback for luna", () => {
    const result = detectExplicitPersonaFeedback("Luna çok kısa yazıyorsun, biraz uzat", "luna");
    assert.equal(result.isFeedback, true);
    assert.ok(result.hints.includes("responseLength_up"));
  });

  it("detects directness feedback for hiri only", () => {
    const hiri = detectExplicitPersonaFeedback("Hiri bana fazla dürüst yazmıyorsun, daha net ol", "hiri");
    assert.equal(hiri.isFeedback, true);
    assert.ok(hiri.hints.includes("directness_up"));

    const luna = detectExplicitPersonaFeedback("Hiri bana fazla dürüst yazmıyorsun", "luna");
    assert.equal(luna.hints.includes("directness_up"), false);
  });

  it("applies feedback hints to extraction sliders", () => {
    const profile = emptySelfProfile("luna");
    const extraction = applyFeedbackHintsToExtraction(
      {},
      ["responseLength_up"],
      "luna",
      profile,
    );
    assert.ok(extraction.personalitySliders.responseLength > 50);
  });

  it("appends feedback log entries", () => {
    const profile = appendFeedbackLog(emptySelfProfile("hiri"), {
      userQuote: "daha dobra ol",
      adjustment: "directness_up",
      applied: "dobra ton artırıldı",
    }, "hiri");
    assert.equal(profile.feedbackLog.length, 1);
    assert.equal(profile.feedbackLog[0].userQuote, "daha dobra ol");
  });

  it("clears feedback memory", () => {
    let profile = appendFeedbackLog(emptySelfProfile("luna"), {
      userQuote: "test",
      adjustment: "warmth_up",
      applied: "ok",
    }, "luna");
    profile = clearPersonaFeedback(profile, "luna");
    assert.equal(profile.feedbackLog.length, 0);
    assert.equal(profile.feedbackNotes.length, 0);
  });

  it("builds memory fact from notes", () => {
    const fact = buildFeedbackMemoryFact("luna", ["Can daha uzun yanıt istiyor."]);
    assert.match(fact, /Luna tercihi/);
  });
});
