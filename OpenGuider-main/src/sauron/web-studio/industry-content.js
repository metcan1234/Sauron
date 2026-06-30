const INDUSTRY_PACKS = {
  genel: {
    heroSubtitle: "Uzman ekibimizle hedeflerinize güvenle ulaşın. Strateji, uygulama ve sürdürülebilir sonuçlar tek çatı altında.",
    ctaPrimary: "İletişime geç",
    ctaSecondary: "Hizmetlerimiz",
    servicesEyebrow: "Hizmetlerimiz",
    servicesTitle: "Kurumsal ihtiyaçlarınıza özel çözümler",
    stats: [
      { value: "15+", label: "Yıllık deneyim" },
      { value: "200+", label: "Tamamlanan proje" },
      { value: "%98", label: "Müşteri memnuniyeti" },
      { value: "7/24", label: "Destek hattı" },
    ],
    services: [
      { title: "Strateji ve Danışmanlık", description: "Hedeflerinizi net KPI’larla uyumlu yol haritalarına dönüştürüyoruz.", icon: "strategy" },
      { title: "Dijital Dönüşüm", description: "Ölçeklenebilir platformlar ve güvenli entegrasyonlarla operasyonlarınızı modernleştiriyoruz.", icon: "digital" },
      { title: "Yönetilen Hizmetler", description: "Ekibiniz çekirdek işine odaklanırken sürekliliği biz sağlıyoruz.", icon: "managed" },
      { title: "Uyum ve Risk", description: "Regüle sektörlere uygun proaktif yönetişim çerçeveleri sunuyoruz.", icon: "compliance" },
    ],
    testimonial: {
      quote: "Profesyonel yaklaşımları ve şeffaf iletişimleri sayesinde hedeflerimize zamanında ulaştık.",
      author: "Ayşe Yılmaz",
      role: "Genel Müdür Yardımcısı",
    },
    partners: ["Anadolu Grup", "Ege Holding", "Marmara Tek", "Boğaziçi Ltd."],
    aboutMission: "Karmaşıklığı stratejik rehberlik ve güvenilir uygulama ile yönetilebilir hale getiriyoruz.",
    aboutValues: ["Her öneride şeffaflık", "Kaliteden ödün vermeme", "Proje sonrası da ortaklık"],
  },
  finans: {
    heroSubtitle: "Finansal güvenilirlik ve düzenleyici uyum odaklı çözümlerle kurumunuza değer katıyoruz.",
    ctaPrimary: "Görüşme talep et",
    ctaSecondary: "Çözümlerimiz",
    servicesEyebrow: "Finans çözümleri",
    servicesTitle: "Regülasyon uyumlu finansal hizmetler",
    stats: [
      { value: "₺2B+", label: "Yönetilen portföy" },
      { value: "50+", label: "Kurumsal müşteri" },
      { value: "%99.9", label: "Sistem erişilebilirliği" },
      { value: "ISO", label: "27001 sertifikalı" },
    ],
    services: [
      { title: "Risk Yönetimi", description: "Kredi, piyasa ve operasyonel riskleri bütünleşik modellerle yönetin.", icon: "risk" },
      { title: "Düzenleyici Uyum", description: "BDDK ve uluslararası standartlara tam uyum danışmanlığı.", icon: "compliance" },
      { title: "Dijital Bankacılık", description: "Müşteri deneyimini güçlendiren güvenli dijital kanallar.", icon: "digital" },
      { title: "Veri Analitiği", description: "Karar destek sistemleri ve gerçek zamanlı raporlama.", icon: "analytics" },
    ],
    testimonial: {
      quote: "Uyum süreçlerimizi hızlandırdılar; denetim hazırlığında ciddi zaman kazandık.",
      author: "Mehmet Kaya",
      role: "CFO",
    },
    partners: ["Atlas Yatırım", "Kıta Bank", "Nova Sigorta", "Prime Faktoring"],
    aboutMission: "Finansal kurumların güvenle büyümesi için teknoloji ve uyumu bir araya getiriyoruz.",
    aboutValues: ["Veri gizliliği önceliği", "Denetlenebilir süreçler", "Uzun vadeli güven"],
  },
  teknoloji: {
    heroSubtitle: "Yazılım, bulut ve yapay zeka ile ürünlerinizi hızla pazara taşıyın.",
    ctaPrimary: "Demo iste",
    ctaSecondary: "Ürünler",
    servicesEyebrow: "Teknoloji",
    servicesTitle: "Ölçeklenebilir yazılım ve altyapı",
    stats: [
      { value: "100+", label: "Canlı deployment" },
      { value: "<2sn", label: "Ortalama yanıt süresi" },
      { value: "%40", label: "Maliyet optimizasyonu" },
      { value: "24/7", label: "SRE desteği" },
    ],
    services: [
      { title: "Özel Yazılım", description: "Next.js, Node ve bulut native mimarilerle ürün geliştirme.", icon: "code" },
      { title: "Bulut Migrasyon", description: "AWS, Azure ve hibrit ortamlarda güvenli geçiş.", icon: "cloud" },
      { title: "DevOps & SRE", description: "CI/CD, gözlemlenebilirlik ve otomatik ölçeklendirme.", icon: "devops" },
      { title: "AI Entegrasyonu", description: "LLM ve otomasyon senaryoları için güvenli API katmanları.", icon: "ai" },
    ],
    testimonial: {
      quote: "MVP’den üretime 8 haftada geçtik; ekip mühendislik disiplinini hissettirdi.",
      author: "Elif Demir",
      role: "CTO",
    },
    partners: ["ByteScale", "CloudPeak", "DataForge", "NeuraLabs"],
    aboutMission: "Hızlı iterasyon ve güvenilir altyapıyı aynı çatı altında sunuyoruz.",
    aboutValues: ["Açık kaynak dostu", "Güvenlik shift-left", "Ölçülebilir teslimat"],
  },
  saglik: {
    heroSubtitle: "Hasta güvenliği ve veri gizliliği standartlarında sağlık teknolojisi çözümleri.",
    ctaPrimary: "Bilgi al",
    ctaSecondary: "Hizmetler",
    servicesEyebrow: "Sağlık",
    servicesTitle: "Klinik ve idari süreçler için dijital çözümler",
    stats: [
      { value: "1M+", label: "İşlenen kayıt" },
      { value: "KVKK", label: "Tam uyum" },
      { value: "40+", label: "Sağlık kurumu" },
      { value: "%99.5", label: "Sistem uptime" },
    ],
    services: [
      { title: "Hasta Portalları", description: "Randevu, sonuç ve iletişim için erişilebilir web/mobil deneyim.", icon: "portal" },
      { title: "Klinik Entegrasyon", description: "HL7/FHIR uyumlu veri alışverişi ve arayüzler.", icon: "integration" },
      { title: "Uyum Danışmanlığı", description: "KVKK ve sağlık regülasyonlarına uygun süreç tasarımı.", icon: "compliance" },
      { title: "Tele-Sağlık", description: "Güvenli görüntülü görüşme ve reçete akışları.", icon: "telehealth" },
    ],
    testimonial: {
      quote: "Hasta memnuniyeti skorlarımız dijital kanalları devreye aldıktan sonra belirgin arttı.",
      author: "Dr. Can Öztürk",
      role: "Başhekim",
    },
    partners: ["MedLine", "Vita Klinik", "CareNet", "Sağlık Plus"],
    aboutMission: "Sağlık profesyonellerinin iş yükünü azaltırken hasta deneyimini iyileştiriyoruz.",
    aboutValues: ["Hasta mahremiyeti", "Kanıta dayalı tasarım", "7/24 kritik destek"],
  },
  insaat: {
    heroSubtitle: "Proje yönetimi, saha koordinasyonu ve sürdürülebilir yapı çözümleri.",
    ctaPrimary: "Teklif al",
    ctaSecondary: "Projeler",
    servicesEyebrow: "İnşaat",
    servicesTitle: "Uçtan uca proje ve mühendislik hizmetleri",
    stats: [
      { value: "120+", label: "Tamamlanan proje" },
      { value: "2M m²", label: "İnşa alanı" },
      { value: "%0", label: "İş güvenliği ihlali hedefi" },
      { value: "25", label: "Yıllık tecrübe" },
    ],
    services: [
      { title: "Proje Yönetimi", description: "Zaman, maliyet ve kalite üçlüsünde uçtan uca koordinasyon.", icon: "project" },
      { title: "Mühendislik", description: "Statik, mekanik ve elektrik disiplinlerinde entegre tasarım.", icon: "engineering" },
      { title: "Saha Denetimi", description: "Dijital raporlama ve kalite kontrol süreçleri.", icon: "field" },
      { title: "Sürdürülebilirlik", description: "Enerji verimli malzeme ve yeşil bina sertifikasyonu.", icon: "green" },
    ],
    testimonial: {
      quote: "Zorlu saha koşullarında bile program ve bütçe hedeflerine sadık kaldılar.",
      author: "Burak Arslan",
      role: "Proje Direktörü",
    },
    partners: ["Yapı Merkez", "Anadolu İnşaat", "Mega Yapı", "Kule Grup"],
    aboutMission: "Güvenli, sürdürülebilir ve zamanında teslim projeler üretiyoruz.",
    aboutValues: ["İş güvenliği birinci öncelik", "Şeffaf maliyet yönetimi", "Kalıcı yapı standartları"],
  },
};

