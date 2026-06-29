export const siteData = {
  companyName: "{{COMPANY_NAME}}",
  tagline: "{{TAGLINE}}",
  contactEmail: "{{CONTACT_EMAIL}}",
  locale: "{{LOCALE}}",
  themeId: "{{THEME_ID}}",
  industryKey: "{{INDUSTRY}}",
  heroSubtitle: "{{HERO_SUBTITLE}}",
  ctaPrimary: "{{CTA_PRIMARY}}",
  ctaSecondary: "{{CTA_SECONDARY}}",
  servicesEyebrow: "{{SERVICES_EYEBROW}}",
  servicesTitle: "{{SERVICES_TITLE}}",
  stats: [
    { value: "15+", label: "Yıllık deneyim" },
    { value: "200+", label: "Proje" },
    { value: "%98", label: "Memnuniyet" },
    { value: "7/24", label: "Destek" },
  ],
  services: [
    { title: "Danışmanlık", description: "Stratejik yol haritaları.", icon: "strategy" },
    { title: "Dijital", description: "Modern platformlar.", icon: "digital" },
    { title: "Destek", description: "Sürekli operasyon.", icon: "managed" },
    { title: "Uyum", description: "Risk yönetimi.", icon: "compliance" },
  ],
  testimonial: {
    quote: "Güvenilir ve profesyonel bir ortaklık.",
    author: "Müşteri Temsilcisi",
    role: "Genel Müdür",
  },
  partners: ["Partner A", "Partner B", "Partner C", "Partner D"],
  aboutMission: "{{ABOUT_MISSION}}",
  aboutValues: ["Şeffaflık", "Kalite", "Ortaklık"],
  navLinks: [
    { href: "/", label: "Ana Sayfa" },
    { href: "/about", label: "Hakkımızda" },
    { href: "/services", label: "Hizmetler" },
    { href: "/contact", label: "İletişim" },
  ],
  pageDetails: [],
} as const;

export type SiteData = typeof siteData;
