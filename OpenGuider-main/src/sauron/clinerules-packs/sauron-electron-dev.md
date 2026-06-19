# Sauron Electron Dev — Cline Kuralları

## Stack
- Electron main: CommonJS (`main.js`, `src/main/`)
- Renderer: vanilla HTML/CSS/JS ES modules (`renderer/`)
- IPC: `preload.js` expose pattern; validate all IPC payloads
- Tests: `npm test` (node:test)

## Disiplin
1. Main process'te UI kodu yazma; renderer'da Node API kullanma.
2. Yeni IPC kanalı eklerken hem main handler hem preload expose güncelle.
3. `secure-store.js` dışında secret yazma; `.env` commit etme.
4. Değişiklik öncesi diff göster; 200+ satır dosyada tam okuma yerine hedefli edit.
5. Her özellik sonrası `npm test` çalıştır; kırılan testleri düzelt.

## Maliyet
6. Basit UI/string değişikliklerinde ucuz model yeterli; mimari refactor'da üst tier.
7. Aynı dosya içeriğini handoff'ta tekrar gönderme.