function normalizeIndustryKey(industry) {
  const key = String(industry || "genel").trim().toLowerCase();
  if (INDUSTRY_PACKS[key]) {
    return key;
  }
  const aliases = {
    finance: "finans",
    financial: "finans",
    tech: "teknoloji",
    technology: "teknoloji",
    health: "saglik",
    healthcare: "saglik",
    construction: "insaat",
    general: "genel",
  };
  return aliases[key] || "genel";
}

function getIndustryPack(industry) {
  const key = normalizeIndustryKey(industry);
  return { key, pack: INDUSTRY_PACKS[key] };
}

function mergeIndustryContent(brief = {}) {
  const { key, pack } = getIndustryPack(brief.industry);
  const companyName = String(brief.companyName || "Şirket").trim();
  const tagline = String(brief.tagline || "").trim();
  const contactEmail = String(brief.contactEmail || `info@${companyName.toLowerCase().replace(/\s+/g, "")}.com`).trim();

  const navLinks = [
    { href: "/", label: "Ana Sayfa" },
    { href: "/about", label: "Hakkımızda" },
    { href: "/services", label: "Hizmetler" },
    { href: "/contact", label: "İletişim" },
  ];
  if (Array.isArray(brief.pages) && brief.pages.includes("blog")) {
    navLinks.splice(3, 0, { href: "/blog", label: "Blog" });
  }

  const pageDetails = Array.isArray(brief.pageDetails) ? brief.pageDetails : [];
  const pageMeta = {};
  for (const detail of pageDetails) {
    const slug = String(detail.slug || "").trim();
    if (!slug) continue;
    const upper = slug.toUpperCase().replace(/-/g, "_");
    pageMeta[`PAGE_${upper}_SEO_TITLE`] = detail.seoTitle || slug;
    pageMeta[`PAGE_${upper}_SEO_DESCRIPTION`] = detail.seoDescription || tagline;
  }

  return {
    industryKey: key,
    companyName,
    tagline,
    contactEmail,
    locale: brief.locale || "tr",
    themeId: brief.themeId || "kurumsal",
    heroSubtitle: pack.heroSubtitle,
    ctaPrimary: pack.ctaPrimary,
    ctaSecondary: pack.ctaSecondary,
    servicesEyebrow: pack.servicesEyebrow,
    servicesTitle: pack.servicesTitle,
    stats: pack.stats,
    services: pack.services,
    testimonial: pack.testimonial,
    partners: pack.partners,
    aboutMission: pack.aboutMission,
    aboutValues: pack.aboutValues,
    navLinks,
    pageMeta,
    includeBlog: Array.isArray(brief.pages) && brief.pages.includes("blog"),
  };
}

