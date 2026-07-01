const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { migrateLegacyPreset } = require("../../../src/ai/personas");
const {
  ASSISTANT_CHAT_PROMPT,
  composeSystemPrompt,
} = require("../../../src/ai/system-prompt");

describe("composeSystemPrompt", () => {
  it("starts with core identity and includes memory facts after persona layers", () => {
    const prompt = composeSystemPrompt({
      settings: {
        ownerName: "Can",
        activePersonaId: "luna",
        userMemoryFacts: ["Adım Can", "Tercih ettiğim dil Türkçe"],
      },
    });

    assert.match(prompt, /ÇEKİRDEK KİMLİK/);
    assert.match(prompt, /AKTİF PERSONA: LUNA/);
    assert.match(prompt, /Kullanıcı hafızası:/);
    assert.match(prompt, /Adım Can/);
    assert.ok(prompt.indexOf("ÇEKİRDEK KİMLİK") < prompt.indexOf("AKTİF PERSONA: LUNA"));
    assert.ok(prompt.indexOf("AKTİF PERSONA: LUNA") < prompt.indexOf("Kullanıcı hafızası:"));
  });

  it("layers custom override on top of persona", () => {
    const prompt = composeSystemPrompt({
      settings: {
        activePersonaId: "hiri",
        systemPromptOverride: "Her zaman emoji kullanma.",
      },
    });

    assert.match(prompt, /AKTİF PERSONA: HİRİ/);
    assert.match(prompt, /Her zaman emoji kullanma/);
    assert.doesNotMatch(prompt, /AKTİF PERSONA: LUNA/);
  });

  it("includes chat mode overlay and persona-aware intro directive when requested", () => {
    const prompt = composeSystemPrompt({
      settings: {
        assistantName: "Hiri",
        activePersonaId: "hiri",
        introOnNewChat: true,
      },
      modeOverlay: ASSISTANT_CHAT_PROMPT,
      introDirective: true,
    });

    assert.match(prompt, /Sen Can/);
    assert.match(prompt, /ASSISTANT CHAT MODE:/);
    assert.match(prompt, /INTRO REQUEST:/);
    assert.match(prompt, /Introduce yourself briefly as Hiri/);
    assert.match(prompt, /direct, no-nonsense abla tone/);
  });

  it("skips intro directive when introOnNewChat is disabled", () => {
    const prompt = composeSystemPrompt({
      settings: {
        introOnNewChat: false,
      },
      introDirective: true,
    });

    assert.doesNotMatch(prompt, /INTRO REQUEST:/);
  });

  it("includes owner name in core identity", () => {
    const prompt = composeSystemPrompt({
      settings: {
        ownerName: "Can",
        activePersonaId: "luna",
        assistantName: "Luna",
      },
    });

    assert.match(prompt, /Sen Can'ın kişisel masaüstü asistanısın/);
    assert.match(prompt, /Adın Luna/);
  });

  it("keeps POINT and workspace rules for both personas", () => {
    for (const activePersonaId of ["luna", "hiri"]) {
      const prompt = composeSystemPrompt({ settings: { activePersonaId } });
      assert.match(prompt, /\[POINT:x,y:label\]/);
      assert.match(prompt, /Çalışma Kısmı/);
    }
  });

  it("includes Luna mature block only when enabled", () => {
    const enabled = composeSystemPrompt({
      settings: {
        activePersonaId: "luna",
        lunaMatureContentEnabled: true,
      },
    });
    const disabled = composeSystemPrompt({
      settings: {
        activePersonaId: "luna",
        lunaMatureContentEnabled: false,
      },
    });

    assert.match(enabled, /Samimi \/ yetişkin konuşma/);
    assert.doesNotMatch(disabled, /Samimi \/ yetişkin konuşma/);
  });

  it("omits persona layers when includePersona is false", () => {
    const prompt = composeSystemPrompt({
      settings: { activePersonaId: "luna" },
      includePersona: false,
    });

    assert.match(prompt, /ÇEKİRDEK KİMLİK/);
    assert.doesNotMatch(prompt, /AKTİF PERSONA: LUNA/);
    assert.doesNotMatch(prompt, /PAYLAŞILAN DAVRANIŞ KURALLARI/);
  });

  it("migrates legacy personality presets to personas", () => {
    assert.equal(migrateLegacyPreset("sauron-default"), "luna");
    assert.equal(migrateLegacyPreset("samimi"), "luna");
    assert.equal(migrateLegacyPreset("mentor"), "hiri");

    const prompt = composeSystemPrompt({
      settings: {
        personalityPreset: "minimal",
      },
    });
    assert.match(prompt, /AKTİF PERSONA: HİRİ/);
  });

  it("includes personality slider and feedback blocks for panel chat", () => {
    const prompt = composeSystemPrompt({
      settings: {
        activePersonaId: "luna",
        personalitySliders: {
          responseLength: 10,
          warmth: 90,
          flirtiness: 80,
          emoji: 5,
        },
        personalityFeedbackNotes: ["Çok uzun yazma", "Emoji kullanma"],
      },
    });

    assert.match(prompt, /KİŞİLİK AYARLARI/);
    assert.match(prompt, /very concise/);
    assert.match(prompt, /Çok uzun yazma/);
    assert.match(prompt, /Emoji kullanma/);
  });

  it("includes luna mature local preference note when enabled", () => {
    const prompt = composeSystemPrompt({
      settings: {
        activePersonaId: "luna",
        lunaMatureContentEnabled: true,
        lunaMaturePreferLocal: true,
      },
    });

    assert.match(prompt, /Ollama|yerel model/i);
  });

  it("omits scenario block when includePersona is false", () => {
    const prompt = composeSystemPrompt({
      settings: { activePersonaId: "luna", activeScenarioId: "gece-sohbeti" },
      includePersona: false,
    });
    assert.doesNotMatch(prompt, /AKTİF SENARYO/);
  });

  it("includes Luna relationship block when enabled for panel chat", () => {
    const enabled = composeSystemPrompt({
      settings: {
        activePersonaId: "luna",
        lunaRelationshipEnabled: true,
        lunaRelationshipProfile: {
          stage: "warming",
          messageCount: 25,
          aboutUser: ["Can kahve sever"],
        },
      },
    });
    const disabled = composeSystemPrompt({
      settings: {
        activePersonaId: "luna",
        lunaRelationshipEnabled: false,
        lunaRelationshipProfile: { aboutUser: ["Can kahve sever"] },
      },
    });
    const hiriPrompt = composeSystemPrompt({
      settings: {
        activePersonaId: "hiri",
        lunaRelationshipEnabled: true,
        lunaRelationshipProfile: { aboutUser: ["Can kahve sever"] },
      },
    });

    assert.match(enabled, /İLİŞKİ HAFIZASI/);
    assert.match(enabled, /Can kahve sever/);
    assert.doesNotMatch(disabled, /İLİŞKİ HAFIZASI/);
    assert.doesNotMatch(hiriPrompt, /İLİŞKİ HAFIZASI/);
  });
});
