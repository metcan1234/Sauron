const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const { scaffoldNextjs } = require("../../src/sauron/web-studio/scaffold-nextjs");

test("scaffoldNextjs writes lib/site-data.ts with industry content", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "site-data-"));
  try {
    const result = scaffoldNextjs(workspace, {
      companyName: "Site Data A.Ş.",
      industry: "finans",
      tagline: "Güvenilir finans",
      contactEmail: "info@sitedata.com",
      brandTone: "corporate",
      pages: ["home", "about", "services", "contact"],
    });
    assert.equal(result.ok, true);
    assert.equal(fs.existsSync(result.siteDataPath), true);

    const siteData = fs.readFileSync(result.siteDataPath, "utf8");
    assert.match(siteData, /Site Data A\.Ş\./);
    assert.match(siteData, /"industryKey": "finans"/);
    assert.match(siteData, /info@sitedata\.com/);

    const aboutPage = fs.readFileSync(path.join(workspace, "app", "about", "page.tsx"), "utf8");
    assert.match(aboutPage, /PAGE_ABOUT_SEO_TITLE|Hakkımızda/);
    assert.doesNotMatch(aboutPage, /title: "About"/);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

test("verify-corporate-visual passes on fresh scaffold", () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "verify-visual-"));
  try {
    const result = scaffoldNextjs(workspace, {
      companyName: "Verify Co",
      industry: "genel",
      tagline: "Kalite test",
      primaryColor: "#1e3a5f",
      accentColor: "#c9a227",
    });
    assert.equal(result.ok, true);

    const output = execFileSync(
      process.execPath,
      [path.join(workspace, "scripts", "verify-corporate-visual.js")],
      { cwd: workspace, encoding: "utf8" },
    );
    assert.match(output, /verify-corporate-visual OK/);
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});
