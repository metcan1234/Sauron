# Sauron Goose Kısmı (v1.7)

Goose, Sauron'da Cline/handoff ve FinOps Ultra'dan **bağımsız** üçüncü workspace katmanıdır. Paneldeki **🪿** butonu Block Goose CLI'yi **ön planda** ayrı bir terminal penceresinde başlatır (Windows Terminal varsa orada, yoksa PowerShell).

## Mimari

| Katman | Giriş | Amaç |
|--------|-------|------|
| Panel | Sauron sohbet | Planlama, rehber, FinOps |
| Çalışma Kısmı | ⌘ | VS Code + Cline + handoff |
| Goose Kısmı | 🪿 | Terminal tabanlı Goose agent |

Goose routing **Cline model önerisini veya handoff içeriğini değiştirmez**.

## Token modları

| Mod | Provider | Ne zaman |
|-----|----------|----------|
| Economy | Ollama (yerel) | Basit dosya/komut görevleri |
| Balanced | DeepSeek (native) veya OpenRouter (OpenAI uyumlu) | Orta karmaşıklık |
| Premium | OpenAI | Mimari/refactor/güvenlik anahtar kelimeleri |

`gooseAutoMode` açıkken mod görev metnine göre seçilir. Kapalıyken `gooseDefaultMode` kullanılır.

Ollama yoksa veya çalışmıyorsa Economy → Balanced fallback (kullanıcıya toast).

## Ayarlar (AI Ajanları)

- `gooseEnabled` — panel butonu (varsayılan: açık)
- `gooseBinaryPath` — boş = PATH / `%USERPROFILE%\.local\bin\goose.exe`
- `gooseDefaultMode` — economy | balanced | premium
- `gooseDailyBudgetTl` — günlük tahmini tavan (0 = sınırsız)
- `gooseAutoMode` — otomatik karmaşıklık yönlendirmesi

## Workspace artefaktları

- `.goose/instructions.md` — Goose sistem talimatları (Sauron seed eder)
- `.sauron/goose-*.json` — handoff kayıtları (Cline handoff'tan ayrı)

## FinOps

Her oturum başlangıcında tahmini maliyet `goose-session-<mode>` operation ile loglanır (`estimated: true`). Ayarlar → Bütçe / FinOps altında günlük Goose satırı görünür.

## Doctor

- `goose-binary` — CLI bulundu mu
- `goose-economy-provider` — Ollama URL + model yapılandırması

## Kurulum

1. **[Goose CLI](https://github.com/block/goose)** kurun — **Desktop (GUI) yeterli değil.**
   - PowerShell: `download_cli.ps1` ile `%USERPROFILE%\.local\bin\goose.exe`
   - Start Menu'deki Goose masaüstü uygulaması Sauron 🪿 ile çalışmaz.
2. Economy için Ollama + model (ör. `qwen2.5-coder:7b`).
3. Balanced için DeepSeek veya OpenRouter/OpenAI anahtarı.
4. Ayarlar → **Goose binary kontrol et** → “CLI bulundu” yazmalı.

## Sınırlamalar

- Maliyet terminal token'larından okunmaz; oturum başına tahmin kullanılır.
- Durdur düğmesi PowerShell parent PID'ini sonlandırır; iç içe Goose süreci kalabilir.
- Goose binary repoya gömülmez.
- Launcher görev metnini temp dosyaya yazar; PowerShell `-File` ile arg splatting kullanır (boşluklu yollar güvenli).
- Windows'ta `Start-Process` + odak penceresi ile terminal görünür açılır; `GOOSE_TELEMETRY_OFF=1` ile ilk kurulum telemetri sorusu atlanır.
- `.ps1` ve görev dosyaları UTF-8 BOM ile yazılır; yollar manifest JSON içinde UTF-8 Base64 olarak taşınır (Türkçe `İ/Ğ/Ş` yolları güvenli).
- İlk kurulumda terminalde `goose configure` gerekebilir.
