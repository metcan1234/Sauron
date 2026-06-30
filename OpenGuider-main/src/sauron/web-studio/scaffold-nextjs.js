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
} = require("./industry-content");

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
]);

function getTemplateRoot(templateName = "corporate-nextjs") {
  return path.join(__dirname, "../../../templates", templateName);
}

function buildPlaceholderMap(brief) {
  const enriched = enrichBriefPlaceholders(brief);
  const map = {
    "{{COMPANY_NAME}}": enriched.companyName,
    "{{TAGLINE}}": enriched.tagline,
    "{{PRIMARY_COLOR}}": enriched.primaryColor,
    "{{ACCENT_COLOR}}": enriched.accentColor,
  };

  for (const [key, value] of Object.entries(enriched)) {
    if (value == null || typeof value === "object") {
      continue;
    }
    map[`{{${key}}}`] = String(value);
    map[`{{${key.toUpperCase()}}}`] = String(value);
  }

  return map;
}

function injectPlaceholders(content, brief) {
  let result = String(content);
  const replacements = buildPlaceholderMap(brief);
  for (const [token, value] of Object.entries(replacements)) {
    result = result.split(token).join(value);
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

function writeQualityChecklist(workspacePath, brief) {
  const sauronDir = path.join(workspacePath, ".sauron");
  fs.mkdirSync(sauronDir, { recursive: true });

  const checklistPath = path.join(sauronDir, "web-quality-checklist.md");
  const items = generateQualityChecklist(brief);
  fs.writeFileSync(checklistPath, exportChecklistMarkdown(items), "utf8");

  return checklistPath;
}

function writeSiteDataFile(workspacePath, brief) {
  const siteDataPath = path.join(workspacePath, "lib", "site-data.ts");
  fs.mkdirSync(path.dirname(siteDataPath), { recursive: true });
  fs.writeFileSync(siteDataPath, buildSiteDataSource(brief), "utf8");
  return siteDataPath;
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
  const siteDataPath = writeSiteDataFile(resolvedPath, validation.brief);

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
    rulesPath: rulesResult.path,
    rulesSeeded: rulesResult.seeded,
    checklistPath,
    copiedFiles,
  };
}

module.exports = {
  getTemplateRoot,
  injectPlaceholders,
  copyTemplateRecursive,
  scaffoldNextjs,
  buildPlaceholderMap,
};
