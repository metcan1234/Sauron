const test = require("node:test");
const assert = require("node:assert/strict");

const {
  generateQualityChecklist,
  exportChecklistMarkdown,
} = require("../../src/sauron/web-studio/quality-checklist");

test("generateQualityChecklist returns categorized items", () => {
  const items = generateQualityChecklist({
    companyName: "Acme",
    primaryColor: "#2563eb",
    accentColor: "#06b6d4",
  });

  assert.ok(items.length >= 16);
  assert.ok(items.some((item) => item.id === "visual-site-data"));
  assert.ok(items.some((item) => item.id === "visual-tr-cta"));
  assert.ok(items.every((item) => item.id && item.category && item.label));
  assert.ok(items.some((item) => item.category === "accessibility"));
  assert.ok(items.some((item) => item.category === "seo"));
});

test("exportChecklistMarkdown renders markdown checkboxes", () => {
  const items = generateQualityChecklist({ companyName: "Acme" });
  const markdown = exportChecklistMarkdown(items);

  assert.match(markdown, /^# Web Quality Checklist/m);
  assert.match(markdown, /- \[ \] \*\*Skip link present and functional\*\*/);
  assert.match(markdown, /## Accessibility/);
  assert.match(markdown, /## Seo/i);
});

test("exportChecklistMarkdown includes company name in metadata item", () => {
  const items = generateQualityChecklist({ companyName: "Globex" });
  const markdown = exportChecklistMarkdown(items);
  assert.match(markdown, /Globex/);
});
