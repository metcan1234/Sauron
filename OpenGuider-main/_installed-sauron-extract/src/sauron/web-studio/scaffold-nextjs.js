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

const PLACEHOLDER_MAP = {
  "{{COMPANY_NAME}}": (brief) => brief.companyName,
  "{{TAGLINE}}": (brief) => brief.tagline,
  "{{PRIMARY_COLOR}}": (brief) => brief.primaryColor,
  "{{ACCENT_COLOR}}": (brief) => brief.accentColor,
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
]);

function getTemplateRoot(templateName = "corporate-nextjs") {
  return path.join(__dirname, "../../../templates", templateName);
}

function injectPlaceholders(content, brief) {
  let result = String(content);
  for (const [token, resolver] of Object.entries(PLACEHOLDER_MAP)) {
    result = result.split(token).join(resolver(brief));
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
  PLACEHOLDER_MAP,
};
