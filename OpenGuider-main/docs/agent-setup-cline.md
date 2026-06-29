# Cline Agent Setup (4-Agent Matrix)

Sauron Core otomatik olarak modelleri seçer. v1.3.0+ ile API anahtarları **Bridge üzerinden Cline fork'a otomatik senkronlanır**. v1.4.0+ ile **Build Pipeline** fazlı handoff zinciri ve `autoChain` (fork `clearTask` gerekir) desteklenir.

## Hızlı kurulum (~3 dakika)

1. Sauron Settings → **AI Agents** sekmesinde anahtarları kaydedin:
   - Gemini API Key (Google AI Studio)
   - DeepSeek API Key (platform.deepseek.com)
   - OpenAI API Key (platform.openai.com)
   - Ollama URL (isteğe bağlı, varsayılan `http://localhost:11434`)

2. Workspace path seçin → **Cline'a senkronla** (veya ⌘ Çalışma Kısmı handoff).

3. VS Code + Sauron Bridge açıkken Cline fork anahtarları SecretStorage'a yazar.

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

## Marketplace modu (önerilen basit kurulum)

⌘ **Çalışma Kısmı** basıldığında Sauron Core:

1. **Sauron Bridge**'i otomatik kurar (`code --install-extension` ile `.vsix`)
2. Workspace'i hazırlar (`.sauron/finops-config.json`, `.clinerules/`, `.vscode/extensions.json`)
3. Handoff dosyasını yazar ve VS Code'u açar
4. Bridge Cline sidebar'ını odaklar ve görevi başlatır

### Marketplace sınırlamaları

Marketplace Cline (`saoudrizwan.claude-dev`) ile:

- `setActiveModel` / `setPlanModeModel` yok → **model otomatik değişmez** (Cline'da bir kez provider seçin)
- `hasActiveTask` yok → aktif görev çakışma uyarısı atlanır
- `startNewTask` varsa görev otomatik başlar; yoksa handoff metni **panoya kopyalanır**

### Tek seferlik kullanıcı adımları

1. Sauron Settings → Workspace path seçin
2. Marketplace'ten **Cline** kurun (yoksa)
3. Cline → API Configuration → Gemini / DeepSeek / OpenAI key'lerini **bir kez** girin
4. ⌘ ile Çalışma Kısmı'nı açın — Bridge ilk seferde otomatik kurulur

Settings → Workspace → **Bridge'i kur / yenile** düğmesi sorun giderme içindir.

## Otomatik routing (bridge + Cline fork)

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
