# ADR-0006: Web Studio — Kurumsal Site Üretimi

## Durum

Kabul edildi — 2026-06-19

## Bağlam

Kullanıcılar Core panelden kurumsal web sitesi isteği gönderiyor; "website" kelimesi browser plugin'e yanlış yönlenebiliyordu. Kod yazma bilinçli olarak Cline workspace'te kalıyor.

## Karar

1. **Web Studio modülü** (`src/sauron/web-studio/`): brief şeması, Next.js şablon scaffolder, kalite checklist.
2. **Statik template kopyalama** — `npm create` yerine `templates/corporate-nextjs/` dosya kopyası (offline, hızlı).
3. **Handoff v2 genişletme** — `webBrief`, `projectType: corporate-web`, taskSummary prepend.
4. **Intent ayrımı** — `detectWebIntent`: build vs browse.
5. **Panel wizard** — 4 adım brief + scaffold + handoff tek akış.

## Sonuçlar

- Kurumsal site üretimi birinci sınıf kullanıcı akışı.
- Browser plugin yanlış tetiklenmesi azalır.
- `npm install` kullanıcı/Cline sorumluluğunda (ağ, süre).

## Alternatifler

- Core panelde doğrudan kod üretimi — reddedildi (mimari kural).
- Webflow/Figma import — kapsam dışı (Faz H).
