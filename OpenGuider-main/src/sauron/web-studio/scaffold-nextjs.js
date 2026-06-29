const fs = require("fs");
const path = require("path");
const {
  normalizeBrief,
  validateBrief,
  saveBrief,
} = require("./brief-schema");
const { seedWebDevRules } = require("./web-dev-rules");
const {
  generateQualityChecklist,
  exportChecklistMarkdown,
} = require("./quality-checklist");
const {
  buildSiteDataSource,
  enrichBriefPlaceholders,
  mergeIndustryContent,
} = require("./industry-content");

const PLACEHOLDER_MAP = {
  "{{COMPANY_NAME}}": (brief) => brief.companyName,
  "{{TAGLINE}}": (brief) => brief.tagline,
  "{{PRIMARY_COLOR}}": (brief) => brief.primaryColor,
  "{{ACCENT_COLOR}}": (brief) => brief.accentColor,
  "{{THEME_ID}}": (brief) => brief.themeId || "kurumsal",
  "{{LOCALE}}": (brief) => brief.LOCALE || brief.locale || "tr",
  "{{INDUSTRY}}": (brief) => brief.INDUSTRY || brief.industry || "genel",
  "{{CONTACT_EMAIL}}": (brief) => brief.CONTACT_EMAIL || brief.contactEmail || "",
  "{{HERO_SUBTITLE}}": (brief) => brief.HERO_SUBTITLE || "",
  "{{CTA_PRIMARY}}": (brief) => brief.CTA_PRIMARY || "İletişime geç",
  "{{CTA_SECONDARY}}": (brief) => brief.CTA_SECONDARY || "Hizmetlerimiz",
  "{{SERVICES_EYEBROW}}": (brief) => brief.SERVICES_EYEBROW || "Hizmetlerimiz",
  "{{SERVICES_TITLE}}": (brief) => brief.SERVICES_TITLE || "Hizmetler",
  "{{ABOUT_MISSION}}": (brief) => brief.ABOUT_MISSION || "",
  "{{SKIP_LINK_TEXT}}": (brief) => brief.SKIP_LINK_TEXT || "Ana içeriğe geç",
  "{{PAGE_HOME_SEO_TITLE}}": (brief) => brief.PAGE_HOME_SEO_TITLE || brief.companyName,
  "{{PAGE_HOME_SEO_DESCRIPTION}}": (brief) => brief.PAGE_HOME_SEO_DESCRIPTION || brief.tagline,
  "{{PAGE_ABOUT_SEO_TITLE}}": (brief) => brief.PAGE_ABOUT_SEO_TITLE || "Hakkımızda",
  "{{PAGE_ABOUT_SEO_DESCRIPTION}}": (brief) => brief.PAGE_ABOUT_SEO_DESCRIPTION || brief.tagline,
  "{{PAGE_SERVICES_SEO_TITLE}}": (brief) => brief.PAGE_SERVICES_SEO_TITLE || "Hizmetler",
  "{{PAGE_SERVICES_SEO_DESCRIPTION}}": (brief) => brief.PAGE_SERVICES_SEO_DESCRIPTION || brief.tagline,
  "{{PAGE_CONTACT_SEO_TITLE}}": (brief) => brief.PAGE_CONTACT_SEO_TITLE || "İletişim",
  "{{PAGE_CONTACT_SEO_DESCRIPTION}}": (brief) => brief.PAGE_CONTACT_SEO_DESCRIPTION || brief.tagline,
  "{{PAGE_BLOG_SEO_TITLE}}": (brief) => brief.PAGE_BLOG_SEO_TITLE || "Blog",
  "{{PAGE_BLOG_SEO_DESCRIPTION}}": (brief) => brief.PAGE_BLOG_SEO_DESCRIPTION || brief.tagline,
};

const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".css",
  ".mjs",
  ".html",
  ".svg",
]);

function getTemplateRoot(templateName = "corporate-nextjs") {
  return path.join(__dirname, "../../../templates", templateName);
}

