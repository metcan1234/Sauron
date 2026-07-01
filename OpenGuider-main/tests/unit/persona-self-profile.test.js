const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  emptySelfProfile,
  normalizeSelfProfile,
  mergeSlidersGradually,
  recordSelfTuneMessage,
  shouldRunSelfTuningExtract,
  applySelfTuningExtraction,
  getPersonaSelfProfileState,
} = require("../../src/session/persona-self-profile");
const { applyPersonaSelfProfile } = require("../../src/routing/persona-self-settings");

describe("persona-self-profile", () => {
  it("normalizes luna and hiri slider shapes", () => {
    const luna = normalizeSelfProfile({}, "luna");
    assert.ok(luna.personalitySliders.flirtiness !== undefined);
    const hiri = normalizeSelfProfile({}, "hiri");
    assert.equal(hiri.personalitySliders.flirtiness, undefined);
    assert.ok(hiri.personalitySliders.warmth !== undefined);
  });

  it("merges sliders gradually with max delta", () => {
    const merged = mergeSlidersGradually(
      { responseLength: 50, warmth: 50, flirtiness: 50, emoji: 30 },
      { responseLength: 90, warmth: 10, flirtiness: 80, emoji: 30 },
      "luna",
    );
    assert.equal(merged.responseLength, 58);
    assert.equal(merged.warmth, 42);
    assert.equal(merged.flirtiness, 58);
  });

  it("runs extract every third message", () => {
    let profile = emptySelfProfile("luna");
    profile = recordSelfTuneMessage(profile, "luna");
    assert.equal(shouldRunSelfTuningExtract(profile), false);
    profile = recordSelfTuneMessage(profile, "luna");
    assert.equal(shouldRunSelfTuningExtract(profile), false);
    profile = recordSelfTuneMessage(profile, "luna");
    assert.equal(shouldRunSelfTuningExtract(profile), true);
  });

  it("applies extraction respecting locks", () => {
    const profile = normalizeSelfProfile({ tuneCount: 1, messageCount: 3 }, "luna");
    const merged = applySelfTuningExtraction(
      profile,
      {
        personalitySliders: { warmth: 90 },
        planNote: "Can yorgundu, daha sıcak olayım",
      },
      "luna",
      { personalitySliders: true },
    );
    assert.notEqual(merged.personalitySliders.warmth, 90);
    assert.equal(merged.planNote, "Can yorgundu, daha sıcak olayım");
  });

  it("applyPersonaSelfProfile uses self profile when tuned", () => {
    const base = {
      activePersonaId: "luna",
      lunaSelfTuningEnabled: true,
      personalitySliders: { responseLength: 50, warmth: 50, flirtiness: 50, emoji: 30 },
      activeScenarioId: "",
      lunaSelfProfile: {
        tuneCount: 2,
        personalitySliders: { responseLength: 70, warmth: 80, flirtiness: 60, emoji: 20 },
        activeScenarioId: "gece-sohbeti",
        planNote: "Gece modu",
      },
      lunaSelfProfileLocks: {},
    };
    const effective = applyPersonaSelfProfile(base, { includePersona: true });
    assert.equal(effective.personalitySliders.warmth, 80);
    assert.equal(effective.activeScenarioId, "gece-sohbeti");
    assert.equal(effective._personaSelfPlanNote, "Gece modu");
  });

  it("applyPersonaSelfProfile skips when includePersona false", () => {
    const base = {
      activePersonaId: "luna",
      lunaSelfTuningEnabled: true,
      lunaSelfProfile: { tuneCount: 2, personalitySliders: { warmth: 99 } },
    };
    const effective = applyPersonaSelfProfile(base, { includePersona: false });
    assert.equal(effective.lunaSelfProfile.tuneCount, 2);
    assert.equal(effective._personaSelfPlanNote, undefined);
  });

  it("getPersonaSelfProfileState reflects enabled flag", () => {
    const state = getPersonaSelfProfileState({
      activePersonaId: "hiri",
      hiriSelfTuningEnabled: true,
      hiriSelfProfile: { tuneCount: 1, messageCount: 3 },
    }, "hiri");
    assert.equal(state.enabled, true);
    assert.equal(state.tuneCount, 1);
  });
});
