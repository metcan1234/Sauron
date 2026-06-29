const fs = require("fs");
const path = require("path");

const SAURON_WEB_DEV_RULES_FILENAME = "sauron-web-dev.md";

const SAURON_WEB_DEV_RULES = `# Sauron Web Dev — Cline Kuralları

## Erişilebilirlik (WCAG)
1. Tüm sayfalarda anlamlı başlık hiyerarşisi kullan (tek h1, mantıklı h2/h3).
2. Etkileşimli öğelerde klavye erişilebilirliği sağla; \`:focus-visible\` stillerini kaldırma.
3. Görsellerde anlamlı \`alt\` metni kullan; dekoratif görsellerde \`alt=""\` veya \`aria-hidden\`.
4. Form alanlarında \`<label>\` ile \`htmlFor\`/\`id\` eşleşmesi zorunlu.
5. Skip link (\`Skip to main content\`) korunmalı; kaldırma.

## Mobil öncelikli (Mobile-first)
6. Tailwind breakpoint'leri mobile-first yaz: önce base, sonra \`sm:\`, \`md:\`, \`lg:\`.
7. Navigasyon mobilde erişilebilir hamburger menü ile çalışmalı.
8. Dokunma hedefleri en az ~44px yükseklik/genişlik hedefle.

## Next.js / React
9. Görseller için \`next/image\` kullan; ham \`<img>\` yerine optimize edilmiş bileşen tercih et.
10. Client bileşenleri yalnızca gerektiğinde \`"use client"\` ile işaretle.
11. Metadata \`layout.tsx\` veya sayfa düzeyinde tanımlansın.

## Stil disiplini
12. **Inline style kullanma** — tüm stiller Tailwind sınıfları veya \`globals.css\` CSS değişkenleri ile.
13. Marka renkleri \`--color-primary\` ve \`--color-accent\` CSS değişkenleri üzerinden yönetilsin.
14. Yeni renkleri hard-code etme; mevcut tema token'larını genişlet.

## Genel
15. Workspace dışına yazma yapma.
16. Değişiklik öncesi diff göster; büyük refactor'larda kısa plan yaz.
`;

function seedWebDevRules(workspacePath) {
  const resolvedPath = String(workspacePath || "").trim();
  if (!resolvedPath) {
    return { seeded: false, error: "Workspace path is missing." };
  }

  const rulesDir = path.join(resolvedPath, ".clinerules");
  const rulesPath = path.join(rulesDir, SAURON_WEB_DEV_RULES_FILENAME);

  if (fs.existsSync(rulesPath)) {
    return { seeded: false, path: rulesPath };
  }

  fs.mkdirSync(rulesDir, { recursive: true });
  fs.writeFileSync(rulesPath, SAURON_WEB_DEV_RULES, "utf8");

  return { seeded: true, path: rulesPath };
}

module.exports = {
  SAURON_WEB_DEV_RULES,
  SAURON_WEB_DEV_RULES_FILENAME,
  seedWebDevRules,
};