function injectPlaceholders(content, brief) {
  const enriched = enrichBriefPlaceholders(brief);
  let result = String(content);
  for (const [token, resolver] of Object.entries(PLACEHOLDER_MAP)) {
    result = result.split(token).join(String(resolver(enriched) ?? ""));
  }
  return result;
}

function shouldInject(filePath) {
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function copyTemplateRecursive(sourceDir, targetDir, brief) {
  fs.mkdirSync(targetDir, { recursive: true });

  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  const copiedFiles = [];

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copiedFiles.push(...copyTemplateRecursive(sourcePath, targetPath, brief));
      continue;
    }

    if (shouldInject(entry.name)) {
      const raw = fs.readFileSync(sourcePath, "utf8");
      fs.writeFileSync(targetPath, injectPlaceholders(raw, brief), "utf8");
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }

    copiedFiles.push(targetPath);
  }

  return copiedFiles;
}

function writeSiteDataModule(workspacePath, brief) {
  const libDir = path.join(workspacePath, "lib");
  fs.mkdirSync(libDir, { recursive: true });
  const siteDataPath = path.join(libDir, "site-data.ts");
  fs.writeFileSync(siteDataPath, buildSiteDataSource(brief), "utf8");
  return siteDataPath;
}

function applyBlogRoutePolicy(workspacePath, brief) {
  const merged = mergeIndustryContent(brief);
  const blogDir = path.join(workspacePath, "app", "blog");
  if (!merged.includeBlog && fs.existsSync(blogDir)) {
    fs.rmSync(blogDir, { recursive: true, force: true });
    return { removed: true };
  }
  return { removed: false };
}

function writeQualityChecklist(workspacePath, brief) {
  const sauronDir = path.join(workspacePath, ".sauron");
  fs.mkdirSync(sauronDir, { recursive: true });

  const checklistPath = path.join(sauronDir, "web-quality-checklist.md");
  const items = generateQualityChecklist(brief);
  fs.writeFileSync(checklistPath, exportChecklistMarkdown(items), "utf8");

  return checklistPath;
}

function scaffoldNextjs(workspacePath, briefInput = {}, options = {}) {
  const resolvedPath = String(workspacePath || "").trim();
  if (!resolvedPath) {
    return { ok: false, error: "Workspace path is missing." };
  }

  fs.mkdirSync(resolvedPath, { recursive: true });

  const brief = normalizeBrief(briefInput);
  const validation = validateBrief(brief);
  if (!validation.valid) {
    return { ok: false, errors: validation.errors };
  }

  const templateName = options.template || brief.template || "corporate-nextjs";
  const templateRoot = getTemplateRoot(templateName);

  if (!fs.existsSync(templateRoot)) {
    return { ok: false, error: `Template not found: ${templateName}` };
  }

  const copiedFiles = copyTemplateRecursive(templateRoot, resolvedPath, validation.brief);
  const siteDataPath = writeSiteDataModule(resolvedPath, validation.brief);
  const blogPolicy = applyBlogRoutePolicy(resolvedPath, validation.brief);

  const briefResult = saveBrief(resolvedPath, validation.brief);
  if (!briefResult.ok) {
    return { ok: false, errors: briefResult.errors || [briefResult.error] };
  }

  const rulesResult = seedWebDevRules(resolvedPath);
  const checklistPath = writeQualityChecklist(resolvedPath, validation.brief);

  return {
    ok: true,
    workspacePath: resolvedPath,
    template: templateName,
    briefPath: briefResult.path,
    siteDataPath,
    blogRoute: blogPolicy,
    rulesPath: rulesResult.path,
    rulesSeeded: rulesResult.seeded,
    checklistPath,
    copiedFiles: [...copiedFiles, siteDataPath],
  };
}

module.exports = {
  getTemplateRoot,
  injectPlaceholders,
  copyTemplateRecursive,
  scaffoldNextjs,
  writeSiteDataModule,
  enrichBriefPlaceholders,
  PLACEHOLDER_MAP,
};
