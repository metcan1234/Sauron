# Manuel Test Checklist — v1.2

## Web Studio (v1.2)

- [ ] "Kurumsal site yap" → browser plugin'e gitmez
- [ ] Web Studio wizard → brief kaydedilir
- [ ] Scaffold → Next.js dosyaları workspace'te (15+ dosya)
- [ ] `.sauron/web-brief.json` ve `web-quality-checklist.md` oluşur
- [ ] Oluştur ve Cline'a gönder → handoff + VS Code
- [ ] Cline: npm install && npm run dev → Önizleme butonu localhost açar

## Stabilite (30 dk)

- [ ] Panel 30 dk açık kalır, bellek sızıntısı yok
- [ ] Panel renderer crash sonrası otomatik toparlanır (DevTools force crash)
- [ ] Settings penceresi crash sonrası yeniden açılır

## Sohbet

- [ ] Yeni mesaj gönder → yeniden başlat → mesajlar persist
- [ ] Geçici sohbet yeniden başlatınca kaybolur
- [ ] Mesaj düzenle → sonraki mesajlar silinir → yanıt yenilenir
- [ ] Mesaj sil
- [ ] Regenerate (↻) son asistan yanıtını yeniler
- [ ] Ctrl+K drawer arama

## Klasörler ve ekler

- [ ] Klasör oluştur, sohbeti taşı
- [ ] Drag-drop görsel gönder
- [ ] Paste ile dosya ekle, önizleme şeridi görünür

## Artifact

- [ ] Kod bloğunda Panelde aç → düzenle → kopyala/indir

## Workspace

- [ ] ⌘ handoff → VS Code → Bridge consumed

## Yedekleme

- [ ] Otomatik yedekleme açık → kapanışta JSON oluşur
- [ ] İçe aktar merge modu çalışır

## FinOps / Browser

- [ ] FinOps badge oturum/toplam ayrımı
- [ ] Browser sidecar crash → panel banner

## v1.1 — Faz 4B–E

- [ ] Sistem tanısı (doctor) tüm kritik kontrolleri listeler
- [ ] install-sauron-stack.ps1 / Bridge kur yenile
- [ ] Handoff geçmişi paneli yüklenir, 30 sn yenilenir
- [ ] Bekleyen handoff → ⌘ rozet; reddet → `.rejected`
- [ ] FinOps analitik grafiği (7 gün)
- [ ] Sert bütçe açık → limit aşımında sohbet engellenir
- [ ] Browser görevi sonrası usage ledger'da `browser-goal` satırı
- [ ] OpenRouter max tokens kaydedilir
