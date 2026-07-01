const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  emptyProfile,
  normalizeProfile,
  computeRelationshipStage,
  recordLunaMessage,
  applyRelationshipExtraction,
  buildLunaRelationshipBlock,
  getLunaRelationshipState,
  mergeRelationshipLists,
} = require("../../src/session/luna-relationship");

describe("luna-relationship", () => {
  it("starts at new stage with empty profile", () => {
    const profile = emptyProfile();
    assert.equal(profile.stage, "new");
    assert.equal(profile.messageCount, 0);
    assert.deepEqual(profile.aboutUser, []);
  });

  it("computes stage from message count and facts", () => {
    assert.equal(computeRelationshipStage({ messageCount: 5 }), "new");
    assert.equal(computeRelationshipStage({ messageCount: 25 }), "warming");
    assert.equal(computeRelationshipStage({ messageCount: 70 }), "close");
    assert.equal(computeRelationshipStage({ messageCount: 200 }), "deep");
    assert.equal(computeRelationshipStage({ messageCount: 10, aboutUser: ["a", "b", "c"] }), "warming");
  });

  it("records messages and advances stage milestones", () => {
    let profile = emptyProfile();
    for (let i = 0; i < 21; i += 1) {
      profile = recordLunaMessage(profile);
    }
    assert.equal(profile.messageCount, 21);
    assert.equal(profile.stage, "warming");
    assert.ok(profile.firstSeenAt);
    assert.ok(profile.lastMessageAt);
    assert.ok(profile.milestones.some((entry) => entry.label.includes("Isınıyoruz")));
  });

  it("merges extraction lists without duplicates", () => {
    const merged = mergeRelationshipLists(["Kahve sever"], ["Kahve sever", "Gece kuşu"]);
    assert.deepEqual(merged, ["Kahve sever", "Gece kuşu"]);
  });

  it("applies relationship extraction and recomputes stage", () => {
    let profile = normalizeProfile({ messageCount: 60, aboutUser: ["Can oyun sever"] });
    profile = applyRelationshipExtraction(profile, {
      aboutUser: ["Unity projesi yapıyor"],
      aboutUs: ["Gece sohbetleri"],
      lunaSelfNotes: ["Bugün biraz yorgunum"],
    });
    assert.ok(profile.aboutUser.includes("Unity projesi yapıyor"));
    assert.ok(profile.aboutUs.includes("Gece sohbetleri"));
    assert.equal(profile.stage, "close");
  });

  it("builds relationship block with owner facts", () => {
    const block = buildLunaRelationshipBlock({
      stage: "warming",
      messageCount: 30,
      aboutUser: ["Can kahve içer"],
    }, "Can");
    assert.match(block, /İLİŞKİ HAFIZASI/);
    assert.match(block, /Isınıyoruz/);
    assert.match(block, /Can kahve içer/);
  });

  it("getLunaRelationshipState respects enabled flag and persona", () => {
    const enabled = getLunaRelationshipState({
      activePersonaId: "luna",
      lunaRelationshipEnabled: true,
      lunaRelationshipProfile: { messageCount: 5, stage: "new" },
    });
    assert.equal(enabled.enabled, true);
    assert.equal(enabled.messageCount, 5);

    const disabled = getLunaRelationshipState({
      activePersonaId: "hiri",
      lunaRelationshipEnabled: true,
    });
    assert.equal(disabled.enabled, false);
  });
});
