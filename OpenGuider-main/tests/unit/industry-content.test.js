const test = require("node:test");
const assert = require("node:assert/strict");

const {
  mergeIndustryContent,
  buildSiteDataSource,
  normalizeIndustryKey,
} = require("../../src/sauron/web-studio/industry-content");

test("normalizeIndustryKey maps aliases", () => {
  assert.equal(normalizeIndustryKey("finance"), "finans");
  assert.equal(normalizeIndustryKey("tech"), "teknoloji");
  assert.equal(normalizeIndustryKey("unknown"), "genel");
});

test("mergeIndustryContent returns Turkish services for finans", () => {
  const merged = mergeIndustryContent({
    companyName: "Test Bank",
    industry: "finans",
    tagline: "Güvenilir bankacılık",
    pages: ["home", "about"],
  });
  assert.equal(merged.industryKey, "finans");
  assert.ok(merged.services.length >= 4);
  assert.match(merged.services[0].title, /./);
  assert.equal(merged.navLinks[0].label, "Ana Sayfa");
});

test("buildSiteDataSource exports valid TypeScript", () => {
  const source = buildSiteDataSource({
    companyName: "Acme TR",
    industry: "teknoloji",
    tagline: "İnovasyon",
    pages: ["home", "contact"],
    themeId: "modern",
  });
  assert.match(source, /export const siteData/);
  assert.match(source, /Acme TR/);
  assert.match(source, /teknoloji/);
});
