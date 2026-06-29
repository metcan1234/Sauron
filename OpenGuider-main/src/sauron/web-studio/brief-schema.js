const fs = require("fs");
const path = require("path");

const SAURON_DIR = ".sauron";
const WEB_BRIEF_FILENAME = "web-brief.json";

const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const THEME_IDS = new Set(["kurumsal", "modern", "luks"]);

const PAGE_SEO_DEFAULTS = {
  home: { seoTitle: "Ana Sayfa", seoDescription: "" },
  about: { seoTitle: "Hakkımızda", seoDescription: "" },
  services: { seoTitle: "Hizmetler", seoDescription: "" },
  contact: { seoTitle: "İletişim", seoDescription: "" },
  blog: { seoTitle: "Blog", seoDescription: "" },
};

function mapBrandToneToThemeId(brandTone) {
  const tone = String(brandTone || "").trim().toLowerCase();
  if (tone === "modern") return "modern";
  if (tone === "luxury" || tone === "luks") return "luks";
  return "kurumsal";
}

function normalizeThemeId(value, brandTone) {
  const theme = String(value || "").trim().toLowerCase();
  if (THEME_IDS.has(theme)) {
    return theme;
  }
  return mapBrandToneToThemeId(brandTone);
}

function normalizePageDetails(pages, source = {}, companyName = "", tagline = "") {
  const pageIds = Array.isArray(pages)
    ? pages.map((page) => String(page).trim()).filter(Boolean)
    : ["home", "about", "services", "contact"];

  const inputDetails = Array.isArray(source.pageDetails) ? source.pageDetails : [];
  const bySlug = new Map(
    inputDetails.map((entry) => [String(entry?.slug || "").trim(), entry]),
  );

  return pageIds.map((slug) => {
    const existing = bySlug.get(slug) || {};
    const defaults = PAGE_SEO_DEFAULTS[slug] || { seoTitle: slug, seoDescription: "" };
    const seoTitle = String(existing.seoTitle || defaults.seoTitle || slug).trim();
    const seoDescription = String(
      existing.seoDescription
      || defaults.seoDescription
      || tagline
      || `${companyName} — ${seoTitle}`,
    ).trim().slice(0, 160);
    return { slug, seoTitle, seoDescription };
  });
}

function getBriefDir(workspacePath) {
  return path.join(String(workspacePath || "").trim(), SAURON_DIR);
}

function getBriefPath(workspacePath) {
  return path.join(getBriefDir(workspacePath), WEB_BRIEF_FILENAME);
}

function defaultBrief(overrides = {}) {
  const base = {
    projectName: "",
    companyName: "Örnek Kurumsal A.Ş.",
    industry: "genel",
    tagline: "Güvenilir çözümler, modern iş dünyası",
    pages: ["home", "about", "services", "contact"],
    brand: {
      primaryColor: "#1e3a5f",
      accentColor: "#c9a227",
      tone: "corporate",
    },
    primaryColor: "#1e3a5f",
    accentColor: "#c9a227",
    brandTone: "corporate",
    locale: "tr",
    features: ["contactForm"],
    stack: "nextjs-tailwind",
    template: "corporate-nextjs",
    themeId: "kurumsal",
    pageDetails: [],
    contactEmail: "",
    createdAt: new Date().toISOString(),
  };

  return normalizeBrief({ ...base, ...overrides });
}

