# Web Sitesi Yayınlama (Deploy)

## Vercel (önerilen — Next.js)

1. [vercel.com](https://vercel.com) hesabı oluşturun.
2. GitHub'a projeyi push edin (Cline ile `git init` + commit).
3. Vercel → **Add New Project** → repo seçin.
4. Framework: **Next.js** (otomatik algılanır).
5. Deploy → canlı URL alın.

Projede `vercel.json` şablonu mevcuttur.

## Netlify

1. [netlify.com](https://netlify.com) hesabı.
2. **Add new site** → Git veya drag-drop `out/` (static export kullanıyorsanız).
3. Build command: `npm run build`
4. Publish directory: `.next` veya `out` (export moduna göre)

## Yerel test (deploy öncesi)

```bash
npm install
npm run dev    # http://localhost:3000
npm run build  # production build doğrulama
```

## Checklist (deploy öncesi)

- [ ] `npm run build` hatasız
- [ ] Tüm sayfalar TR içerik dolu
- [ ] Metadata (title, description) her sayfada
- [ ] İletişim formu veya e-posta linki çalışıyor
- [ ] Footer'da KVKK / gizlilik placeholder linki
- [ ] Mobil görünüm kontrol edildi

Kalite listesi: workspace `.sauron/web-quality-checklist.md`
