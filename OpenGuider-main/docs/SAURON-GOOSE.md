# Sauron Goose Kısmı (v1.7)

Goose, Sauron'da Cline/handoff ve FinOps Ultra'dan **bağımsız** üçüncü workspace katmanıdır. Paneldeki **🪿** butonu Block Goose CLI'yi ayrı bir PowerShell terminalinde başlatır.

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
| Balanced | OpenRouter → DeepSeek | Orta karmaşıklık |
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

1. [Block Goose](https://github.com/block/goose) CLI kurun.
2. Economy için Ollama + model (ör. `qwen2.5-coder:7b`).
3. Balanced için OpenRouter veya DeepSeek API anahtarı.
4. Ayarlar → Goose binary kontrol et.

## Sınırlamalar

- Maliyet terminal token'larından okunmaz; oturum başına tahmin kullanılır.
- Durdur düğmesi PowerShell parent PID'ini sonlandırır; iç içe Goose süreci kalabilir.
- Goose binary repoya gömülmez.
