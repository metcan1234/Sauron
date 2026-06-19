# Manuel Test Checklist — v1.0

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