function buildSiteDataSource(brief = {}) {
  const merged = mergeIndustryContent(brief);
  const payload = {
    companyName: merged.companyName,
    tagline: merged.tagline,
    contactEmail: merged.contactEmail,
    locale: merged.locale,
    themeId: merged.themeId,
    industryKey: merged.industryKey,
    heroSubtitle: merged.heroSubtitle,
    ctaPrimary: merged.ctaPrimary,
    ctaSecondary: merged.ctaSecondary,
    servicesEyebrow: merged.servicesEyebrow,
    servicesTitle: merged.servicesTitle,
    stats: merged.stats,
    services: merged.services,
    testimonial: merged.testimonial,
    partners: merged.partners,
    aboutMission: merged.aboutMission,
    aboutValues: merged.aboutValues,
    navLinks: merged.navLinks,
    pageDetails: Array.isArray(brief.pageDetails) ? brief.pageDetails : [],
  };
  return `// Auto-generated by Sauron Web Studio — do not edit by hand\nexport const siteData = ${JSON.stringify(payload, null, 2)} as const;\n\nexport type SiteData = typeof siteData;\n`;
}

function enrichBriefPlaceholders(brief) {
  const merged = mergeIndustryContent(brief);
  const flat = {
    ...brief,
    LOCALE: merged.locale,
    INDUSTRY: merged.industryKey,
    CONTACT_EMAIL: merged.contactEmail,
    HERO_SUBTITLE: merged.heroSubtitle,
    CTA_PRIMARY: merged.ctaPrimary,
    CTA_SECONDARY: merged.ctaSecondary,
    SERVICES_EYEBROW: merged.servicesEyebrow,
    SERVICES_TITLE: merged.servicesTitle,
    ABOUT_MISSION: merged.aboutMission,
    SKIP_LINK_TEXT: "Ana içeriğe geç",
    ...merged.pageMeta,
  };
  for (const [key, value] of Object.entries(merged.pageMeta)) {
    flat[key] = value;
  }
  const defaults = {
    PAGE_HOME_SEO_TITLE: merged.companyName,
    PAGE_HOME_SEO_DESCRIPTION: merged.tagline,
    PAGE_ABOUT_SEO_TITLE: "Hakkımızda",
    PAGE_ABOUT_SEO_DESCRIPTION: `${merged.companyName} — ${merged.tagline}`,
    PAGE_SERVICES_SEO_TITLE: "Hizmetler",
    PAGE_SERVICES_SEO_DESCRIPTION: `${merged.companyName} hizmetleri`,
    PAGE_CONTACT_SEO_TITLE: "İletişim",
    PAGE_CONTACT_SEO_DESCRIPTION: `${merged.companyName} ile iletişime geçin`,
    PAGE_BLOG_SEO_TITLE: "Blog",
    PAGE_BLOG_SEO_DESCRIPTION: `${merged.companyName} blog ve haberler`,
  };
  for (const [k, v] of Object.entries(defaults)) {
    if (!flat[k]) flat[k] = v;
  }
  return flat;
}

module.exports = {
  INDUSTRY_PACKS,
  normalizeIndustryKey,
  getIndustryPack,
  mergeIndustryContent,
  buildSiteDataSource,
  enrichBriefPlaceholders,
};
