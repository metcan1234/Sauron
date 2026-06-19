const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  defaultBrief,
  normalizeBrief,
  validateBrief,
  saveBrief,
  loadBrief,
  getBriefPath,
} = require("../../src/sauron/web-studio/brief-schema");

test("defaultBrief returns normalized corporate defaults", () => {
  const brief = defaultBrief();
  assert.equal(brief.template, "corporate-nextjs");
  assert.equal(brief.primaryColor, "#1e3a5f");
  assert.ok(brief.companyName.length > 0);
  assert.ok(brief.tagline.length > 0);
});

test("normalizeBrief maps alternate field names", () => {
  const brief = normalizeBrief({
    company: "Globex Inc",
    description: "Innovation at scale",
    primary: "#112233",
    accent: "#aabbcc",
  });

  assert.equal(brief.companyName, "Globex Inc");
  assert.equal(brief.tagline, "Innovation at scale");
  assert.equal(brief.primaryColor, "#112233");
  assert.equal(brief.accentColor, "#aabbcc");
});

test("validateBrief rejects invalid colors after normalization fallback", () => {
  const result = validateBrief({ companyName: "Test Co", tagline: "Hello" });
  assert.equal(result.valid, true);
  assert.equal(result.brief.companyName, "Test Co");
});

test("saveBrief and loadBrief round-trip in workspace", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "web-brief-"));
  try {
    const input = defaultBrief({ companyName: "Round Trip Ltd" });
    const saved = saveBrief(workspace, input);
    assert.equal(saved.ok, true);
    assert.equal(fs.existsSync(getBriefPath(workspace)), true);

    const loaded = loadBrief(workspace);
    assert.equal(loaded.ok, true);
    assert.equal(loaded.brief.companyName, "Round Trip Ltd");
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("loadBrief returns error when file missing", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "web-brief-missing-"));
  try {
    const loaded = loadBrief(workspace);
    assert.equal(loaded.ok, false);
    assert.match(loaded.error, /not found/i);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
