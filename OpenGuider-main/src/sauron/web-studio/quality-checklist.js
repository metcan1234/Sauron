const CHECKLIST_VERSION = "1.0.0";

function generateQualityChecklist(brief = {}) {
  const company = brief.companyName || "the site";

  return [
    {
      id: "a11y-skip-link",
      category: "accessibility",
      label: "Skip link present and functional",
      description: "Verify keyboard users can skip navigation to main content.",
    },
    {
      id: "a11y-headings",
      category: "accessibility",
      label: "Heading hierarchy is logical",
      description: "Each page should have one h1 and nested headings without skips.",
    },
    {
      id: "a11y-forms",
      category: "accessibility",
      label: "Form labels associated with inputs",
      description: "Contact form fields must have visible labels and focus states.",
    },
    {
      id: "mobile-nav",
      category: "responsive",
      label: "Mobile navigation works",
      description: "Hamburger menu opens, closes, and links are tappable on small screens.",
    },
    {
      id: "mobile-layout",
      category: "responsive",
      label: "Layouts reflow without horizontal scroll",
      description: "Test home, about, services, and contact at 320px width.",
    },
    {
      id: "next-image",
      category: "performance",
      label: "Images use next/image where applicable",
      description: "Replace any raw img tags with optimized Next.js Image components.",
    },
    {
      id: "metadata",
      category: "seo",
      label: "Page metadata complete",
      description: `Titles and descriptions reflect ${company} branding on all routes.`,
    },
    {
      id: "sitemap-robots",
      category: "seo",
      label: "sitemap.ts and robots.ts configured",
      description: "Update example.com URLs to production domain before launch.",
    },
    {
      id: "brand-colors",
      category: "branding",
      label: "Brand colors applied via CSS variables",
      description: `Primary ${brief.primaryColor || "#2563eb"} and accent ${brief.accentColor || "#06b6d4"} visible in UI.`,
    },
    {
      id: "build-pass",
      category: "quality",
      label: "Production build succeeds",
      description: "Run npm run build with zero TypeScript and ESLint errors.",
    },
    {
      id: "no-inline-styles",
      category: "quality",
      label: "No inline styles in components",
      description: "All styling should use Tailwind classes or globals.css tokens.",
    },
    {
      id: "contact-flow",
      category: "functional",
      label: "Contact form submits or shows confirmation",
      description: "Wire form to backend or email service before go-live.",
    },
    {
      id: "visual-theme-fonts",
      category: "branding",
      label: "Tema fontları yüklü",
      description: "layout.tsx içinde display font değişkenleri ve data-theme ile uyumlu tipografi.",
    },
    {
      id: "visual-hero-asset",
      category: "branding",
      label: "Hero görsel veya pattern",
      description: "Hero bölümünde next/image veya public/ altında görsel kullanımı.",
    },
    {
      id: "visual-tr-cta",
      category: "branding",
      label: "Türkçe birincil CTA",
      description: "Hero ve CTA bandında Türkçe buton metinleri (site-data.ctaPrimary).",
    },
    {
      id: "visual-card-consistency",
      category: "branding",
      label: "Kart gölge ve radius tutarlılığı",
      description: "card-elevated sınıfı ve tema CSS değişkenleri (--radius-card, --shadow-card) kullanımı.",
    },
    {
      id: "visual-site-data",
      category: "quality",
      label: "lib/site-data.ts mevcut",
      description: "Sektör içeriği site-data üzerinden bileşenlere akıyor.",
    },
  ];
}

function exportChecklistMarkdown(items = [], options = {}) {
  const title = options.title || "Web Quality Checklist";
  const version = options.version || CHECKLIST_VERSION;
  const lines = [
    `# ${title}`,
    "",
    `Version: ${version}`,
    "",
    "Use this checklist before launching the corporate site.",
    "",
  ];

  const categories = [...new Set(items.map((item) => item.category))];

  for (const category of categories) {
    lines.push(`## ${category.charAt(0).toUpperCase()}${category.slice(1)}`);
    lines.push("");

    const categoryItems = items.filter((item) => item.category === category);
    for (const item of categoryItems) {
      lines.push(`- [ ] **${item.label}** — ${item.description}`);
    }

    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

module.exports = {
  CHECKLIST_VERSION,
  generateQualityChecklist,
  exportChecklistMarkdown,
};
