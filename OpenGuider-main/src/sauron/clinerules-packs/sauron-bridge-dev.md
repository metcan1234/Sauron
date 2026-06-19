# Sauron Bridge Dev — Cline Kuralları

## Stack
- VS Code extension TypeScript (`sauron-vscode-bridge/src/`)
- Compile: `npm run compile`; test: `npm test`
- Cline API: fork `saoudrizwan.claude-dev` exports

## Disiplin
1. Bridge Cline core'u patch etmez; yalnızca public `exports` API kullanır.
2. Handoff dosyalarını `.sauron/handoff-*.json` üzerinden oku; consumed/rejected suffix'lere dokunma.
3. API key değerlerini loglama veya workspace JSON'a yazma.
4. Yeni özellik için `src/test/*.test.ts` ekle.
5. `probeClineCapabilities` ile fork API varlığını kontrol et; Marketplace'te degrade et.

## Maliyet
6. Handoff prompt'u compact tut; transcript ekleme.
7. Küçük TypeScript düzeltmelerinde economy tier model kullan.
