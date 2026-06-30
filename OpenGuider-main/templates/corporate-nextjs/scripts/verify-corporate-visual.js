#!/usr/bin/env node
/**
 * Zero-token corporate visual quality gate.
 * Run from Next.js workspace root: node scripts/verify-corporate-visual.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const errors = [];

function read(filePath) {
  try {
    return fs.readFileSync(path.join(ROOT, filePath), "utf8");
  } catch {
    return "";
  }
}

function exists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

function fail(message) {
  errors.push(message);
}

function checkLangTr() {
  const layout = read("app/layout.tsx");
  if (!/lang=["']tr["']/.test(layout)) {
    fail("layout.tsx must set lang=\"tr\"");
  }
}

function checkNoEnglishNav() {
  const navbar = read("components/Navbar.tsx");
  if (/\bHome\b/.test(navbar) || /\bAbout\b/.test(navbar)) {
    fail("Navbar still contains English nav labels");
  }
}

function checkPublicAssets() {
  const publicDir = path.join(ROOT, "public");
  if (!fs.existsSync(publicDir)) {
    fail("public/ directory missing");
    return;
  }
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.push(full);
    }
  }
  walk(publicDir);
  const visual = files.filter((f) => /\.(svg|png|jpg|webp|gif)$/i.test(f));
  if (visual.length < 1) {
    fail("public/ must contain at least one image asset");
  }
}

function checkSiteData() {
  if (!exists("lib/site-data.ts")) {
    fail("lib/site-data.ts missing");
    return;
  }
  const content = read("lib/site-data.ts");
  if (!content.includes("export const siteData")) {
    fail("lib/site-data.ts must export siteData");
  }
}

function checkPageSeoMetadata() {
  const about = read("app/about/page.tsx");
  if (!about.includes("export const metadata") || about.includes('title: "About"')) {
    fail("about/page.tsx metadata not localized");
  }
}

function checkNoInlineStyles() {
  const componentsDir = path.join(ROOT, "components");
  if (!fs.existsSync(componentsDir)) return;
  for (const file of fs.readdirSync(componentsDir)) {
    if (!file.endsWith(".tsx")) continue;
    const content = fs.readFileSync(path.join(componentsDir, file), "utf8");
    if (/style=\{\{/.test(content)) {
      fail(`Inline styles found in components/${file}`);
    }
  }
}

function checkNextImageUsage() {
  let found = false;
  const dirs = ["components", "app"];
  for (const dir of dirs) {
    const fullDir = path.join(ROOT, dir);
    if (!fs.existsSync(fullDir)) continue;
    const stack = [fullDir];
    while (stack.length) {
      const current = stack.pop();
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) stack.push(full);
        else if (entry.name.endsWith(".tsx")) {
          const content = fs.readFileSync(full, "utf8");
          if (content.includes("next/image") || content.includes('from "next/image"')) {
            found = true;
          }
        }
      }
    }
  }
  if (!found) {
    fail("At least one component must use next/image");
  }
}

function checkTurkishCta() {
  const hero = read("components/Hero.tsx");
  if (/\bGet started\b/i.test(hero) || /\bView services\b/i.test(hero)) {
    fail("Hero still contains English CTAs");
  }
}

function main() {
  checkLangTr();
  checkNoEnglishNav();
  checkPublicAssets();
  checkSiteData();
  checkPageSeoMetadata();
  checkNoInlineStyles();
  checkNextImageUsage();
  checkTurkishCta();

  if (errors.length) {
    console.error("verify-corporate-visual FAILED:");
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }
  console.log("verify-corporate-visual OK");
  process.exit(0);
}

main();
