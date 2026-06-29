const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  injectPlaceholders,
  scaffoldNextjs,
  getTemplateRoot,
} = require("../../src/sauron/web-studio/scaffold-nextjs");
const { detectNextProject } = require("../../src/sauron/web-studio/project-status");

test("getTemplateRoot points to corporate-nextjs template", () => {
  const root = getTemplateRoot("corporate-nextjs");
  assert.equal(fs.existsSync(root), true);
  assert.equal(fs.existsSync(path.join(root, "package.json")), true);
});

test("injectPlaceholders replaces all scaffold tokens", () => {
  const brief = {
    companyName: "Nova Corp",
    tagline: "Future ready",
    primaryColor: "#111111",
    accentColor: "#eeeeee",
  };

  const output = injectPlaceholders(
    "{{COMPANY_NAME}} — {{TAGLINE}} / {{PRIMARY_COLOR}} / {{ACCENT_COLOR}}",
    brief,
  );

  assert.equal(output, "Nova Corp — Future ready / #111111 / #eeeeee");
});

test("scaffoldNextjs copies template and injects brief", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "scaffold-next-"));
  try {
    const result = scaffoldNextjs(workspace, {
      companyName: "Scaffold Test Co",
      tagline: "Built with Sauron",
      primaryColor: "#0ea5e9",
      accentColor: "#f97316",
    });

    assert.equal(result.ok, true);
    assert.equal(fs.existsSync(path.join(workspace, "package.json")), true);
    assert.equal(fs.existsSync(path.join(workspace, "app", "page.tsx")), true);
    assert.equal(fs.existsSync(path.join(workspace, ".sauron", "web-brief.json")), true);
    assert.equal(fs.existsSync(path.join(workspace, ".clinerules", "sauron-web-dev.md")), true);
    assert.equal(fs.existsSync(path.join(workspace, ".sauron", "web-quality-checklist.md")), true);
    assert.equal(fs.existsSync(path.join(workspace, "lib", "site-data.ts")), true);
    assert.equal(fs.existsSync(path.join(workspace, "public", "placeholders", "hero-abstract.svg")), true);

    const layout = fs.readFileSync(path.join(workspace, "app", "layout.tsx"), "utf8");
    assert.match(layout, /Scaffold Test Co/);
    assert.doesNotMatch(layout, /\{\{COMPANY_NAME\}\}/);

    const globals = fs.readFileSync(path.join(workspace, "app", "globals.css"), "utf8");
    assert.match(globals, /#0ea5e9/);
    assert.match(globals, /#f97316/);

    const status = detectNextProject(workspace);
    assert.equal(status.isNext, true);
    assert.equal(status.hasAppRouter, true);
    assert.equal(status.hasWebBrief, true);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("scaffoldNextjs returns error for missing template", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "scaffold-missing-"));
  try {
    const result = scaffoldNextjs(workspace, defaultBrief(), { template: "nonexistent-template" });
    assert.equal(result.ok, false);
    assert.match(result.error, /Template not found/i);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

function defaultBrief() {
  return {
    companyName: "Test",
    tagline: "Test tagline",
    primaryColor: "#2563eb",
    accentColor: "#06b6d4",
  };
}
