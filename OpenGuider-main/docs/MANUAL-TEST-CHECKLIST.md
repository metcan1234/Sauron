# Manuel Test Checklist — v1.4.2

## CMD + Windows EXE (v1.4.2)

- [ ] ⌘ Çalışma Kısmı → VS Code açılır, **görünür cmd.exe penceresi yok**
- [ ] "VS Code'a git" → ek cmd penceresi açılmaz (debounce)
- [ ] Pipeline başlat → tek VS Code odak, çift cmd yok
- [ ] `npm run predist:win` syntax + test + Bridge VSIX kontrolü geçer
- [ ] `npm run pack` → `release/win-unpacked/Sauron.exe` başlar
- [ ] `npm run dist:win` → `release/Sauron-1.4.2-win-x64.exe` kurulumu
- [ ] Kurulu EXE: masaüstü kısayolu **Sauron**; Bridge VSIX `resources/bridge/` içinden kurulur
- [ ] Panel: `pipeline-updated` IPC ile Üretim Hattı kartı güncellenir
- [ ] Panel açılışında preload API timeout banner'ı görünmez (normal boot)

## Self-Build Pipeline (v1.4)

- [ ] 🔧 Self-Build Studio → pipeline başlat → faz 1 handoff
- [ ] Cline görev bitince `.sauron/cline-task-complete.json` oluşur
- [ ] Üretim Hattı kartı faz ilerlemesini gösterir
- [ ] Sonraki faz handoff otomatik yazılır (fork + autoChain)
- [ ] Kurumsal site pipeline → `npm run build` doğrulama fazı
- [ ] Self-improve pipeline → Sauron `npm test` fazı

## Rehber + Ekran Al (v1.3)

- [ ] Sohbet gönderince otomatik ekran alınmıyor
- [ ] Ekran Al → önizleme → gönder → vision/pointer çalışıyor
- [ ] Mod: Rehber + ekran + soru → plan paneli + turuncu imleç
- [ ] Tamamladım öncesi ekran yoksa uyarı
- [ ] Ekran Al → Tamamladım → sonraki adım

## Cline senkron (v1.3)

- [ ] Settings → 3 provider key kaydet → Cline'a senkronla
- [ ] Handoff öncesi `.sauron/cline-credential-request.json` oluşur (secret yok)
- [ ] Bridge + Cline fork → provider key'ler Cline'da görünür

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
