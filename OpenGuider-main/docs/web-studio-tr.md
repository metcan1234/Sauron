# Web Studio — Kurumsal Site Üretimi

## Hızlı başlangıç

1. **Ayarlar → Workspace** — proje klasörünü seçin (boş veya yeni klasör).
2. Panel header'da **Web Studio** (🌐) butonuna tıklayın.
3. Sihirbaz adımları: marka → sayfalar → renk/ton → özet.
4. **Oluştur ve Cline'a gönder** — Next.js iskeleti kurulur, handoff başlar.
5. VS Code'da Cline: `npm install` → `npm run dev`.
6. Panel'de **Önizleme** (👁) → `http://localhost:3000`.

## Ne oluşturulur?

- Next.js 14 App Router + Tailwind + TypeScript
- Sayfalar: ana, hakkımızda, hizmetler, iletişim (+ opsiyonel blog)
- Bileşenler: Hero, Navbar, Footer, ServiceGrid, Stats, Testimonial, CTA
- `.sauron/web-brief.json` — marka brief
- `.sauron/web-quality-checklist.md` — SEO/a11y checklist
- `.clinerules/sauron-web-dev.md` — Cline kuralları

## Cline görev ipuçları

Handoff sonrası Cline'a şunları söyleyebilirsiniz:

- "Brief'e göre tüm sayfaları Türkçe kurumsal metinlerle doldur."
- "Mobil 375px ve desktop 1280px için responsive kontrol et."
- "Metadata ve sitemap'i brief'e göre güncelle."

## Deploy

Detay: [web-deploy-tr.md](./web-deploy-tr.md)

## Intent ayrımı

"Kurumsal site **yap**" → Web Studio / Cline (kod).  
"Google'da **aç**" → Browser plugin (gezinme).
