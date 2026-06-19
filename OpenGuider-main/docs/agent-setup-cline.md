# Cline Agent Setup (4-Agent Matrix)

Sauron Core otomatik olarak modelleri seçer; Cline extension'da aynı API anahtarlarını **bir kez** ilgili provider'lara girmeniz gerekir. Sauron anahtarları Cline'a otomatik enjekte etmez.

## Hızlı kurulum (~5 dakika)

1. Sauron Settings → **AI Agents** sekmesinde anahtarları kaydedin:
   - Gemini API Key (Google AI Studio)
   - DeepSeek API Key (platform.deepseek.com)
   - OpenAI API Key (platform.openai.com)
   - Ollama URL (isteğe bağlı, varsayılan `http://localhost:11434`)

2. VS Code'da Cline sidebar'ı açın → **Settings / API Configuration**.

3. Aşağıdaki eşleştirmeyi yapın:

| Sauron agent | Cline provider | Model (otomatik hedef) |
|--------------|----------------|------------------------|
| Gemini | **Gemini** | `gemini-2.5-flash` (Cline), `gemini-2.0-flash` (Core) |
| DeepSeek | **DeepSeek** | `deepseek-chat` |
| OpenAI | **OpenAI** | `gpt-4o-mini` |
| Ollama | **Ollama** | `qwen2.5-coder:7b` (yerel fallback) |

## Provider detayları

### DeepSeek
- Cline'da native **DeepSeek** provider'ı seçin.
- API key: Sauron Settings'teki DeepSeek key ile aynı.
- Alternatif: OpenAI-compatible endpoint (`https://api.deepseek.com`) — native provider tercih edilir.

### Gemini
- Cline **Gemini** provider → Google AI Studio key.

### OpenAI
- Cline **OpenAI** provider → escalation için `gpt-4o-mini`.

### Ollama
- Cline **Ollama** → Base URL Sauron ile aynı (`http://localhost:11434`).
- Yerel model: `ollama pull qwen2.5-coder:7b` (veya `llama3.2` fallback).

## Otomatik routing (bridge)

Handoff geldiğinde `sauron-vscode-bridge` karmaşıklığa göre Cline modelini değiştirir:

| Karmaşıklık | Cline model |
|-------------|-------------|
| low | DeepSeek Chat |
| medium | Gemini 2.5 Flash |
| high | GPT-4o-mini |
| fallback | Ollama (yapılandırıldıysa) |

Günlük bütçe hızı aşılırsa görev başına en fazla **1 tier** düşürülür.

## Smoke checklist

- [ ] Sauron Settings → AI Agents kaydedildi
- [ ] Cline'da 3 zorunlu provider key girildi (Gemini, DeepSeek, OpenAI)
- [ ] Handoff → Cline görevi başlar; bridge ledger'da `cline-agent-routing` kaydı
- [ ] Cline model seçimi handoff karmaşıklığına uygun (Settings'ten kontrol)
- [ ] Ollama yoksa yerel fallback sessizce atlanır

## Sorun giderme

- **Handoff çalışıyor ama yanlış model:** Cline API key'lerini kontrol edin; bridge `setActiveModel` başarısız olursa mevcut Cline seçimiyle devam eder.
- **DeepSeek 401:** Key'in platform.deepseek.com'dan alındığından emin olun (OpenRouter değil).
- **Ollama timeout:** Ollama URL boş bırakılabilir; routing diğer agent'lara düşer.
