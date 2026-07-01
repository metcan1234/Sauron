const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  parseRelationshipExtraction,
  hasExtractionContent,
  mergeExtractionIntoProfile,
} = require("../../src/session/luna-relationship-extract");
const { emptyProfile } = require("../../src/session/luna-relationship");

describe("luna-relationship-extract", () => {
  it("parses JSON from model output", () => {
    const parsed = parseRelationshipExtraction(
      'Sure!\n{"aboutUser":["Can gece çalışır"],"aboutUs":[],"lunaSelfNotes":[]}',
    );
    assert.deepEqual(parsed.aboutUser, ["Can gece çalışır"]);
    assert.deepEqual(parsed.aboutUs, []);
  });

  it("returns empty arrays for invalid JSON", () => {
    const parsed = parseRelationshipExtraction("no json here");
    assert.deepEqual(parsed, { aboutUser: [], aboutUs: [], lunaSelfNotes: [] });
  });

  it("detects extraction content", () => {
    assert.equal(hasExtractionContent({ aboutUser: ["x"], aboutUs: [], lunaSelfNotes: [] }), true);
    assert.equal(hasExtractionContent({ aboutUser: [], aboutUs: [], lunaSelfNotes: [] }), false);
  });

  it("merges extraction into profile", () => {
    const merged = mergeExtractionIntoProfile(emptyProfile(), {
      aboutUser: ["Can müzik dinler"],
      aboutUs: ["Film geceleri"],
      lunaSelfNotes: ["Kısa not"],
    });
    assert.ok(merged.aboutUser.includes("Can müzik dinler"));
    assert.ok(merged.aboutUs.includes("Film geceleri"));
    assert.ok(merged.lunaSelfNotes.includes("Kısa not"));
  });
});
