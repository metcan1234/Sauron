# SAURON FinOps Ultra (v1.6.0)

FinOps Ultra, mevcut `prepareLlmCall` / handoff / agent-matrix zincirini güçlendirerek token maliyetini düşürür. Cline model önerisi **kilitlemez**; kullanıcı VS Code içinde istediği modeli seçebilir.

## Mekanizmalar

| Mekanizma | Dosya | Etki |
|-----------|-------|------|
| Cline low → Gemini Flash | `agent-matrix.js` | Düşük karmaşıklık görevlerinde ucuz model önerisi |
| Mode-aware routing | `agent-matrix.js` | Economy modda high→DeepSeek; performance modda OpenAI |
| Delta handoff | `handoff-context-cache.js` | Tekrarlayan handoff'larda küçük workspace bağlamı |
| Clarify skip | `handoff-task-clarify.js` | Kısa/eylem fiilli mesajlarda LLM clarify atlanır |
| LLM response cache | `llm-response-cache.js` | 5 dk TTL, tekrarlayan düşük maliyet çağrıları |
| Progressive governor | `daily-budget-governor.js` | %80 soft / %100 hard kademe düşürme (blok yok) |
| Cline rules v1.3 | `handoff.js` | grep-first, diff-first verimlilik kuralları |

## Yeni settings

| Key | Default | Açıklama |
|-----|---------|----------|
| `finopsDeltaHandoffEnabled` | `true` | Delta handoff |
| `finopsClarifySkipEnabled` | `true` | Gereksiz clarify atla |
| `finopsClineOllamaForLow` | `false` | Cline low → Ollama (yerel) |
| `finopsPanelContextMessages` | `20` | Panel sohbet context limiti |
| `finopsMemoryCompressThreshold` | `40` | Memory chat sıkıştırma eşiği |
| `finopsMemoryCompressBatch` | `20` | Memory chat batch boyutu |
| `finopsPresetBackup` | `{}` | Solo Ultra Economy geri alma yedeği |

## Solo Ultra Economy preset

Ayarlar → FinOps → **Solo Ultra Economy Uygula**:
- `finopsCostOptimizerMode`: economy
- `finopsHandoffMaxChars`: 2500
- `finopsClineOllamaForLow`: true
- `finopsPanelContextMessages`: 10
- `finopsMemoryCompressThreshold`: 28
- `finopsMemoryCompressBatch`: 15

**Geri Al** butonu `finopsPresetBackup` içeriğini restore eder.

## Kabul kriterleri

- Handoff payload ortalama boyutu delta modda ≥%40 küçülme
- Sauron core LLM çağrısı / yoğun oturum ≥%25 azalma (clarify skip + cache)
- Cline önerilen model maliyeti / low görev ≥%30 ucuzlama
- Tüm unit testler geçer; handoff smoke OK
- Optimizer kapalıyken ultra özellikler pasif

## Sınırlamalar

- Cline Marketplace sürümünde otomatik model routing kısıtlı olabilir; öneri yine handoff JSON'da gelir.
- Delta handoff ilk handoff veya goal büyük değişiminde tam payload kullanır.
