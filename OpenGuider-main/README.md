# Sauron

<p align="center">
  <img src="./renderer/assets/logo.png" alt="Sauron logo" width="150">
</p>

![Tests](https://img.shields.io/github/actions/workflow/status/metcan1234/Sauron/multi-platform-test.yml?branch=main&label=tests)
![Latest Release](https://img.shields.io/github/v/release/metcan1234/Sauron?label=latest%20release)
![License](https://img.shields.io/github/license/metcan1234/Sauron)

**Sauron**, bilgisayarınızda gerçek UI görevlerini tamamlamanıza yardımcı olan bir Elektron masaüstü AI asistanıdır. Sohbet, planlama, ekran görüntüsü bağlamı, işaretçi ipuçları, ses özellikleri ve eklenti sistemini tek bir iş akışında birleştirir.

İndir: [GitHub Releases](https://github.com/metcan1234/Sauron/releases/latest)

---

## Hızlı Başlangıç

### 1. Gereksinimler

| Gereksinim | Kontrol komutu | Not |
|---|---|---|
| **Node.js 18+** | `node -v` | v18.0.0 veya üstü gerekli |
| **VS Code** | `code --version` | CLI PATH'te olmalı |
| **Cline eklentisi** | `code --list-extensions \| findstr claude-dev` | `saoudrizwan.claude-dev` |

### 2. API Key Kurulumu

1. Uygulamayı açın
2. Ayarlar → **AI Agents** sekmesine gidin
3. En az bir provider için API key girin:
   - Gemini (ücretsiz): `https://aistudio.google.com/apikey`
   - DeepSeek: `https://platform.deepseek.com/api_keys`
   - OpenAI: `https://platform.openai.com/api-keys`
4. **Kaydet** butonuna basın

### 3. Workspace Path Ayarı

1. Ayarlar → **Çalışma Kısmı** sekmesine gidin
2. Proje kök klasörünüzü seçin
3. `⌘` butonu yeşil olana kadar bekleyin

### 4. Doctor Kontrolü

İlk açılışta **Doctor** panelini çalıştırın:

```
⌘ Çalışma Kısmı → Doctor Çalıştır
```

Tüm kontroller yeşil olana kadar eksikleri giderin.

---

## Kanal Kurulumları

### ⌘ Çalışma Kısmı (VS Code + Cline)

- VS Code gereklidir (`code` CLI PATH'te)
- Cline eklentisi (`saoudrizwan.claude-dev`) yüklü olmalı
- Sauron Bridge VSIX **otomatik kurulur**
- `⌘` butonuna basın → handoff yazılır → Cline'a gönderilir

### 🪿 Goose

1. Goose CLI binary'nizi PATH'e ekleyin veya ayarlardan yolu belirtin
2. İlk seferde:
   ```bash
   goose configure
   ```
3. Ayarlar → **AI Agents** → Goose yolunu kontrol edin
4. `npm run terminal` ile terminal arayüzünden kullanın

### 🎮 Game Dev

- **Unity Editor** ayrıca kurulmalıdır
- Unity projenizde `CoplayDev/unity-mcp` reposundaki bridge'i kurun
- `extensions/gamedev-all-in-one/dist/index.js` build edilmiş olmalı:
  ```bash
  cd extensions/gamedev-all-in-one
  npm install && npm run build
  ```
- Ayarlar → **Game Dev** sekmesinden etkinleştirin

### Browser Agent

1. Ayarlar → **Eklentiler** → **Browser** sekmesine gidin
2. **Runtime İndir** butonuna basın (Python + Playwright)
3. veya sistem Python 3.11+ kurup elle yapılandırın
4. İndirme tamamlandığında otomatik başlar

---

## Geliştirme Ortamı

```bash
cd OpenGuider-main
npm install
npm start
```

---

## Bridge VSIX Derleme (Geliştirici)

Sauron Bridge VSIX, handoff dosyalarını Cline'a ileten VS Code eklentisidir.

```bash
cd sauron-vscode-bridge
npm install
npm run package:vsix
# Çıktı: dist/sauron-vscode-bridge.vsix
```

Derlenen `.vsix` dosyası otomatik olarak `electron-builder` tarafından pakete eklenir.

---

## Build Kontrolleri

Her build öncesi integrity kontrolü çalıştırın:

```bash
npm run prebuild
```

Bu script şunları kontrol eder:
- `extensions/gamedev-all-in-one/dist/index.js` — GameDev MCP entry
- `sauron-vscode-bridge/dist/sauron-vscode-bridge.vsix` — Bridge VSIX
- Tüm kritik Node.js paketleri (`electron`, `electron-store`, `ws`)
- Çekirdek kaynak dosyaları (`main.js`, `src/ipc/`, `src/sauron/`)

Production build:

```bash
npm run dist:win   # Windows NSIS
npm run dist:mac   # macOS DMG
npm run dist:linux # Linux AppImage/Deb
```

---

## Sorun Giderme

### Doctor'da Kırmızı Kutular

| Hata | Çözüm |
|---|---|
| VS Code CLI bulunamadı | VS Code açın → `Ctrl+Shift+P` → `Shell Command: Install 'code' command in PATH` |
| Bridge extension yok | `⌘` ile otomatik kurulum yapın veya Ayarlar → Bridge → Kur |
| Cline extension yok | VS Code Extensions → `saoudrizwan.claude-dev` arayıp kurun |
| API key yok | Ayarlar → AI Agents → en az bir provider anahtarı girin |
| Workspace yok | Ayarlar → Çalışma Kısmı → klasör seçin |
| Goose binary yok | Goose CLI kurun veya Ayarlar → AI Agents → yolu elle girin |

### `code` CLI PATH Sorunu

**Windows:**
```bash
# VS Code → Command Palette → "Shell Command: Install 'code' command in PATH"
# veya manuel:
$env:Path += ";$env:LOCALAPPDATA\Programs\Microsoft VS Code\bin"
```

**macOS:**
```bash
# VS Code → Command Palette → "Shell Command: Install 'code' command in PATH"
```

### Goose Binary Bulunamıyor

```bash
# Binary'nin PATH'te olduğundan emin olun
which goose
# veya Windows:
where goose

# Yoksa: https://github.com/block/goose/releases adresinden indirin
```

---

## Lisans

Apache-2.0 — [Mehmet Can Bayatlı](https://github.com/metcan1234)