function normalizeBrief(input = {}) {
  const source = input && typeof input === "object" ? input : {};

  const companyName = String(
    source.companyName ?? source.company ?? source.name ?? "",
  ).trim();

  const tagline = String(source.tagline ?? source.description ?? "").trim();

  const primaryColor = normalizeColor(
    source.primaryColor ?? source.primary ?? "#2563eb",
  );

  const accentColor = normalizeColor(
    source.accentColor ?? source.accent ?? source.brand?.accentColor ?? "#c9a227",
  );

  const pages = Array.isArray(source.pages)
    ? source.pages.map((page) => String(page).trim()).filter(Boolean)
    : ["home", "about", "services", "contact"];

  const features = Array.isArray(source.features)
    ? source.features.map((item) => String(item).trim()).filter(Boolean)
    : ["contactForm"];

  const themeId = normalizeThemeId(source.themeId, source.brandTone ?? source.brand?.tone);
  const pageDetails = normalizePageDetails(
    pages,
    source,
    companyName || "Örnek Kurumsal A.Ş.",
    tagline || "Güvenilir çözümler, modern iş dünyası",
  );

  return {
    projectName: String(source.projectName || source.companyName || "").trim(),
    companyName: companyName || "Örnek Kurumsal A.Ş.",
    industry: String(source.industry || "genel").trim() || "genel",
    tagline: tagline || "Güvenilir çözümler, modern iş dünyası",
    pages,
    pageDetails,
    features,
    themeId,
    stack: String(source.stack || "nextjs-tailwind").trim(),
    brandTone: String(source.brandTone ?? source.brand?.tone ?? "corporate").trim() || "corporate",
    primaryColor,
    accentColor,
    brand: {
      primaryColor,
      accentColor,
      tone: String(source.brand?.tone ?? source.brandTone ?? "corporate").trim() || "corporate",
    },
    template: String(source.template || "corporate-nextjs").trim() || "corporate-nextjs",
    contactEmail: String(source.contactEmail ?? source.email ?? "").trim(),
    locale: String(source.locale || "tr").trim() || "tr",
    createdAt: source.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function normalizeColor(value) {
  const color = String(value || "").trim();
  if (HEX_COLOR_PATTERN.test(color)) {
    return color.toLowerCase();
  }
  return "#2563eb";
}

function validateBrief(brief) {
  const normalized = normalizeBrief(brief);
  const errors = [];

  if (!normalized.companyName) {
    errors.push("companyName is required");
  }

  if (!normalized.tagline) {
    errors.push("tagline is required");
  }

  if (!HEX_COLOR_PATTERN.test(normalized.primaryColor)) {
    errors.push("primaryColor must be a valid hex color");
  }

  if (!HEX_COLOR_PATTERN.test(normalized.accentColor)) {
    errors.push("accentColor must be a valid hex color");
  }

  if (!normalized.template) {
    errors.push("template is required");
  }

  return {
    valid: errors.length === 0,
    errors,
    brief: normalized,
  };
}

function saveBrief(workspacePath, brief) {
  const resolvedPath = String(workspacePath || "").trim();
  if (!resolvedPath) {
    return { ok: false, error: "Workspace path is missing." };
  }

  const validation = validateBrief(brief);
  if (!validation.valid) {
    return { ok: false, errors: validation.errors };
  }

  const briefDir = getBriefDir(resolvedPath);
  fs.mkdirSync(briefDir, { recursive: true });

  const briefPath = getBriefPath(resolvedPath);
  fs.writeFileSync(briefPath, `${JSON.stringify(validation.brief, null, 2)}\n`, "utf8");

  return { ok: true, path: briefPath, brief: validation.brief };
}

function loadBrief(workspacePath) {
  const briefPath = getBriefPath(workspacePath);

  if (!fs.existsSync(briefPath)) {
    return { ok: false, error: "web-brief.json not found", path: briefPath };
  }

  try {
    const raw = JSON.parse(fs.readFileSync(briefPath, "utf8"));
    const brief = normalizeBrief(raw);
    return { ok: true, path: briefPath, brief };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to parse web-brief.json",
      path: briefPath,
    };
  }
}

module.exports = {
  SAURON_DIR,
  WEB_BRIEF_FILENAME,
  THEME_IDS,
  getBriefDir,
  getBriefPath,
  defaultBrief,
  normalizeBrief,
  normalizeThemeId,
  normalizePageDetails,
  normalizeColor,
  validateBrief,
  saveBrief,
  loadBrief,
};
