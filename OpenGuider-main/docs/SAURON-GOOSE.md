# Sauron Goose Kısmı (v1.8)

Goose, Sauron'da Cline/handoff ve FinOps Ultra'dan **bağımsız** üçüncü workspace katmanıdır. Paneldeki **🪿** butonu Block Goose CLI'yi **ön planda** ayrı bir terminal penceresinde başlatır (Windows Terminal varsa orada, yoksa PowerShell).

## Mimari

| Katman | Giriş | Amaç |
|--------|-------|------|
| Panel | Sauron sohbet | Planlama, rehber, FinOps |
| Çalışma Kısmı | ⌘ | VS Code + Cline + handoff |
| Goose Kısmı | 🪿 | Terminal tabanlı Goose agent |

Goose routing **Cline model önerisini veya handoff içeriğini değiştirmez**.

Token tasarrufu yalnızca **launch-time** uygulanır: model seçimi, Goose env profilleri, `--system` boyutu, `-t` görev kısaltması.

## Token modları

| Mod | Provider | Ne zaman |
|-----|----------|----------|
| Economy | Ollama (yerel) | Basit dosya/komut görevleri |
| Balanced | DeepSeek (native) veya OpenRouter (OpenAI uyumlu) | Orta karmaşıklık |
| Premium | OpenAI | Mimari/refactor/güvenlik anahtar kelimeleri |

`gooseAutoMode` açıkken mod görev metnine göre seçilir. Kapalıyken `gooseDefaultMode` kullanılır.

Ollama yoksa veya çalışmıyorsa Economy → Balanced fallback (kullanıcıya toast).

### Mod profilleri (v1.8)

Her mod için Goose env değişkenleri oturum başında set edilir:

| Mod | Env | maxTurns |
|-----|-----|----------|
| economy | `GOOSE_CLI_MIN_PRIORITY=0.5`, `GOOSE_AUTO_COMPACT_THRESHOLD=0.55`, `GOOSE_CONTEXT_STRATEGY=summarize` | 40 |
| balanced | `GOOSE_CLI_MIN_PRIORITY=0.25`, `GOOSE_AUTO_COMPACT_THRESHOLD=0.65` | 60 |
| premium | `GOOSE_CLI_MIN_PRIORITY=0.0`, `GOOSE_AUTO_COMPACT_THRESHOLD=0.75` | 100 |

`--system` talimatları moda göre kısaltılır (economy ~2K, balanced ~4K, premium ~8K karakter).

## Ayarlar (AI Ajanları)

- `gooseEnabled` — panel butonu (varsayılan: açık)
- `gooseBinaryPath` — boş = PATH / `%USERPROFILE%\.local\bin\goose.exe`
- `gooseDefaultMode` — economy | balanced | premium
- `gooseDailyBudgetTl` — günlük tahmini tavan (0 = sınırsız)
- `gooseAutoMode` — otomatik karmaşıklık yönlendirmesi
- `gooseBudgetAutoDowngrade` — bütçe aşıldığında otomatik mod düşürme (**varsayılan: kapalı**)
- `gooseBudgetWarnAt` — uyarı eşiği (varsayılan: 0.8)
- `gooseFinopsShareGlobalBudget` — FinOps governor uyarılarını Goose ile paylaş (varsayılan: açık)
- `gooseShowModeHint` — launch öncesi mod önerisi toast (varsayılan: açık)

## Workspace artefaktları

- `.goose/instructions.md` — Goose sistem talimatları (Sauron seed eder, v1.1)
- `.sauron/goose-*.json` — handoff kayıtları (Cline handoff'tan ayrı)

## FinOps

Her oturum başlangıcında tahmini maliyet `goose-session-<mode>` operation ile loglanır (`estimated: true`). Görev kelime sayısına göre çarpan uygulanır. Ayarlar → Bütçe / FinOps altında günlük Goose satırı ve governor uyarıları görünür.

## Doctor

- `goose-binary` — CLI bulundu mu
- `goose-economy-provider` — Ollama URL + model yapılandırması
- `goose-mode-profile` — mod profilleri hazır mı
- `goose-budget-policy` — bütçe politikası (yumuşak / otomatik düşürme)

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
- Goose, PowerShell `.ps1` yerine **Node.js `spawn`** ile başlatılır (Türkçe yol güvenli).
- Goose CLI: görev için `-t`, Sauron kuralları için `--system` (ikisi birlikte `-i` ile kullanılamaz).
- İlk kurulumda terminalde `goose configure` gerekebilir.
